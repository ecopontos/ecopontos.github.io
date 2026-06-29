use rusqlite::OptionalExtension;
use serde::Serialize;
use tauri::State;

use crate::check_password;
use crate::database::{row_value_to_json, DbState};
use crate::session::{set_session, SessionState};

/// Colunas que nunca devem ser devolvidas ao frontend, mesmo neste command
/// dedicado de login (a verificação de senha já ocorre aqui, em Rust).
const SENSITIVE_COLUMNS: [&str; 3] = ["hash_senha", "password_hash", "sal_sync"];

#[derive(Debug, Serialize)]
pub struct LoginResult {
    pub found: bool,
    pub password_valid: bool,
    pub user: Option<serde_json::Value>,
}

fn json_value_to_string(value: &serde_json::Value) -> Option<String> {
    value
        .as_str()
        .map(ToOwned::to_owned)
        .or_else(|| value.as_i64().map(|v| v.to_string()))
        .or_else(|| value.as_u64().map(|v| v.to_string()))
        .or_else(|| value.as_f64().map(|v| v.to_string()))
        .or_else(|| value.as_bool().map(|v| v.to_string()))
}

fn new_sync_salt() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

/// Busca um usuário por `nome_usuario` e verifica a senha em Rust, sem nunca
/// expor `hash_senha`/`password_hash`/`sal_sync` ao frontend (diferente de
/// `db_query`, que bloqueia a leitura dessas colunas por completo).
#[tauri::command]
pub fn db_login(
    username: String,
    password: String,
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<LoginResult, String> {
    let (columns, values) = {
        let conn_guard = state.conn.lock().unwrap();
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| "Database not connected".to_string())?;

        let mut stmt = conn
            .prepare("SELECT * FROM usuarios WHERE nome_usuario = ?1 LIMIT 1")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

        let values = stmt
            .query_row([&username], |row| {
                let mut values = Vec::new();
                for i in 0..columns.len() {
                    values.push(row_value_to_json(row, i)?);
                }
                Ok(values)
            })
            .optional()
            .map_err(|e| format!("Query failed: {}", e))?;

        let Some(values) = values else {
            return Ok(LoginResult {
                found: false,
                password_valid: false,
                user: None,
            });
        };

        (columns, values)
    };

    let hash_senha = columns
        .iter()
        .position(|c| c.eq_ignore_ascii_case("hash_senha"))
        .and_then(|i| values[i].as_str())
        .unwrap_or("");

    let password_valid = check_password(&password, hash_senha);

    let mut user = serde_json::Map::new();
    for (col, value) in columns.iter().zip(values.iter()) {
        let lower = col.to_lowercase();
        if SENSITIVE_COLUMNS.iter().any(|c| *c == lower) {
            continue;
        }
        user.insert(col.clone(), value.clone());
    }

    if !password_valid {
        return Ok(LoginResult {
            found: true,
            password_valid: false,
            user: None,
        });
    }

    let user_id = columns
        .iter()
        .position(|c| c.eq_ignore_ascii_case("id"))
        .and_then(|i| json_value_to_string(&values[i]))
        .ok_or_else(|| "Usuário sem identificador válido".to_string())?;

    let perfil = columns
        .iter()
        .position(|c| c.eq_ignore_ascii_case("perfil"))
        .and_then(|i| json_value_to_string(&values[i]))
        .ok_or_else(|| "Usuário sem perfil válido".to_string())?;

    set_session(user_id.clone(), perfil, state.clone(), session)?;

    if !hash_senha.starts_with("$2") {
        let new_hash = bcrypt::hash(&password, 12)
            .map_err(|e| format!("Bcrypt hash error: {}", e))?;
        let conn_guard = state.conn.lock().unwrap();
        let conn = conn_guard
            .as_ref()
            .ok_or_else(|| "Database not connected".to_string())?;
        conn.execute(
            "UPDATE usuarios SET hash_senha = ?1, atualizado_em = datetime('now') WHERE id = ?2",
            rusqlite::params![new_hash, user_id],
        )
        .map_err(|e| format!("Failed to migrate password hash: {}", e))?;
    }

    Ok(LoginResult {
        found: true,
        password_valid: true,
        user: Some(serde_json::Value::Object(user)),
    })
}

