use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use std::fs;
use std::path::PathBuf;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::audit::log_audit;
use crate::commands::crypto::CryptoState;
use crate::commands::rbac::check_permission;
use crate::database::DbState;
use crate::session::SessionState;

const DEFAULT_PG_HOST: &str = "172.16.76.202";
const DEFAULT_PG_PORT: u16 = 5432;
const DEFAULT_PG_DB: &str = "geo_fpolis";
const DEFAULT_PG_USER: &str = "smma";

const KEY_HOST: &str = "pg_legacy_host";
const KEY_PORT: &str = "pg_legacy_port";
const KEY_DB: &str = "pg_legacy_db";
const KEY_USER: &str = "pg_legacy_user";
const KEY_PASSWORD_ENC: &str = "pg_legacy_password_encrypted";
const KEY_PASSWORD_ENC_V2: &str = "pg_legacy_password_encrypted_v2";
const KEY_PASSWORD_LEGACY: &str = "pg_legacy_password";

#[derive(Debug, Clone)]
pub(crate) struct PgLegacyRuntimeConfig {
    pub pg_host: String,
    pub pg_port: u16,
    pub pg_db: String,
    pub pg_user: String,
    pub pg_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PgLegacyConfigView {
    pub pg_host: String,
    pub pg_port: u16,
    pub pg_db: String,
    pub pg_user: String,
    pub has_password: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PgLegacyConfigInput {
    pub pg_host: String,
    pub pg_port: u16,
    pub pg_db: String,
    pub pg_user: String,
    pub pg_password: String,
}

fn conn_from_state<'a>(state: &'a State<'_, DbState>) -> Result<std::sync::MutexGuard<'a, Option<Connection>>, String> {
    state.conn.lock().map_err(|e| format!("Database lock poisoned: {e}"))
}

fn backend_key_path(state: &DbState) -> Result<PathBuf, String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|e| format!("Database path lock poisoned: {e}"))?
        .clone()
        .ok_or_else(|| "Caminho do banco não configurado".to_string())?;
    let parent = db_path
        .parent()
        .ok_or_else(|| "Caminho do banco sem diretório pai".to_string())?;
    Ok(parent.join(".ecoforms-pg-legacy.key"))
}

fn read_or_create_backend_key(state: &DbState) -> Result<[u8; 32], String> {
    let path = backend_key_path(state)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to prepare credential key directory: {e}"))?;
    }

    if path.exists() {
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read credential key: {e}"))?;
        let bytes = B64
            .decode(raw.trim())
            .map_err(|e| format!("Invalid credential key encoding: {e}"))?;
        if bytes.len() != 32 {
            return Err("Credential key has invalid length".to_string());
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        return Ok(key);
    }

    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    fs::write(&path, B64.encode(key))
        .map_err(|e| format!("Failed to write credential key: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Failed to restrict credential key permissions: {e}"))?;
    }

    Ok(key)
}

fn read_config_value(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let result: Result<Option<String>, rusqlite::Error> = conn
        .query_row(
            "SELECT valor FROM configuracoes_sistema WHERE chave = ?1 LIMIT 1",
            [key],
            |row| row.get(0),
        )
        .optional();

    match result {
        Ok(value) => Ok(value),
        Err(err) => {
            let msg = err.to_string();
            if msg.contains("no such table") {
                Ok(None)
            } else {
                Err(format!("Failed to read config key {key}: {err}"))
            }
        }
    }
}

fn write_config_value(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO configuracoes_sistema (chave, valor, atualizado_em)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(chave) DO UPDATE SET
             valor = excluded.valor,
             atualizado_em = excluded.atualizado_em",
        params![key, value],
    )
    .map_err(|e| format!("Failed to write config key {key}: {e}"))?;
    Ok(())
}

fn delete_config_value(conn: &Connection, key: &str) -> Result<(), String> {
    conn.execute("DELETE FROM configuracoes_sistema WHERE chave = ?1", [key])
        .map_err(|e| format!("Failed to delete config key {key}: {e}"))?;
    Ok(())
}

