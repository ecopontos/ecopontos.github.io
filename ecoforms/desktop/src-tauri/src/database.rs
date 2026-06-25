use rusqlite::{Connection, Result as SqliteResult, Row, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use crate::session::SessionState;

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: usize,
}

pub struct DbState {
    pub conn: Mutex<Option<Connection>>,
    pub db_path: Mutex<Option<PathBuf>>,
}

impl DbState {
    pub fn new() -> Self {
        Self {
            conn: Mutex::new(None),
            db_path: Mutex::new(None),
        }
    }
}

/// Verifica se a tabela `usuarios` ainda não existe ou está vazia.
/// Usado para liberar mutações de bootstrap (criação/seed de tabelas RBAC)
/// antes de existir qualquer usuário no sistema. Se a tabela ainda não foi
/// criada, trata como "sem usuários" para não bloquear o ensure-columns inicial.
fn no_users_exist(conn: &Connection) -> bool {
    conn.query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get::<_, i64>(0))
        .map(|count| count == 0)
        .unwrap_or(true)
}

/// Conecta ao banco de dados SQLite
#[tauri::command]
pub fn db_connect(db_path: String, state: State<'_, DbState>) -> Result<String, String> {
    let path = PathBuf::from(&db_path);

    // Cria o diretório pai se não existir (instalação limpa)
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create database directory: {}", e))?;
    }

    let conn = Connection::open(&path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    // Enable WAL mode
    // PRAGMA journal_mode returns a row, so we must use query_row instead of execute
    let _mode: String = conn
        .query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))
        .map_err(|e| format!("Failed to enable WAL mode: {}", e))?;

    // Bootstrap migration: preenche sal_sync para usuários criados antes do campo existir
    let _ = conn.execute(
        "UPDATE usuarios SET sal_sync = lower(hex(randomblob(32))) WHERE sal_sync IS NULL",
        [],
    );

    // Seed RBAC tables (perfis, hierarquia_perfis, permissoes) — sempre, idempotente
    // Roda antes do TypeScript ensure-columns para evitar bloqueio do SQL Guard
    if let Err(e) = crate::commands::setup::seed_rbac_tables(&conn) {
        eprintln!("[db_connect] seed_rbac_tables ignorado: {}", e);
    }

    // ADR-051 (Gap 3, revisado): seed do admin padrão no boot é dev-only — builds release
    // (cfg!(debug_assertions) == false) nunca semeiam, e builds debug só semeiam com opt-in
    // explícito via env ECOFORMS_SEED_ADMIN=1. Tolerante — no-op se o schema ainda não existe
    // (db_connect roda antes de ensure-columns) ou se já houver usuários.
    if cfg!(debug_assertions) && std::env::var("ECOFORMS_SEED_ADMIN").is_ok() {
        if let Err(e) = crate::commands::setup::seed_default_admin_conn(&conn) {
            eprintln!("[db_connect] seed_default_admin ignorado: {}", e);
        }
    }

    *state.conn.lock().unwrap() = Some(conn);
    *state.db_path.lock().unwrap() = Some(path);

    Ok(format!("Connected to database: {}", db_path))
}

/// Executa uma query SELECT e retorna os resultados
/// Helper to convert json value to Sqlite param
fn json_to_sql(v: &serde_json::Value) -> Box<dyn rusqlite::ToSql> {
    match v {
        serde_json::Value::Null => Box::new(rusqlite::types::Null),
        serde_json::Value::Bool(b) => Box::new(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                Box::new(n.to_string())
            }
        }
        serde_json::Value::String(s) => Box::new(s.clone()),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => Box::new(v.to_string()),
    }
}

