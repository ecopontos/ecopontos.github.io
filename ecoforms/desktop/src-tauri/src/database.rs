use rusqlite::{Connection, Result as SqliteResult, Row, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use crate::lan_paths;
use crate::session::SessionState;

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: usize,
}

const SENSITIVE_TABLES: [&str; 6] = [
    "USUARIOS", "PERFIS",
    "ROLE_HIERARCHY", "HIERARQUIA_PERFIS",
    "PERMISSIONS", "PERMISSOES",
];

const BOOTSTRAP_COUNT_QUERY_TABLES: [&str; 8] = [
    "TIPOS_PRAZO",
    "TIPOS_MANIFESTACAO",
    "SITUACOES",
    "ORIGENS",
    "CLASSIFICACOES",
    "TIPOS_RESIDUO",
    "TIPOS_INTERCORRENCIA",
    "TIPOS_SERVICO",
];

const BOOTSTRAP_INSERT_IGNORE_TABLES: [&str; 9] = [
    "TIPOS_PRAZO",
    "TIPOS_MANIFESTACAO",
    "SITUACOES",
    "ORIGENS",
    "CLASSIFICACOES",
    "TIPOS_RESIDUO",
    "TIPOS_INTERCORRENCIA",
    "CONFIGURACOES_SISTEMA",
    "TIPOS_SERVICO",
];

const BOOTSTRAP_COPY_INSERT_TABLES: [&str; 5] = [
    "CLIENTE_PJ_VINCULO",
    "ENVIOS_RESPOSTA",
    "EXECUCAO_COLETA",
    "REGISTRO_MODULOS",
    "VISUAIS_MODULOS",
];

const BOOTSTRAP_UPDATE_TABLES: [&str; 2] = ["TIPOS_MANIFESTACAO", "TIPOS_SERVICO"];
const BOOTSTRAP_DELETE_TABLES: [&str; 2] = ["FILA_EVENTOS_SYNC", "LOG_AUDITORIA"];
const BOOTSTRAP_INSERT_IGNORE_PERMISSION_TABLES: [&str; 1] = ["PERMISSOES_MODULOS"];

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

fn is_admin_profile(conn: &Connection, perfil: &str) -> bool {
    let nivel: Option<i64> = conn
        .query_row(
            "SELECT nivel FROM hierarquia_perfis WHERE perfil = ?1",
            [perfil],
            |row| row.get(0),
        )
        .optional()
        .unwrap_or(None);
    nivel == Some(0)
}

fn is_bootstrap_metadata_query(normalized: &str) -> bool {
    let upper = normalized.trim().to_uppercase();
    if upper.starts_with("PRAGMA TABLE_INFO(") {
        return true;
    }
    if upper.contains("FROM SQLITE_MASTER") {
        return true;
    }
    if upper.contains("FROM PRAGMA_TABLE_INFO(") {
        return true;
    }
    if upper.starts_with("SELECT COUNT(*)") {
        return BOOTSTRAP_COUNT_QUERY_TABLES
            .iter()
            .any(|table| upper.contains(&format!("FROM {table}")));
    }
    false
}

fn is_bootstrap_other_allowed(normalized: &str) -> bool {
    let upper = normalized.trim().to_uppercase();
    [
        "CREATE TABLE",
        "CREATE INDEX",
        "CREATE UNIQUE INDEX",
        "CREATE VIEW",
        "CREATE TRIGGER",
        "CREATE VIRTUAL TABLE",
        "ALTER TABLE",
        "DROP TABLE",
        "PRAGMA FOREIGN_KEYS = ON",
        "PRAGMA FOREIGN_KEYS = OFF",
    ]
    .iter()
    .any(|prefix| upper.starts_with(prefix))
}