fn read_crypto_key(crypto: &CryptoState) -> Result<[u8; 32], String> {
    let guard = crypto.0.lock().map_err(|e| format!("Crypto lock poisoned: {e}"))?;
    guard
        .as_ref()
        .copied()
        .ok_or_else(|| "Chave criptográfica não carregada. Faça login novamente.".to_string())
}

fn encrypt_password(password: &str, key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, password.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut blob = nonce_bytes.to_vec();
    blob.extend(ciphertext);
    Ok(B64.encode(blob))
}

fn decrypt_password(blob_b64: &str, key: &[u8; 32]) -> Result<String, String> {
    let blob = B64.decode(blob_b64).map_err(|e| e.to_string())?;
    if blob.len() < 13 {
        return Err("Encrypted password blob too short".to_string());
    }
    let (nonce_bytes, ciphertext) = blob.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher.decrypt(nonce, ciphertext).map_err(|e| e.to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

fn config_has_password(conn: &Connection) -> Result<bool, String> {
    let encrypted_v2 = read_config_value(conn, KEY_PASSWORD_ENC_V2)?
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let encrypted = read_config_value(conn, KEY_PASSWORD_ENC)?
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let legacy = read_config_value(conn, KEY_PASSWORD_LEGACY)?
        .map(|value| !value.is_empty())
        .unwrap_or(false);

    Ok(encrypted_v2 || encrypted || legacy)
}

fn auth_sync_access(conn: &Connection, session: &SessionState) -> Result<(String, String), String> {
    let (user_id, perfil) = session.validate_against_db(conn)?;
    check_permission(conn, &perfil, "system.sync")?;
    Ok((user_id, perfil))
}

fn read_connection_config(conn: &Connection) -> Result<(String, u16, String, String, bool), String> {
    let host = read_config_value(conn, KEY_HOST)?
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_PG_HOST.to_string());
    let port = read_config_value(conn, KEY_PORT)?
        .and_then(|value| value.trim().parse::<u16>().ok())
        .unwrap_or(DEFAULT_PG_PORT);
    let db = read_config_value(conn, KEY_DB)?
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_PG_DB.to_string());
    let user = read_config_value(conn, KEY_USER)?
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_PG_USER.to_string());
    let has_password = config_has_password(conn)?;

    Ok((host, port, db, user, has_password))
}

fn load_runtime_password(
    conn: &Connection,
    crypto: &CryptoState,
    state: &DbState,
) -> Result<(String, bool), String> {
    let backend_key = read_or_create_backend_key(state)?;

    if let Some(blob) = read_config_value(conn, KEY_PASSWORD_ENC_V2)? {
        if !blob.trim().is_empty() {
            return Ok((decrypt_password(&blob, &backend_key)?, true));
        }
    }

    if let Some(blob) = read_config_value(conn, KEY_PASSWORD_ENC)? {
        if !blob.trim().is_empty() {
            let user_key = read_crypto_key(crypto)?;
            let password = decrypt_password(&blob, &user_key)?;
            let encrypted = encrypt_password(&password, &backend_key)?;
            write_config_value(conn, KEY_PASSWORD_ENC_V2, &encrypted)?;
            delete_config_value(conn, KEY_PASSWORD_ENC)?;
            return Ok((password, true));
        }
    }

    if let Some(legacy_plain) = read_config_value(conn, KEY_PASSWORD_LEGACY)? {
        if legacy_plain.is_empty() {
            return Ok((String::new(), false));
        }
        let encrypted = encrypt_password(&legacy_plain, &backend_key)?;
        write_config_value(conn, KEY_PASSWORD_ENC_V2, &encrypted)?;
        delete_config_value(conn, KEY_PASSWORD_LEGACY)?;
        return Ok((legacy_plain, true));
    }

    Ok((String::new(), false))
}

fn ensure_encrypted_password(
    conn: &Connection,
    crypto: &CryptoState,
    state: &DbState,
) -> Result<(), String> {
    if let Some(blob) = read_config_value(conn, KEY_PASSWORD_ENC_V2)? {
        if !blob.trim().is_empty() {
            return Ok(());
        }
    }

    let _ = load_runtime_password(conn, crypto, state)?;
    Ok(())
}