#[tauri::command]
pub fn get_or_create_own_sync_salt(
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;
    let (user_id, _) = session.validate_against_db(conn)?;

    let existing = conn
        .query_row(
            "SELECT sal_sync FROM usuarios WHERE id = ?1 LIMIT 1",
            [&user_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read sync salt: {}", e))?
        .flatten()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(salt) = existing {
        return Ok(salt);
    }

    let salt = new_sync_salt();
    conn.execute(
        "UPDATE usuarios SET sal_sync = ?1, atualizado_em = datetime('now') WHERE id = ?2",
        rusqlite::params![salt, user_id],
    )
    .map_err(|e| format!("Failed to store sync salt: {}", e))?;

    Ok(salt)
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::session::{get_session, set_session, SessionState};
    use rusqlite::{params, Connection};
    use tauri::Manager;

    fn setup_db(active: i64) -> DbState {
        let conn = Connection::open_in_memory().unwrap();
        let password_hash = bcrypt::hash("Senha123", 12).unwrap();
        conn.execute_batch(
            "CREATE TABLE usuarios (id TEXT PRIMARY KEY, nome_usuario TEXT, nome TEXT, hash_senha TEXT, perfil TEXT, ativo INTEGER, sal_sync TEXT);
             INSERT INTO usuarios (id, nome_usuario, nome, hash_senha, perfil, ativo, sal_sync) VALUES ('user-1', 'alice', 'Alice', 'REPLACE_ME', 'admin', 1, 'salt-1');",
        )
        .unwrap();
        conn.execute(
            "UPDATE usuarios SET hash_senha = ?1, ativo = ?2 WHERE id = 'user-1'",
            params![password_hash, active],
        )
        .unwrap();
        DbState {
            conn: std::sync::Mutex::new(Some(conn)),
            db_path: std::sync::Mutex::new(None),
        }
    }

    fn make_app(db: DbState, session: SessionState) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(db);
        app.manage(session);
        app
    }

    #[test]
    fn db_login_sets_session_on_success() {
        let app = make_app(setup_db(1), SessionState::new());
        let result = db_login(
            "alice".to_string(),
            "Senha123".to_string(),
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap();

        assert!(result.found);
        assert!(result.password_valid);
        assert!(result.user.is_some());

        let session = get_session(app.state::<SessionState>()).unwrap().unwrap();
        assert_eq!(session.user_id, "user-1");
        assert_eq!(session.perfil, "admin");
    }

    #[test]
    fn db_login_rejects_inactive_user_without_session() {
        let app = make_app(setup_db(0), SessionState::new());
        let err = db_login(
            "alice".to_string(),
            "Senha123".to_string(),
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap_err();

        assert!(err.contains("Usuário inativo"));
        assert!(get_session(app.state::<SessionState>()).unwrap().is_none());
    }

    #[test]
    fn db_login_wrong_password_does_not_create_session() {
        let app = make_app(setup_db(1), SessionState::new());
        let result = db_login(
            "alice".to_string(),
            "SenhaErrada".to_string(),
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap();

        assert!(result.found);
        assert!(!result.password_valid);
        assert!(result.user.is_none());
        assert!(get_session(app.state::<SessionState>()).unwrap().is_none());
    }

    #[test]
    fn get_or_create_own_sync_salt_returns_existing_salt_for_authenticated_user() {
        let app = make_app(setup_db(1), SessionState::new());
        db_login(
            "alice".to_string(),
            "Senha123".to_string(),
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap();

        let salt = get_or_create_own_sync_salt(
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap();

        assert_eq!(salt, "salt-1");
    }

    #[test]
    fn set_session_rejects_forged_profile() {
        let app = make_app(setup_db(1), SessionState::new());
        let result = set_session(
            "user-1".to_string(),
            "operador".to_string(),
            app.state::<DbState>(),
            app.state::<SessionState>(),
        );

        assert!(result.is_err());
        assert!(get_session(app.state::<SessionState>()).unwrap().is_none());
    }
}