fn is_bootstrap_execute_allowed(
    normalized: &str,
    kind: &crate::sql_guard::StatementKind,
) -> bool {
    let target = crate::sql_guard::extract_target_table(normalized, kind);
    match kind {
        crate::sql_guard::StatementKind::Insert => {
            if let Some(table) = target.as_deref() {
                if crate::sql_guard::is_insert_or_ignore(normalized)
                    && (BOOTSTRAP_INSERT_IGNORE_TABLES.contains(&table)
                        || BOOTSTRAP_INSERT_IGNORE_PERMISSION_TABLES.contains(&table))
                {
                    return true;
                }
                if BOOTSTRAP_COPY_INSERT_TABLES.contains(&table)
                    && normalized.trim().to_uppercase().contains("SELECT")
                {
                    return true;
                }
            }
            false
        }
        crate::sql_guard::StatementKind::Update => target
            .as_deref()
            .map(|table| BOOTSTRAP_UPDATE_TABLES.contains(&table))
            .unwrap_or(false),
        crate::sql_guard::StatementKind::Delete => target
            .as_deref()
            .map(|table| BOOTSTRAP_DELETE_TABLES.contains(&table))
            .unwrap_or(false),
        crate::sql_guard::StatementKind::Other => is_bootstrap_other_allowed(normalized),
        crate::sql_guard::StatementKind::Select => false,
    }
}

fn require_valid_session(
    conn: &Connection,
    session: &SessionState,
    bootstrap_allowed: bool,
) -> Result<Option<(String, String)>, String> {
    match session.validate_against_db(conn) {
        Ok(auth) => Ok(Some(auth)),
        Err(err) if bootstrap_allowed => Ok(None),
        Err(err) => Err(err),
    }
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
    session: State<'_, SessionState>,
    bootstrap: Option<bool>,
) -> Result<QueryResult, String> {
    let normalized = crate::sql_guard::strip_comments_and_strings(&sql);
    if !crate::sql_guard::is_single_statement(&normalized) {
        return Err("db_query aceita apenas um statement por vez".to_string());
    }

    let bootstrap_allowed = bootstrap.unwrap_or(false) && is_bootstrap_metadata_query(&normalized);
    let statement_kind = crate::sql_guard::statement_kind(&normalized);
    if !bootstrap_allowed && statement_kind != crate::sql_guard::StatementKind::Select {
        return Err("db_query aceita apenas SELECT/WITH (somente leitura)".to_string());
    }

    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    require_valid_session(conn, &session, bootstrap_allowed)?;

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

    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    let bootstrap_allowed = bootstrap.unwrap_or(false)
        && is_bootstrap_execute_allowed(&normalized, &kind);
    let auth = require_valid_session(conn, &session, bootstrap_allowed)?;
    let is_admin = auth
        .as_ref()
        .map(|(_, perfil)| is_admin_profile(conn, perfil))
        .unwrap_or(false);

    if is_mutation && !is_admin {
        if let Some(table) = crate::sql_guard::extract_target_table(&normalized, &kind) {
            // usuarios: always block regardless of bootstrap — prevents unauthenticated admin seeding
            if table.as_str() == "USUARIOS" {
                return Err("Tabela usuarios só pode ser modificada por administradores".to_string());
            }
            // Other sensitive tables: block unless bootstrap (e.g. ensure-columns RBAC seed)
            if SENSITIVE_TABLES.contains(&table.as_str()) && !bootstrap_allowed {
                return Err(format!("Tabela {} só pode ser modificada por administradores", table));
            }
        }
    }

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

/// Statement parametrizado para transações atômicas vindas do webview.
#[derive(Debug, Serialize, Deserialize)]
pub struct SqlStatementInput {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<serde_json::Value>,
}

fn validate_transaction_sql(
    sql: &str,
    is_admin: bool,
    bootstrap: bool,
) -> Result<(), String> {
    let normalized = crate::sql_guard::strip_comments_and_strings(sql);
    if !crate::sql_guard::is_single_statement(&normalized) {
        return Err("Cada item da transação deve conter apenas um statement".to_string());
    }

    let kind = crate::sql_guard::statement_kind(&normalized);
    const FORBIDDEN_COLUMNS: [&str; 2] = ["PASSWORD_HASH", "HASH_SENHA"];
    if crate::sql_guard::extract_set_columns(&normalized)
        .iter()
        .any(|c| FORBIDDEN_COLUMNS.contains(&c.as_str()))
    {
        return Err("Coluna de senha não permitida em transação".to_string());
    }

    let is_mutation = matches!(
        kind,
        crate::sql_guard::StatementKind::Insert
            | crate::sql_guard::StatementKind::Update
            | crate::sql_guard::StatementKind::Delete
    );

    let bootstrap_allowed = bootstrap && is_bootstrap_execute_allowed(&normalized, &kind);

    if is_mutation && !is_admin {
        const SENSITIVE_TABLES: [&str; 6] = [
            "USUARIOS", "PERFIS",
            "ROLE_HIERARCHY", "HIERARQUIA_PERFIS",
            "PERMISSIONS", "PERMISSOES",
        ];
        if let Some(table) = crate::sql_guard::extract_target_table(&normalized, &kind) {
            if table.as_str() == "USUARIOS" {
                return Err("Tabela usuarios só pode ser modificada por administradores".to_string());
            }
            if SENSITIVE_TABLES.contains(&table.as_str()) && !bootstrap_allowed {
                return Err(format!("Tabela {} só pode ser modificada por administradores", table));
            }
        }
    }

    Ok(())
}

/// Executa múltiplos comandos SQL em uma transação
#[tauri::command]
pub fn db_execute_batch(
    sqls: Vec<String>,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    bootstrap: Option<bool>,
) -> Result<(), String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or_else(|| "Database not connected".to_string())?;
    let bootstrap_flag = bootstrap.unwrap_or(false);
    let batch_bootstrap_allowed = bootstrap_flag && sqls.iter().all(|sql| {
        let normalized = crate::sql_guard::strip_comments_and_strings(sql);
        let kind = crate::sql_guard::statement_kind(&normalized);
        is_bootstrap_execute_allowed(&normalized, &kind)
    });
    let auth = require_valid_session(conn, &session, batch_bootstrap_allowed)?;
    let is_admin = auth
        .as_ref()
        .map(|(_, perfil)| is_admin_profile(conn, perfil))
        .unwrap_or(false);

    for sql in &sqls {
        validate_transaction_sql(sql, is_admin, bootstrap_flag)?;
    }

    drop(conn_guard);

    let mut conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_mut()
        .ok_or_else(|| "Database not connected".to_string())?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Batch transaction failed: {}", e))?;
    for sql in &sqls {
        tx.execute(sql, [])
            .map_err(|e| format!("Batch execute failed: {}", e))?;
    }
    tx.commit()
        .map_err(|e| format!("Batch commit failed: {}", e))?;

    Ok(())
}