pub(crate) fn load_pg_legacy_credentials(
    conn: &Connection,
    session: &SessionState,
    crypto: &CryptoState,
    state: &DbState,
) -> Result<PgLegacyRuntimeConfig, String> {
    let _ = auth_sync_access(conn, session)?;
    let (pg_host, pg_port, pg_db, pg_user, _) = read_connection_config(conn)?;
    let (pg_password, _) = load_runtime_password(conn, crypto, state)?;

    Ok(PgLegacyRuntimeConfig {
        pg_host,
        pg_port,
        pg_db,
        pg_user,
        pg_password,
    })
}

pub(crate) fn build_conn_string(config: &PgLegacyRuntimeConfig) -> String {
    format!(
        "host={} port={} dbname={} user={} password={} connect_timeout=5",
        config.pg_host, config.pg_port, config.pg_db, config.pg_user, config.pg_password
    )
}

fn save_pg_legacy_credentials(
    conn: &Connection,
    session: &SessionState,
    crypto: &CryptoState,
    state: &DbState,
    input: &PgLegacyConfigInput,
) -> Result<PgLegacyConfigView, String> {
    let (user_id, perfil) = auth_sync_access(conn, session)?;

    let pg_host = input.pg_host.trim();
    let pg_db = input.pg_db.trim();
    let pg_user = input.pg_user.trim();

    if pg_host.is_empty() {
        return Err("Host do PostgreSQL é obrigatório".to_string());
    }
    if pg_db.is_empty() {
        return Err("Banco do PostgreSQL é obrigatório".to_string());
    }
    if pg_user.is_empty() {
        return Err("Usuário do PostgreSQL é obrigatório".to_string());
    }
    if input.pg_port == 0 {
        return Err("Porta do PostgreSQL é obrigatória".to_string());
    }

    let current_encrypted_present = read_config_value(conn, KEY_PASSWORD_ENC_V2)?
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
        || read_config_value(conn, KEY_PASSWORD_ENC)?
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);
    let current_legacy_present = read_config_value(conn, KEY_PASSWORD_LEGACY)?
        .map(|value| !value.is_empty())
        .unwrap_or(false);

    if input.pg_password.is_empty() && !current_encrypted_present && !current_legacy_present {
        return Err("Senha do PostgreSQL é obrigatória".to_string());
    }

    write_config_value(conn, KEY_HOST, pg_host)?;
    write_config_value(conn, KEY_PORT, &input.pg_port.to_string())?;
    write_config_value(conn, KEY_DB, pg_db)?;
    write_config_value(conn, KEY_USER, pg_user)?;

    if input.pg_password.is_empty() {
        if !current_encrypted_present {
            ensure_encrypted_password(conn, crypto, state)?;
        }
        delete_config_value(conn, KEY_PASSWORD_LEGACY)?;
    } else {
        let key = read_or_create_backend_key(state)?;
        let encrypted = encrypt_password(&input.pg_password, &key)?;
        write_config_value(conn, KEY_PASSWORD_ENC_V2, &encrypted)?;
        delete_config_value(conn, KEY_PASSWORD_ENC)?;
        delete_config_value(conn, KEY_PASSWORD_LEGACY)?;
    }

    let _ = log_audit(
        conn,
        &user_id,
        &perfil,
        "sync.pg_legacy_config.save",
        Some("configuracoes_sistema"),
        None,
        None,
        None,
        Some("Configuracao legado PostgreSQL atualizada"),
    );

    Ok(PgLegacyConfigView {
        pg_host: read_config_value(conn, KEY_HOST)?
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_PG_HOST.to_string()),
        pg_port: read_config_value(conn, KEY_PORT)?
            .and_then(|value| value.trim().parse::<u16>().ok())
            .unwrap_or(DEFAULT_PG_PORT),
        pg_db: read_config_value(conn, KEY_DB)?
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_PG_DB.to_string()),
        pg_user: read_config_value(conn, KEY_USER)?
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_PG_USER.to_string()),
        has_password: config_has_password(conn)?,
    })
}