/// Executa uma query SELECT e retorna os resultados
#[tauri::command]
pub fn db_query(
    sql: String,
    params: Vec<serde_json::Value>,
    state: State<'_, DbState>,
    _session: State<'_, SessionState>,
) -> Result<QueryResult, String> {
    // db_query é estritamente read-only: um único statement SELECT/WITH.
    let normalized = crate::sql_guard::strip_comments_and_strings(&sql);
    if !crate::sql_guard::is_single_statement(&normalized) {
        return Err("db_query aceita apenas um statement por vez".to_string());
    }
    if crate::sql_guard::statement_kind(&normalized) != crate::sql_guard::StatementKind::Select {
        return Err("db_query aceita apenas SELECT/WITH (somente leitura)".to_string());
    }

    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let column_count = stmt.column_count();
    let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    // Proteção: bloquear leitura de colunas de senha via query genérica.
    // Checagem estrutural sobre os nomes de coluna retornados (não sobre o
    // texto do SQL), evitando falsos positivos (ex.: "hash_senha_atualizada_em").
    const FORBIDDEN_COLUMNS: [&str; 2] = ["PASSWORD_HASH", "HASH_SENHA"];
    if columns.iter().any(|c| FORBIDDEN_COLUMNS.contains(&c.to_uppercase().as_str())) {
        return Err("Leitura da coluna de senha não permitida via query genérica".to_string());
    }

    // Convert values to temporary vector of boxes to keep them alive
    let sql_params_storage: Vec<Box<dyn rusqlite::ToSql>> =
        params.iter().map(json_to_sql).collect();

    // Create slice of references for rusqlite
    let sql_params_refs: Vec<&dyn rusqlite::ToSql> =
        sql_params_storage.iter().map(|b| b.as_ref()).collect();

    let rows_result = stmt
        .query_map(&sql_params_refs[..], |row| {
            let mut values = Vec::new();
            for i in 0..column_count {
                let value = row_value_to_json(row, i)?;
                values.push(value);
            }
            Ok(values)
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut rows = Vec::new();
    for row in rows_result {
        rows.push(row.map_err(|e| format!("Row error: {}", e))?);
    }

    let rows_count = rows.len();

    Ok(QueryResult {
        columns,
        rows,
        rows_affected: rows_count,
    })
}

/// Executa um comando SQL (INSERT, UPDATE, DELETE, CREATE, etc)
#[tauri::command]
pub fn db_execute(
    sql: String,
    params: Vec<serde_json::Value>,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    bootstrap: Option<bool>,
) -> Result<usize, String> {
    // Sanitização de segurança para tabelas sensíveis (estrutural, não por substring)
    let normalized = crate::sql_guard::strip_comments_and_strings(&sql);
    if !crate::sql_guard::is_single_statement(&normalized) {
        return Err("db_execute aceita apenas um statement por vez".to_string());
    }

    let kind = crate::sql_guard::statement_kind(&normalized);
    let is_mutation = matches!(
        kind,
        crate::sql_guard::StatementKind::Insert
            | crate::sql_guard::StatementKind::Update
            | crate::sql_guard::StatementKind::Delete
    );

    if is_mutation {
        // Verificar se é admin (ou se estamos em bootstrap sem usuários ainda) para
        // permitir mutations em tabelas sensíveis
        let (is_admin, bootstrap_allowed) = {
            let conn_guard = state.conn.lock().unwrap();
            let conn = conn_guard.as_ref().ok_or_else(|| "Database not connected".to_string())?;
            let perfil_opt = session.perfil.lock().unwrap().clone();
            let is_admin = match perfil_opt {
                Some(p) => {
                    let nivel: Option<i64> = conn.query_row(
                        "SELECT nivel FROM hierarquia_perfis WHERE perfil = ?1",
                        [&p],
                        |row| row.get(0),
                    ).optional().unwrap_or(None);
                    nivel == Some(0)
                }
                None => false,
            };
            let bootstrap_allowed = bootstrap.unwrap_or(false)
                && (no_users_exist(conn)
                    || (matches!(kind, crate::sql_guard::StatementKind::Insert)
                        && crate::sql_guard::is_insert_or_ignore(&normalized)));
            (is_admin, bootstrap_allowed)
        };

        if !is_admin && !bootstrap_allowed {
            // Nomes antigos (en_us) e novos (pt_br) — ambos bloqueados durante transição
            const SENSITIVE_TABLES: [&str; 6] = [
                "USUARIOS", "PERFIS",
                "ROLE_HIERARCHY", "HIERARQUIA_PERFIS",
                "PERMISSIONS", "PERMISSOES",
            ];
            if let Some(table) = crate::sql_guard::extract_target_table(&normalized, &kind) {
                if SENSITIVE_TABLES.contains(&table.as_str()) {
                    return Err(format!("Tabela {} só pode ser modificada por administradores", table));
                }
            }
        }
    }
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let sql_params_storage: Vec<Box<dyn rusqlite::ToSql>> =
        params.iter().map(json_to_sql).collect();

    let sql_params_refs: Vec<&dyn rusqlite::ToSql> =
        sql_params_storage.iter().map(|b| b.as_ref()).collect();

    let affected = stmt
        .execute(&sql_params_refs[..])
        .map_err(|e| format!("Execute failed: {}", e))?;

    Ok(affected)
}

/// Executa múltiplos comandos SQL em uma transação
#[tauri::command]
pub fn db_execute_batch(
    sqls: Vec<String>,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    bootstrap: Option<bool>,
) -> Result<(), String> {
    // Sanitização para batch (aplica mesmas regras de db_execute)
    let (is_admin, no_users, bootstrap_flag) = {
        let conn_guard = state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().ok_or_else(|| "Database not connected".to_string())?;
        let perfil_opt = session.perfil.lock().unwrap().clone();
        let is_admin = match perfil_opt {
            Some(p) => {
                let nivel: Option<i64> = conn.query_row(
                    "SELECT nivel FROM hierarquia_perfis WHERE perfil = ?1",
                    [&p],
                    |row| row.get(0),
                ).optional().unwrap_or(None);
                nivel == Some(0)
            }
            None => false,
        };
        (is_admin, no_users_exist(conn), bootstrap.unwrap_or(false))
    };

    for sql in &sqls {
        let normalized = crate::sql_guard::strip_comments_and_strings(sql);
        if !crate::sql_guard::is_single_statement(&normalized) {
            return Err("Cada item do batch deve conter apenas um statement".to_string());
        }

        let kind = crate::sql_guard::statement_kind(&normalized);

        // Bloquear escrita na coluna de senha via batch genérico — checagem
        // estrutural sobre as colunas do INSERT/UPDATE, não sobre o texto do SQL.
        const FORBIDDEN_COLUMNS: [&str; 2] = ["PASSWORD_HASH", "HASH_SENHA"];
        if crate::sql_guard::extract_set_columns(&normalized)
            .iter()
            .any(|c| FORBIDDEN_COLUMNS.contains(&c.as_str()))
        {
            return Err("Coluna de senha não permitida em batch".to_string());
        }

        let is_mutation = matches!(
            kind,
            crate::sql_guard::StatementKind::Insert
                | crate::sql_guard::StatementKind::Update
                | crate::sql_guard::StatementKind::Delete
        );
        let bootstrap_allowed = bootstrap_flag
            && (no_users
                || (matches!(kind, crate::sql_guard::StatementKind::Insert)
                    && crate::sql_guard::is_insert_or_ignore(&normalized)));

        if is_mutation && !is_admin && !bootstrap_allowed {
            const SENSITIVE_TABLES: [&str; 6] = [
                "USUARIOS", "PERFIS",
                "ROLE_HIERARCHY", "HIERARQUIA_PERFIS",
                "PERMISSIONS", "PERMISSOES",
            ];
            if let Some(table) = crate::sql_guard::extract_target_table(&normalized, &kind) {
                if SENSITIVE_TABLES.contains(&table.as_str()) {
                    return Err(format!("Tabela {} só pode ser modificada por administradores", table));
                }
            }
        }
    }
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    conn.execute_batch(&sqls.join(";"))
        .map_err(|e| format!("Batch execute failed: {}", e))?;

    Ok(())
}

/// Retorna o último ID inserido
#[tauri::command]
pub fn db_last_insert_id(state: State<'_, DbState>) -> Result<i64, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    Ok(conn.last_insert_rowid())
}

/// Exporta o banco local para provisão mobile (ADR-028).
/// Gera um .db limpo (sem dados sensíveis) no caminho especificado.
#[tauri::command]
pub fn db_export_for_mobile(
    export_path: String,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    let db_path_guard = state.db_path.lock().unwrap();
    let _source_path = db_path_guard
        .as_ref()
        .ok_or_else(|| "No database path available".to_string())?;

    let export_pb = std::path::PathBuf::from(&export_path);

    if let Some(parent) = export_pb.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create export directory: {}", e))?;
        }
    }

    // Backup: SQLite backup API (cópia consistente sem travar o banco principal)
    let mut export_conn = rusqlite::Connection::open(&export_pb)
        .map_err(|e| format!("Failed to open export DB: {}", e))?;

    {
        let backup = rusqlite::backup::Backup::new(conn, &mut export_conn)
            .map_err(|e| format!("Backup init failed: {}", e))?;

        backup
            .run_to_completion(100, std::time::Duration::from_millis(10), None)
            .map_err(|e| format!("Backup failed: {}", e))?;
    } // backup dropped here — mutable borrow released

    // Limpar dados sensíveis do arquivo exportado
    export_conn
        .execute("PRAGMA foreign_keys = OFF", [])
        .ok();

    export_conn.execute("DELETE FROM tbl_audit_log", []).ok();
    export_conn.execute("DELETE FROM sync_event_queue", []).ok();
    export_conn.execute("DELETE FROM sync_device_log", []).ok();
    export_conn.execute("DELETE FROM sync_gap_log", []).ok();
    export_conn.execute("DELETE FROM sync_cursor", []).ok();
    export_conn.execute("DELETE FROM sync_manifest", []).ok();
    export_conn.execute("DELETE FROM sync_status", []).ok();
    export_conn.execute("DELETE FROM sync_applied_log", []).ok();

    // Remover dados sensíveis de usuários
    export_conn
        .execute("UPDATE usuarios SET hash_senha = '', sal_sync = ''", [])
        .ok();

    // Reconstruir sem espaços vazios
    export_conn.execute("VACUUM", []).ok();

    Ok(export_path)
}