/// Executa uma transação parametrizada com statements atômicos.
#[tauri::command]
pub fn db_transaction(
    statements: Vec<SqlStatementInput>,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    bootstrap: Option<bool>,
) -> Result<(), String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard.as_ref().ok_or_else(|| "Database not connected".to_string())?;
    let bootstrap_flag = bootstrap.unwrap_or(false);
    let tx_bootstrap_allowed = bootstrap_flag && statements.iter().all(|stmt| {
        let normalized = crate::sql_guard::strip_comments_and_strings(&stmt.sql);
        let kind = crate::sql_guard::statement_kind(&normalized);
        is_bootstrap_execute_allowed(&normalized, &kind)
    });
    let auth = require_valid_session(conn, &session, tx_bootstrap_allowed)?;
    let is_admin = auth
        .as_ref()
        .map(|(_, perfil)| is_admin_profile(conn, perfil))
        .unwrap_or(false);

    for stmt in &statements {
        validate_transaction_sql(&stmt.sql, is_admin, bootstrap_flag)?;
    }

    drop(conn_guard);

    let mut conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_mut()
        .ok_or_else(|| "Database not connected".to_string())?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Transaction begin failed: {}", e))?;
    for stmt in &statements {
        let sql_params_storage: Vec<Box<dyn rusqlite::ToSql>> =
            stmt.params.iter().map(json_to_sql).collect();
        let sql_params_refs: Vec<&dyn rusqlite::ToSql> =
            sql_params_storage.iter().map(|b| b.as_ref()).collect();
        tx.execute(&stmt.sql, &sql_params_refs[..])
            .map_err(|e| format!("Transaction execute failed: {}", e))?;
    }
    tx.commit()
        .map_err(|e| format!("Transaction commit failed: {}", e))?;

    Ok(())
}
/// Retorna o último ID inserido
#[tauri::command]
pub fn db_has_users(state: State<'_, DbState>) -> Result<bool, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    Ok(!no_users_exist(conn))
}

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
    destination: String,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    require_mobile_export_admin(conn, &session)?;

    let export_root = resolve_mobile_export_root(conn, &state, &destination)?;
    let file_name = format!("ecoforms_mobile_{}.db", chrono::Utc::now().format("%Y-%m-%d"));
    let relative_path = format!("mobile_exports/{file_name}");
    let export_pb = lan_paths::confine_relative_path(&export_root, &relative_path, false)?;

    if export_pb.exists() {
        std::fs::remove_file(&export_pb)
            .map_err(|e| format!("Failed to replace existing export file: {e}"))?;
    }

    if let Some(parent) = export_pb.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create export directory: {e}"))?;
        }
    }

    // Backup: SQLite backup API (cópia consistente sem travar o banco principal)
    let mut export_conn = rusqlite::Connection::open(&export_pb)
        .map_err(|e| format!("Failed to open export DB: {e}"))?;

    {
        let backup = rusqlite::backup::Backup::new(conn, &mut export_conn)
            .map_err(|e| format!("Backup init failed: {e}"))?;

        backup
            .run_to_completion(100, std::time::Duration::from_millis(10), None)
            .map_err(|e| format!("Backup failed: {e}"))?;
    } // backup dropped here — mutable borrow released

    // Limpar dados sensíveis do arquivo exportado
    export_conn
        .execute("PRAGMA foreign_keys = OFF", [])
        .ok();

    // Nomes reais das tabelas (PT-BR, ver scripts/ensure-columns.ts). Antes
    // estes DELETEs usavam nomes EN obsoletos (tbl_audit_log, sync_event_queue,
    // ...) que não existem; com `.ok()` o erro era silenciado e os dados
    // sensíveis (audit log, fila de eventos, manifests) PERMANECIAM no backup
    // exportado. `sync_status` foi removido (não existe no schema).
    export_conn.execute("DELETE FROM log_auditoria", []).ok();
    export_conn.execute("DELETE FROM fila_eventos_sync", []).ok();
    export_conn.execute("DELETE FROM fila_eventos_lan", []).ok();
    export_conn.execute("DELETE FROM log_dispositivos_sync", []).ok();
    export_conn.execute("DELETE FROM log_gaps_sync", []).ok();
    export_conn.execute("DELETE FROM cursor_sync", []).ok();
    export_conn.execute("DELETE FROM manifesto_sync", []).ok();
    export_conn.execute("DELETE FROM log_eventos_aplicados", []).ok();

    // Remover dados sensíveis de usuários
    export_conn
        .execute("UPDATE usuarios SET hash_senha = '', sal_sync = ''", [])
        .ok();

    // Reconstruir sem espaços vazios
    export_conn.execute("VACUUM", []).ok();

    Ok(relative_path)
}