#[tauri::command]
pub fn pg_legacy_config_get(
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    crypto: State<'_, CryptoState>,
) -> Result<PgLegacyConfigView, String> {
    let conn_guard = conn_from_state(&state)?;
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    let (_user_id, _perfil) = auth_sync_access(conn, &session)?;
    ensure_encrypted_password(conn, &crypto, &state)?;

    let (pg_host, pg_port, pg_db, pg_user, has_password) = read_connection_config(conn)?;

    Ok(PgLegacyConfigView {
        pg_host,
        pg_port,
        pg_db,
        pg_user,
        has_password,
    })
}

#[tauri::command]
pub fn pg_legacy_config_save(
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    crypto: State<'_, CryptoState>,
    config: PgLegacyConfigInput,
) -> Result<PgLegacyConfigView, String> {
    let conn_guard = conn_from_state(&state)?;
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    save_pg_legacy_credentials(conn, &session, &crypto, &state, &config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbState;
    use crate::session::SessionState;
    use std::sync::Mutex;
    use tauri::Manager;

    fn setup_db() -> DbState {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE usuarios (id TEXT PRIMARY KEY, perfil TEXT, ativo INTEGER);
             CREATE TABLE hierarquia_perfis (perfil TEXT PRIMARY KEY, nivel INTEGER);
             CREATE TABLE permissoes (perfil TEXT, permissao TEXT);
             CREATE TABLE configuracoes_sistema (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TEXT);
             INSERT INTO usuarios (id, perfil, ativo) VALUES ('user-1', 'admin', 1);
             INSERT INTO hierarquia_perfis (perfil, nivel) VALUES ('admin', 0), ('operador', 4);
             INSERT INTO permissoes (perfil, permissao) VALUES ('admin', 'system.sync');",
        )
        .unwrap();
        DbState {
            conn: Mutex::new(Some(conn)),
            db_path: Mutex::new(Some(std::env::temp_dir().join(format!(
                "ecoforms-legacy-sync-test-{}.db",
                uuid::Uuid::new_v4().simple()
            )))),
        }
    }

    fn make_app(db: DbState, session: SessionState, crypto: CryptoState) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(db);
        app.manage(session);
        app.manage(crypto);
        app
    }

    fn admin_session() -> SessionState {
        let session = SessionState::new();
        *session.user_id.lock().unwrap() = Some("user-1".to_string());
        *session.perfil.lock().unwrap() = Some("admin".to_string());
        session
    }

    fn crypto_state() -> CryptoState {
        CryptoState(Mutex::new(Some([7u8; 32])))
    }

    #[test]
    fn encrypt_and_decrypt_password_roundtrip() {
        let key = [3u8; 32];
        let encrypted = encrypt_password("segredo", &key).unwrap();
        let decrypted = decrypt_password(&encrypted, &key).unwrap();
        assert_eq!(decrypted, "segredo");
    }

    #[test]
    fn save_and_get_config_roundtrip() {
        let app = make_app(setup_db(), admin_session(), crypto_state());
        let result = pg_legacy_config_save(
            app.state::<DbState>(),
            app.state::<SessionState>(),
            app.state::<CryptoState>(),
            PgLegacyConfigInput {
                pg_host: "10.0.0.1".to_string(),
                pg_port: 5433,
                pg_db: "geo".to_string(),
                pg_user: "sync".to_string(),
                pg_password: "senha-top".to_string(),
            },
        )
        .unwrap();

        assert_eq!(result.pg_host, "10.0.0.1");
        assert!(result.has_password);

        let view = pg_legacy_config_get(
            app.state::<DbState>(),
            app.state::<SessionState>(),
            app.state::<CryptoState>(),
        )
        .unwrap();
        assert_eq!(view.pg_host, "10.0.0.1");
        assert_eq!(view.pg_port, 5433);
        assert_eq!(view.pg_db, "geo");
        assert_eq!(view.pg_user, "sync");
        assert!(view.has_password);

        let db_state = app.state::<DbState>();
        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        let stored: Option<String> = conn
            .query_row(
                "SELECT valor FROM configuracoes_sistema WHERE chave = ?1",
                [KEY_PASSWORD_ENC_V2],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        assert!(stored.is_some());
        assert_ne!(stored.unwrap(), "senha-top");
    }

    #[test]
    fn blank_password_keeps_existing_encrypted_value() {
        let app = make_app(setup_db(), admin_session(), crypto_state());
        let first = pg_legacy_config_save(
            app.state::<DbState>(),
            app.state::<SessionState>(),
            app.state::<CryptoState>(),
            PgLegacyConfigInput {
                pg_host: "10.0.0.1".to_string(),
                pg_port: 5433,
                pg_db: "geo".to_string(),
                pg_user: "sync".to_string(),
                pg_password: "senha-top".to_string(),
            },
        )
        .unwrap();
        assert!(first.has_password);

        let before = {
            let db_state = app.state::<DbState>();
            let conn_guard = db_state.conn.lock().unwrap();
            let conn = conn_guard.as_ref().unwrap();
            conn.query_row(
                "SELECT valor FROM configuracoes_sistema WHERE chave = ?1",
                [KEY_PASSWORD_ENC_V2],
                |row| row.get::<_, String>(0),
            )
            .unwrap()
        };

        let second = pg_legacy_config_save(
            app.state::<DbState>(),
            app.state::<SessionState>(),
            app.state::<CryptoState>(),
            PgLegacyConfigInput {
                pg_host: "10.0.0.2".to_string(),
                pg_port: 5434,
                pg_db: "geo2".to_string(),
                pg_user: "sync2".to_string(),
                pg_password: String::new(),
            },
        )
        .unwrap();

        assert_eq!(second.pg_host, "10.0.0.2");
        assert!(second.has_password);

        let after = {
            let db_state = app.state::<DbState>();
            let conn_guard = db_state.conn.lock().unwrap();
            let conn = conn_guard.as_ref().unwrap();
            conn.query_row(
                "SELECT valor FROM configuracoes_sistema WHERE chave = ?1",
                [KEY_PASSWORD_ENC_V2],
                |row| row.get::<_, String>(0),
            )
            .unwrap()
        };
        assert_eq!(before, after);
    }

    #[test]
    fn legacy_plaintext_password_is_migrated_on_get() {
        let db = setup_db();
        {
            let conn_guard = db.conn.lock().unwrap();
            let conn = conn_guard.as_ref().unwrap();
            conn.execute(
                "INSERT INTO configuracoes_sistema (chave, valor, atualizado_em) VALUES ('pg_legacy_password', 'legacy-pass', datetime('now'))",
                [],
            )
            .unwrap();
        }

        let app = make_app(db, admin_session(), crypto_state());
        let view = pg_legacy_config_get(
            app.state::<DbState>(),
            app.state::<SessionState>(),
            app.state::<CryptoState>(),
        )
        .unwrap();

        assert!(view.has_password);
        let db_state = app.state::<DbState>();
        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        let enc: Option<String> = conn
            .query_row(
                "SELECT valor FROM configuracoes_sistema WHERE chave = ?1",
                [KEY_PASSWORD_ENC_V2],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        assert!(enc.is_some());
        let legacy: Option<String> = conn
            .query_row(
                "SELECT valor FROM configuracoes_sistema WHERE chave = ?1",
                [KEY_PASSWORD_LEGACY],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        assert!(legacy.is_none());
    }

    #[test]
    fn save_config_requires_permission() {
        let db = setup_db();
        {
            let conn_guard = db.conn.lock().unwrap();
            let conn = conn_guard.as_ref().unwrap();
            conn.execute("INSERT INTO usuarios (id, perfil, ativo) VALUES ('user-2', 'operador', 1)", [])
                .unwrap();
        }

        let session = SessionState::new();
        *session.user_id.lock().unwrap() = Some("user-2".to_string());
        *session.perfil.lock().unwrap() = Some("operador".to_string());
        let app = make_app(db, session, crypto_state());

        let err = pg_legacy_config_get(
            app.state::<DbState>(),
            app.state::<SessionState>(),
            app.state::<CryptoState>(),
        )
        .unwrap_err();
        assert!(err.contains("Permissão negada"));
    }
}
