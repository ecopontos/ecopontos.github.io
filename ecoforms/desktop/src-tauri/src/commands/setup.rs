use rand::Rng;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri::State;
use crate::commands::audit::log_audit;
use crate::database::DbState;
use crate::session::SessionState;
use crate::uuid_v7::uuid_v7_string;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateFirstAdminResult {
    pub id: String,
    pub username: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BootstrapSeedUserInput {
    pub id: Option<String>,
    pub nome: String,
    pub username: String,
    pub password: String,
    pub perfil: String,
    pub setor: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct BootstrapSeedUserSummary {
    pub id: String,
    pub nome: String,
    pub username: String,
    pub perfil: String,
    pub setor: Option<String>,
}

fn ensure_no_active_session(session: &SessionState) -> Result<(), String> {
    let has_user = session
        .user_id
        .lock()
        .map_err(|e| format!("Session lock poisoned: {}", e))?
        .is_some();
    let has_profile = session
        .perfil
        .lock()
        .map_err(|e| format!("Session lock poisoned: {}", e))?
        .is_some();

    if has_user || has_profile {
        return Err("Sessão ativa detectada. Use o fluxo autenticado para alterar configuração local.".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn bootstrap_seed_rbac(
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    // Idempotent no-op regardless of session state: container bootstrapping
    // (ensureColumnsIfNeeded) calls this command on every app access, including
    // when a user is already logged in. Once RBAC is seeded there is nothing
    // sensitive left to do, so this check must run before the session guard.
    let perfis_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM perfis", [], |row| row.get(0))
        .map_err(|e| format!("Erro ao verificar perfis existentes: {}", e))?;
    if perfis_count > 0 {
        return Ok(());
    }

    ensure_no_active_session(&session)?;

    let existing_users: i64 = conn
        .query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get(0))
        .unwrap_or(0);
    if existing_users > 0 {
        return Err("Seed RBAC de bootstrap só pode rodar antes da criação do primeiro usuário.".to_string());
    }

    seed_rbac_tables(conn)
}

#[tauri::command]
pub fn bootstrap_set_lan_sync_path(
    path: String,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    ensure_no_active_session(&session)?;

    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    let existing_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get(0))
        .unwrap_or(0);
    if existing_count > 0 {
        return Err("Configuração inicial só pode alterar lan_sync_path antes do primeiro login.".to_string());
    }

    conn.execute(
        "INSERT INTO configuracoes_sistema (chave, valor, atualizado_em)
         VALUES ('lan_sync_path', ?1, datetime('now'))
         ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em",
        [path.trim()],
    )
    .map_err(|e| format!("Erro ao salvar lan_sync_path: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn bootstrap_import_seed_users(
    users: Vec<BootstrapSeedUserInput>,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<Vec<BootstrapSeedUserSummary>, String> {
    ensure_no_active_session(&session)?;
    if users.is_empty() {
        return Ok(Vec::new());
    }

    let requested_usernames: HashSet<String> = users
        .iter()
        .map(|user| user.username.trim().to_string())
        .collect();
    if requested_usernames.len() != users.len() {
        return Err("Seed contém usernames duplicados.".to_string());
    }

    let mut conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_mut()
        .ok_or_else(|| "Database not connected".to_string())?;

    seed_rbac_tables(conn)?;

    let existing_usernames: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT nome_usuario FROM usuarios")
            .map_err(|e| format!("Erro ao ler usuários existentes: {}", e))?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Erro ao iterar usuários existentes: {}", e))?;
        let mut usernames = Vec::new();
        for row in rows {
            usernames.push(row.map_err(|e| format!("Erro ao ler usuário existente: {}", e))?);
        }
        usernames
    };

    if existing_usernames
        .iter()
        .any(|username| !requested_usernames.contains(username))
    {
        return Err("Já existem usuários locais fora do seed inicial. Refusei importar novos usuários sem autenticação.".to_string());
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("Erro ao iniciar transação de seed: {}", e))?;
    let mut summaries = Vec::with_capacity(users.len());
    let now = chrono::Utc::now().to_rfc3339();

    for user in users {
        let nome = user.nome.trim();
        let username = user.username.trim();
        if nome.len() < 2 {
            return Err(format!("Nome inválido para usuário seed: {}", username));
        }
        if username.len() < 3 || username.contains(' ') {
            return Err(format!("Username inválido no seed: {}", username));
        }

        let password_hash = bcrypt::hash(user.password.trim(), 12)
            .map_err(|e| format!("Erro ao gerar hash do seed {}: {}", username, e))?;
        let salt: [u8; 32] = rand::thread_rng().gen();
        let sync_salt = hex::encode(salt);
        let generated_id = user.id.unwrap_or_else(uuid_v7_string);
        let ativo = if user.ativo.unwrap_or(true) { 1 } else { 0 };
        let perfil = user.perfil.trim().to_string();

        tx.execute(
            "INSERT OR IGNORE INTO usuarios (id, nome_usuario, nome, hash_senha, perfil, ativo, id_organizacao, sal_sync, criado_em, atualizado_em)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'ecoforms-org-001', ?7, ?8, ?8)",
            params![generated_id, username, nome, password_hash, perfil, ativo, sync_salt, now],
        )
        .map_err(|e| format!("Erro ao inserir usuário seed {}: {}", username, e))?;

        let resolved_id: String = tx
            .query_row(
                "SELECT id FROM usuarios WHERE nome_usuario = ?1 LIMIT 1",
                [username],
                |row| row.get(0),
            )
            .map_err(|e| format!("Erro ao resolver id do usuário seed {}: {}", username, e))?;

        let setor = user
            .setor
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        if let Some(setor_id) = &setor {
            tx.execute(
                "INSERT OR IGNORE INTO usuarios_setores (usuario_id, setor_id) VALUES (?1, ?2)",
                [&resolved_id, setor_id],
            )
            .map_err(|e| format!("Erro ao vincular setor do usuário seed {}: {}", username, e))?;
        }

        summaries.push(BootstrapSeedUserSummary {
            id: resolved_id,
            nome: nome.to_string(),
            username: username.to_string(),
            perfil,
            setor,
        });
    }

    tx.commit()
        .map_err(|e| format!("Erro ao confirmar seed inicial: {}", e))?;

    Ok(summaries)
}

/// Política de senha do primeiro admin: mínimo 8 caracteres, com pelo menos
/// uma letra e um dígito. Substitui a antiga exigência de "só números".
fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Senha deve ter pelo menos 8 caracteres, com letras e números.".to_string());
    }
    if !password.chars().any(|c| c.is_ascii_alphabetic()) {
        return Err("Senha deve ter pelo menos 8 caracteres, com letras e números.".to_string());
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err("Senha deve ter pelo menos 8 caracteres, com letras e números.".to_string());
    }
    Ok(())
}

/// Cria o primeiro administrador do sistema.
/// Só funciona quando usuarios está vazia (instalação limpa).
/// Proteção contra re-execução: falha se já houver usuários.
#[tauri::command]
pub fn create_first_admin(
    nome: String,
    username: String,
    password: String,
    state: State<'_, DbState>,
) -> Result<CreateFirstAdminResult, String> {
    // 1. Validar inputs
    let nome = nome.trim();
    let username = username.trim();
    let password = password.trim();

    if nome.len() < 2 {
        return Err("Nome completo deve ter pelo menos 2 caracteres.".to_string());
    }
    if username.len() < 3 {
        return Err("Username deve ter pelo menos 3 caracteres.".to_string());
    }
    if username.contains(' ') {
        return Err("Username não pode conter espaços.".to_string());
    }
    validate_password(password)?;

    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    // 2. Proteção: falhar se já existir algum usuário
    let existing_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get(0))
        .map_err(|e| format!("Erro ao verificar usuarios existentes: {}", e))?;

    if existing_count > 0 {
        return Err("Ja existem usuarios no sistema. Use a tela de login.".to_string());
    }

    // 3. Gerar ID, hash da senha e sync_salt
    let user_id = uuid_v7_string();
    let password_hash = bcrypt::hash(password, 12)
        .map_err(|e| format!("Erro ao hash senha: {}", e))?;

    let salt: [u8; 32] = rand::thread_rng().gen();
    let sync_salt = hex::encode(salt);

    let now = chrono::Utc::now().to_rfc3339();
    let default_org = "ecoforms-org-001";

    // 4. Seed RBAC tables antes do INSERT (FK perfil → perfis)
    seed_rbac_tables(conn)?;

    // 5. Inserir admin
    conn.execute(
        "INSERT INTO usuarios (id, nome_usuario, nome, hash_senha, perfil, ativo, id_organizacao, sal_sync, criado_em, atualizado_em)
         VALUES (?1, ?2, ?3, ?4, 'admin', 1, ?5, ?6, ?7, ?7)",
        [&user_id, username, nome, &password_hash, default_org, &sync_salt, &now],
    ).map_err(|e| format!("Erro ao criar administrador: {}", e))?;

    // 6. Log de auditoria
    let metadata = format!("{{\"bootstrap\":true,\"username\":\"{}\"}}", username);
    let _ = log_audit(
        conn,
        "system",
        "system",
        "system.bootstrap",
        Some("usuarios"),
        Some(&user_id),
        None,
        Some(&format!("{{\"nome\":\"{}\",\"username\":\"{}\",\"perfil\":\"admin\"}}", nome, username)),
        Some(&metadata),
    );

    Ok(CreateFirstAdminResult {
        id: user_id,
        username: username.to_string(),
    })
}

/// Semeia o admin padrão (admin/admin) no boot, reutilizável diretamente sobre a conexão.
/// ADR-051 (Gap 3, revisado): chamado a partir de `db_connect`, não exposto como command Tauri,
/// e somente quando `cfg!(debug_assertions) && std::env::var("ECOFORMS_SEED_ADMIN").is_ok()` —
/// builds release nunca chamam esta função; builds debug exigem opt-in explícito via env.
///
/// Tolerante e idempotente:
/// - no-op (`Ok(None)`) se a tabela `usuarios` ainda não existe (boot antes do schema);
/// - no-op (`Ok(None)`) se já houver qualquer usuário;
/// - cria o admin padrão e retorna `Ok(Some(user_id))` apenas em base com schema e sem usuários.
pub fn seed_default_admin_conn(conn: &Connection) -> Result<Option<String>, String> {
    // Boot order: db_connect roda antes de ensure-columns.ts. Em install fresco a tabela
    // ainda não existe — nesse caso saímos silenciosamente e o seed efetiva no boot seguinte.
    let table_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='usuarios'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if table_exists == 0 {
        return Ok(None);
    }

    let existing_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get(0))
        .map_err(|e| format!("Erro ao verificar usuarios existentes: {}", e))?;
    if existing_count > 0 {
        return Ok(None);
    }

    let user_id = uuid_v7_string();
    let password_hash = bcrypt::hash("admin", 12)
        .map_err(|e| format!("Erro ao hash senha: {}", e))?;

    let salt: [u8; 32] = rand::thread_rng().gen();
    let sync_salt = hex::encode(salt);
    let now = chrono::Utc::now().to_rfc3339();

    seed_rbac_tables(conn)?;

    conn.execute(
        "INSERT INTO usuarios (id, nome_usuario, nome, hash_senha, perfil, ativo, id_organizacao, sal_sync, criado_em, atualizado_em)
         VALUES (?1, 'admin', 'Administrador', ?2, 'admin', 1, 'ecoforms-org-001', ?3, ?4, ?4)",
        [&user_id, &password_hash, &sync_salt, &now],
    ).map_err(|e| format!("Erro ao criar admin padrao: {}", e))?;

    let _ = log_audit(
        conn,
        "system",
        "system",
        "system.seed_admin",
        Some("usuarios"),
        Some(&user_id),
        None,
        Some("{\"bootstrap\":true,\"default\":true,\"username\":\"admin\"}"),
        Some("{\"source\":\"db_connect\"}"),
    );

    Ok(Some(user_id))
}

/// Popula perfis, hierarquia_perfis e permissoes se estiverem vazias.
pub fn seed_rbac_tables(conn: &Connection) -> Result<(), String> {
    let perfis_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM perfis", [], |row| row.get(0))
        .unwrap_or(0);

    if perfis_count > 0 {
        return Ok(());
    }

    const RBAC_SEED_SQL: &str = include_str!("rbac_seed.sql");
    conn.execute_batch(RBAC_SEED_SQL)
        .map_err(|e| format!("Erro ao seed RBAC: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::Manager;

    fn setup_db() -> DbState {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE perfis (id TEXT PRIMARY KEY, nome TEXT, descricao TEXT);
             CREATE TABLE hierarquia_perfis (perfil TEXT PRIMARY KEY, nivel INTEGER, descricao TEXT);
             CREATE TABLE permissoes (perfil TEXT, permissao TEXT, PRIMARY KEY (perfil, permissao));
             CREATE TABLE usuarios (
                 id TEXT PRIMARY KEY,
                 nome_usuario TEXT NOT NULL UNIQUE,
                 nome TEXT NOT NULL,
                 hash_senha TEXT NOT NULL,
                 perfil TEXT NOT NULL,
                 ativo INTEGER NOT NULL DEFAULT 1,
                 id_organizacao TEXT,
                 sal_sync TEXT,
                 criado_em TEXT,
                 atualizado_em TEXT
             );
             CREATE TABLE usuarios_setores (
                 usuario_id TEXT NOT NULL,
                 setor_id TEXT NOT NULL,
                 PRIMARY KEY (usuario_id, setor_id)
             );
             CREATE TABLE configuracoes_sistema (
                 chave TEXT PRIMARY KEY,
                 valor TEXT NOT NULL,
                 descricao TEXT,
                 atualizado_em TEXT
             );",
        )
        .unwrap();
        DbState {
            conn: std::sync::Mutex::new(Some(conn)),
            db_path: std::sync::Mutex::new(None),
        }
    }

    fn make_app(session: SessionState) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(setup_db());
        app.manage(session);
        app
    }

    #[test]
    fn rejects_short_numeric_only_password() {
        assert!(validate_password("1234").is_err());
    }

    #[test]
    fn rejects_long_alpha_only_password() {
        assert!(validate_password("abcdefgh").is_err());
    }

    #[test]
    fn rejects_long_numeric_only_password() {
        assert!(validate_password("12345678").is_err());
    }

    #[test]
    fn accepts_mixed_alphanumeric_password() {
        assert!(validate_password("abc12345").is_ok());
    }

    #[test]
    fn bootstrap_set_lan_sync_path_requires_empty_user_table() {
        let app = make_app(SessionState::new());
        bootstrap_import_seed_users(
            vec![BootstrapSeedUserInput {
                id: Some("user-1".to_string()),
                nome: "Alice".to_string(),
                username: "alice".to_string(),
                password: "Senha123".to_string(),
                perfil: "admin".to_string(),
                setor: None,
                ativo: Some(true),
            }],
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap();

        let err = bootstrap_set_lan_sync_path(
            "/tmp/ecoforms".to_string(),
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap_err();

        assert!(err.contains("primeiro login"));
    }

    #[test]
    fn bootstrap_import_seed_users_is_idempotent_for_same_seed() {
        let app = make_app(SessionState::new());
        let input = vec![BootstrapSeedUserInput {
            id: Some("user-1".to_string()),
            nome: "Alice".to_string(),
            username: "alice".to_string(),
            password: "Senha123".to_string(),
            perfil: "admin".to_string(),
            setor: Some("setor-a".to_string()),
            ativo: Some(true),
        }];

        let first = bootstrap_import_seed_users(input.clone(), app.state::<DbState>(), app.state::<SessionState>()).unwrap();
        let second = bootstrap_import_seed_users(input, app.state::<DbState>(), app.state::<SessionState>()).unwrap();

        assert_eq!(first.len(), 1);
        assert_eq!(second.len(), 1);
        assert_eq!(first[0].username, "alice");
        assert_eq!(second[0].id, first[0].id);
    }

    #[test]
    fn seed_rbac_tables_restricts_system_sync_to_admin_and_gerente() {
        let app = make_app(SessionState::new());
        let db_state = app.state::<DbState>();
        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        seed_rbac_tables(conn).unwrap();

        let mut stmt = conn
            .prepare("SELECT perfil FROM permissoes WHERE permissao = 'system.sync' ORDER BY perfil")
            .unwrap();
        let roles: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(Result::ok)
            .collect();

        assert_eq!(roles, vec!["admin".to_string(), "gerente".to_string()]);
    }

    #[test]
    fn seed_rbac_tables_sets_campo_and_operador_to_same_level() {
        let app = make_app(SessionState::new());
        let db_state = app.state::<DbState>();
        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        seed_rbac_tables(conn).unwrap();

        let campo_level: i64 = conn
            .query_row("SELECT nivel FROM hierarquia_perfis WHERE perfil = 'campo'", [], |row| row.get(0))
            .unwrap();
        let operador_level: i64 = conn
            .query_row("SELECT nivel FROM hierarquia_perfis WHERE perfil = 'operador'", [], |row| row.get(0))
            .unwrap();

        assert_eq!(campo_level, operador_level);
        assert_eq!(campo_level, 4);
    }

    #[test]
    fn seed_rbac_tables_seeds_36_permission_kinds_across_6_perfis() {
        let app = make_app(SessionState::new());
        let db_state = app.state::<DbState>();
        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        seed_rbac_tables(conn).unwrap();

        let perfis_count: i64 = conn.query_row("SELECT COUNT(*) FROM perfis", [], |row| row.get(0)).unwrap();
        let distinct_permissoes: i64 = conn
            .query_row("SELECT COUNT(DISTINCT permissao) FROM permissoes", [], |row| row.get(0))
            .unwrap();

        assert_eq!(perfis_count, 6);
        assert_eq!(distinct_permissoes, 36);
    }
}