#[tauri::command]
pub fn db_read_mobile_export(
    destination: String,
    path: String,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    require_mobile_export_admin(conn, &session)?;
    validate_mobile_export_relative_path(&path)?;

    let export_root = resolve_mobile_export_root(conn, &state, &destination)?;
    let export_path = lan_paths::confine_relative_path(&export_root, &path, false)?;
    if !export_path.is_file() {
        return Err("Arquivo de exportação mobile não encontrado".to_string());
    }

    let bytes = std::fs::read(&export_path)
        .map_err(|e| format!("Falha ao ler exportação mobile: {e}"))?;
    Ok(base64_encode(&bytes))
}

fn require_mobile_export_admin(
    conn: &Connection,
    session: &SessionState,
) -> Result<(), String> {
    let (_user_id, perfil) = session.validate_against_db(conn)?;
    let nivel: Option<i64> = conn
        .query_row(
            "SELECT nivel FROM hierarquia_perfis WHERE perfil = ?1",
            [&perfil],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to resolve user permissions: {e}"))?;
    if nivel != Some(0) {
        return Err("Somente administradores podem exportar o banco mobile".to_string());
    }
    Ok(())
}

fn resolve_mobile_export_root(
    conn: &Connection,
    state: &DbState,
    destination: &str,
) -> Result<PathBuf, String> {
    let db_path_guard = state.db_path.lock().unwrap();
    let source_path = db_path_guard
        .as_ref()
        .ok_or_else(|| "No database path available".to_string())?;

    let export_root = match destination {
        "" | "appdata" => source_path
            .parent()
            .ok_or_else(|| "Cannot determine AppData export root".to_string())?
            .to_path_buf(),
        "lan" => lan_paths::resolve_lan_base_path(conn)?,
        other => return Err(format!("Invalid export destination: {other}")),
    };

    lan_paths::canonicalize_base_dir(&export_root)
}

fn validate_mobile_export_relative_path(path: &str) -> Result<(), String> {
    let normalized = path.replace('\\', "/");
    let file_name = normalized
        .strip_prefix("mobile_exports/")
        .ok_or_else(|| "Caminho de exportação mobile inválido".to_string())?;

    if file_name.contains('/') || file_name.contains('\\') {
        return Err("Caminho de exportação mobile inválido".to_string());
    }
    if !file_name.starts_with("ecoforms_mobile_") || !file_name.ends_with(".db") {
        return Err("Arquivo de exportação mobile inválido".to_string());
    }
    Ok(())
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
            "CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT, perfil TEXT, hash_senha TEXT, ativo INTEGER);
             CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);
             CREATE TABLE hierarquia_perfis (perfil TEXT PRIMARY KEY, nivel INTEGER);
             INSERT INTO usuarios (id, nome, perfil, hash_senha, ativo) VALUES (1, 'admin', 'admin', 'secret', 1);
             INSERT INTO usuarios (id, nome, perfil, hash_senha, ativo) VALUES (2, 'operador', 'operador', 'secret', 1);
             INSERT INTO clientes (id, nome) VALUES (1, 'Cliente A');
             INSERT INTO hierarquia_perfis (perfil, nivel) VALUES ('admin', 0), ('operador', 5);",
        )
        .unwrap();
        DbState {
            conn: Mutex::new(Some(conn)),
            db_path: Mutex::new(None),
        }
    }

    fn authenticated_session(user_id: &str, perfil: &str) -> SessionState {
        let session = SessionState::new();
        *session.user_id.lock().unwrap() = Some(user_id.to_string());
        *session.perfil.lock().unwrap() = Some(perfil.to_string());
        session
    }

    fn session_with_perfil(perfil: &str) -> SessionState {
        let user_id = if perfil == "operador" { "2" } else { "1" };
        authenticated_session(user_id, perfil)
    }

    /// Banco "fresco" de bootstrap: tabela `usuarios` existe mas está vazia
    /// (nenhum usuário criado ainda), simulando o primeiro boot do app.
    fn setup_db_no_users() -> DbState {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT, perfil TEXT, hash_senha TEXT, ativo INTEGER);
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
    fn mobile_export_path_validation_accepts_generated_shape() {
        assert!(validate_mobile_export_relative_path("mobile_exports/ecoforms_mobile_2026-06-29.db").is_ok());
        assert!(validate_mobile_export_relative_path(r"mobile_exports\ecoforms_mobile_2026-06-29.db").is_ok());
    }

    #[test]
    fn mobile_export_path_validation_rejects_escape_and_unexpected_file() {
        assert!(validate_mobile_export_relative_path("../ecoforms_mobile_2026-06-29.db").is_err());
        assert!(validate_mobile_export_relative_path("mobile_exports/../ecoforms_mobile_2026-06-29.db").is_err());
        assert!(validate_mobile_export_relative_path("mobile_exports/other.db").is_err());
        assert!(validate_mobile_export_relative_path("mobile_exports/ecoforms_mobile_2026-06-29.sqlite").is_err());
    }

    #[test]
    fn db_query_blocks_password_column() {
        let app = make_app(setup_db(), authenticated_session("1", "admin"));
        let result = db_query(
            "SELECT id, hash_senha FROM usuarios".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn db_query_allows_normal_select() {
        let app = make_app(setup_db(), authenticated_session("1", "admin"));
        let result = db_query(
            "SELECT id, nome FROM clientes".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn db_query_rejects_mutation_and_does_not_execute_it() {
        let app = make_app(setup_db(), authenticated_session("1", "admin"));
        let result = db_query(
            "UPDATE clientes SET nome = 'Hackeado' WHERE id = 1".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
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
        let app = make_app(setup_db(), authenticated_session("1", "admin"));
        let result = db_query(
            "SELECT 1; DROP TABLE clientes".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
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
    fn db_execute_bootstrap_allows_schema_ddl_when_no_users() {
        // Sem sessão (boot inicial) e sem usuários cadastrados ainda
        let app = make_app(setup_db_no_users(), SessionState::new());
        let result = db_execute(
            "CREATE TABLE IF NOT EXISTS tipos_manifestacao (id TEXT PRIMARY KEY, nome TEXT)".to_string(),
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
    fn db_execute_bootstrap_rejects_sensitive_rbac_seed_even_with_existing_users() {
        // Seeds RBAC agora passam por comando Rust dedicado; o SQL genérico não
        // deve mais aceitar INSERT OR IGNORE em tabelas sensíveis.
        let app = make_app(setup_db(), SessionState::new());
        let result = db_execute(
            "INSERT OR IGNORE INTO hierarquia_perfis (perfil, nivel) VALUES ('coordenador', 2)".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            Some(true),
        );
        assert!(result.is_err());
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


#[cfg(test)]
mod auth_tests_additional {
    use super::*;
    use tauri::Manager;

    fn setup_db() -> DbState {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT, perfil TEXT, hash_senha TEXT, ativo INTEGER);
             CREATE TABLE clientes (id INTEGER PRIMARY KEY, nome TEXT);
             CREATE TABLE hierarquia_perfis (perfil TEXT PRIMARY KEY, nivel INTEGER);
             INSERT INTO usuarios (id, nome, perfil, hash_senha, ativo) VALUES (1, 'admin', 'admin', 'secret', 1);
             INSERT INTO usuarios (id, nome, perfil, hash_senha, ativo) VALUES (2, 'operador', 'operador', 'secret', 1);
             INSERT INTO clientes (id, nome) VALUES (1, 'Cliente A');
             INSERT INTO hierarquia_perfis (perfil, nivel) VALUES ('admin', 0), ('operador', 5);",
        )
        .unwrap();
        DbState {
            conn: Mutex::new(Some(conn)),
            db_path: Mutex::new(None),
        }
    }

    fn make_app(db: DbState, session: SessionState) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(db);
        app.manage(session);
        app
    }

    #[test]
    fn db_query_requires_session_without_bootstrap() {
        let app = make_app(setup_db(), SessionState::new());
        let err = db_query(
            "SELECT id, nome FROM clientes".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            None,
        )
        .unwrap_err();

        assert!(err.contains("Sessão não iniciada"));
    }

    #[test]
    fn db_has_users_reports_existing_rows() {
        let app = make_app(setup_db(), SessionState::new());
        assert!(db_has_users(app.state::<DbState>()).unwrap());
    }

    #[test]
    fn db_query_bootstrap_rejects_data_read() {
        let app = make_app(setup_db(), SessionState::new());
        let err = db_query(
            "SELECT id, nome FROM clientes".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            Some(true),
        )
        .unwrap_err();

        assert!(err.contains("Sessão não iniciada"));
    }

    #[test]
    fn db_query_bootstrap_allows_schema_metadata() {
        let app = make_app(setup_db(), SessionState::new());
        let result = db_query(
            "PRAGMA table_info('clientes')".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            Some(true),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn db_execute_bootstrap_rejects_arbitrary_update() {
        let app = make_app(setup_db(), SessionState::new());
        let err = db_execute(
            "UPDATE clientes SET nome = 'X' WHERE id = 1".to_string(),
            vec![],
            app.state::<DbState>(),
            app.state::<SessionState>(),
            Some(true),
        )
        .unwrap_err();

        assert!(err.contains("Sessão não iniciada"));
    }
}