// Helper functions

pub(crate) fn row_value_to_json(row: &Row, idx: usize) -> SqliteResult<serde_json::Value> {
    use rusqlite::types::ValueRef;

    let value_ref = row.get_ref(idx)?;

    let json_value = match value_ref {
        ValueRef::Null => serde_json::Value::Null,
        ValueRef::Integer(i) => serde_json::json!(i),
        ValueRef::Real(f) => serde_json::json!(f),
        ValueRef::Text(t) => {
            let s = std::str::from_utf8(t).unwrap_or("");
            serde_json::json!(s)
        }
        ValueRef::Blob(b) => {
            // Codificar blob como base64
            serde_json::json!(base64_encode(b))
        }
    };

    Ok(json_value)
}

fn base64_encode(data: &[u8]) -> String {
    use std::io::Write;
    let mut buf = Vec::new();
    {
        let mut encoder =
            base64::write::EncoderWriter::new(&mut buf, &base64::engine::general_purpose::STANDARD);
        encoder.write_all(data).unwrap();
    }
    String::from_utf8(buf).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::Manager;

    fn setup_db() -> DbState {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT, perfil TEXT, hash_senha TEXT);
             CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);
             CREATE TABLE hierarquia_perfis (perfil TEXT PRIMARY KEY, nivel INTEGER);
             INSERT INTO usuarios (id, nome, perfil, hash_senha) VALUES (1, 'admin', 'admin', 'secret');
             INSERT INTO clientes (id, nome) VALUES (1, 'Cliente A');
             INSERT INTO hierarquia_perfis (perfil, nivel) VALUES ('admin', 0), ('operador', 5);",
        )
        .unwrap();
        DbState {
            conn: Mutex::new(Some(conn)),
            db_path: Mutex::new(None),
        }
    }

    fn session_with_perfil(perfil: &str) -> SessionState {
        let session = SessionState::new();
        *session.perfil.lock().unwrap() = Some(perfil.to_string());
        session
    }

    /// Banco "fresco" de bootstrap: tabela `usuarios` existe mas está vazia
    /// (nenhum usuário criado ainda), simulando o primeiro boot do app.
    fn setup_db_no_users() -> DbState {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT, perfil TEXT, hash_senha TEXT);
             CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);
             CREATE TABLE hierarquia_perfis (perfil TEXT PRIMARY KEY, nivel INTEGER);
             CREATE TABLE perfis (id TEXT PRIMARY KEY, nome TEXT);
             INSERT INTO clientes (id, nome) VALUES (1, 'Cliente A');",
        )
        .unwrap();
        DbState {
            conn: Mutex::new(Some(conn)),
            db_path: Mutex::new(None),
        }
    }

    /// Cria um `App` mockado com `DbState`/`SessionState` gerenciados, para
    /// que os commands `#[tauri::command]` possam ser chamados diretamente
    /// nos testes com `tauri::State<'_, T>` reais via `app.state::<T>()`.
    fn make_app(db: DbState, session: SessionState) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(db);
        app.manage(session);
        app
    }

    #[test]
    fn db_query_blocks_password_column() {
        let app = make_app(setup_db(), SessionState::new());
        let result = db_query(
            "SELECT id, hash_senha FROM usuarios".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn db_query_allows_normal_select() {
        let app = make_app(setup_db(), SessionState::new());
        let result = db_query(
            "SELECT id, nome FROM clientes".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn db_query_rejects_mutation_and_does_not_execute_it() {
        let app = make_app(setup_db(), SessionState::new());
        let result = db_query(
            "UPDATE clientes SET nome = 'Hackeado' WHERE id = 1".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
        );
        assert!(result.is_err());

        let nome: String = app
            .state::<DbState>()
            .conn
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .query_row("SELECT nome FROM clientes WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(nome, "Cliente A");
    }

    #[test]
    fn db_query_rejects_multi_statement() {
        let app = make_app(setup_db(), SessionState::new());
        let result = db_query(
            "SELECT 1; DROP TABLE clientes".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn db_execute_blocks_usuarios_for_non_admin() {
        let app = make_app(setup_db(), session_with_perfil("operador"));
        let result = db_execute(
            "UPDATE usuarios SET perfil = 'admin' WHERE id = 1".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn db_execute_allows_admin_to_modify_usuarios() {
        let app = make_app(setup_db(), session_with_perfil("admin"));
        let result = db_execute(
            "UPDATE usuarios SET perfil = 'gerente' WHERE id = 1".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn db_execute_allows_non_sensitive_table() {
        let app = make_app(setup_db(), session_with_perfil("operador"));
        let result = db_execute(
            "UPDATE clientes SET nome = 'Novo Nome' WHERE id = 1".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn db_execute_does_not_false_positive_on_table_name_in_comment() {
        let app = make_app(setup_db(), session_with_perfil("operador"));
        // "USUARIOS" só aparece num comentário; a tabela real é "clientes"
        let result = db_execute(
            "UPDATE clientes /* nao USUARIOS */ SET nome = 'Novo' WHERE id = 1".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn db_execute_rejects_multi_statement() {
        let app = make_app(setup_db(), session_with_perfil("operador"));
        let result = db_execute(
            "UPDATE clientes SET nome='x' WHERE id=1; DROP TABLE clientes".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn db_execute_batch_rejects_password_column_write() {
        let app = make_app(setup_db(), session_with_perfil("operador"));
        let result = db_execute_batch(
            vec!["UPDATE usuarios SET hash_senha = 'x' WHERE id = 1".to_string()],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn db_execute_batch_rejects_smuggled_statement() {
        let app = make_app(setup_db(), session_with_perfil("operador"));
        // primeiro item parece um SELECT inofensivo, mas embute uma segunda mutação
        let result = db_execute_batch(
            vec!["SELECT 1; UPDATE usuarios SET perfil='admin' WHERE id=1".to_string()],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_err());

        let perfil: String = app
            .state::<DbState>()
            .conn
            .lock()
            .unwrap()
            .as_ref()
            .unwrap()
            .query_row("SELECT perfil FROM usuarios WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(perfil, "admin");
    }

    #[test]
    fn db_execute_batch_allows_normal_batch() {
        let app = make_app(setup_db(), session_with_perfil("operador"));
        let result = db_execute_batch(
            vec![
                "UPDATE clientes SET nome = 'A' WHERE id = 1".to_string(),
                "UPDATE clientes SET nome = 'B' WHERE id = 1".to_string(),
            ],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn db_execute_bootstrap_allows_sensitive_table_when_no_users() {
        // Sem sessão (boot inicial) e sem usuários cadastrados ainda
        let app = make_app(setup_db_no_users(), SessionState::new());
        let result = db_execute(
            "INSERT OR IGNORE INTO perfis (id, nome) VALUES ('admin', 'Administrador')".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            Some(true),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn db_execute_bootstrap_blocked_once_users_exist() {
        // Mesmo com bootstrap=true, mutações não-idempotentes (UPDATE/DELETE/
        // INSERT OR REPLACE) em tabelas sensíveis seguem bloqueadas depois que
        // já existem usuários — só INSERT OR IGNORE (seed idempotente) é liberado.
        let app = make_app(setup_db(), SessionState::new());
        let result = db_execute(
            "UPDATE hierarquia_perfis SET nivel = 99 WHERE perfil = 'operador'".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            Some(true),
        );
        assert!(result.is_err());
    }

    #[test]
    fn db_execute_bootstrap_allows_insert_or_ignore_seed_even_with_existing_users() {
        // ensure-columns roda em todo boot (não só no primeiro); seeds
        // idempotentes de tabelas RBAC (INSERT OR IGNORE) devem continuar
        // funcionando mesmo depois que o admin já foi criado.
        let app = make_app(setup_db(), SessionState::new());
        let result = db_execute(
            "INSERT OR IGNORE INTO hierarquia_perfis (perfil, nivel) VALUES ('coordenador', 2)".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            Some(true),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn db_execute_without_bootstrap_still_blocked_when_no_users() {
        // bootstrap ausente/false não libera o guard, mesmo sem usuários
        let app = make_app(setup_db_no_users(), SessionState::new());
        let result = db_execute(
            "INSERT OR IGNORE INTO perfis (id, nome) VALUES ('admin', 'Administrador')".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_err());
    }
}
