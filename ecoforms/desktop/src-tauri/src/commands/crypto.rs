use crate::database::DbState;
use crate::session::SessionState;
use sha2::{Digest, Sha256};
use std::sync::Mutex;

pub struct CryptoState(pub Mutex<Option<[u8; 32]>>);
pub struct SmtpCryptoState(pub Mutex<Option<[u8; 32]>>);

fn hkdf_sha256(ikm: &[u8], salt: &[u8], info: &[u8], length: usize) -> Vec<u8> {
    assert!(length <= 32, "HKDF output length must be <= 32 bytes");

    let prk = hmac_sha256(salt, ikm);

    let mut data = info.to_vec();
    data.push(1u8);
    let okm = hmac_sha256(&prk, &data);

    okm[..length].to_vec()
}

fn derive_domain_key(master_key: &[u8; 32], master_salt: &[u8], context: &[u8]) -> [u8; 32] {
    let okm = hkdf_sha256(master_key, master_salt, context, 32);
    let mut key = [0u8; 32];
    key.copy_from_slice(&okm);
    key
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> Vec<u8> {
    const BLOCK_SIZE: usize = 64;

    let mut key_padded = [0u8; BLOCK_SIZE];
    let k = if key.len() > BLOCK_SIZE {
        let mut h = Sha256::new();
        h.update(key);
        h.finalize().to_vec()
    } else {
        key.to_vec()
    };
    key_padded[..k.len()].copy_from_slice(&k);

    let mut o_key_pad = [0x5cu8; BLOCK_SIZE];
    let mut i_key_pad = [0x36u8; BLOCK_SIZE];
    for i in 0..BLOCK_SIZE {
        o_key_pad[i] ^= key_padded[i];
        i_key_pad[i] ^= key_padded[i];
    }

    let mut inner = Sha256::new();
    inner.update(i_key_pad);
    inner.update(message);
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(o_key_pad);
    outer.update(inner_hash);
    outer.finalize().to_vec()
}

fn derive_smtp_key(sync_key: &[u8; 32]) -> [u8; 32] {
    derive_domain_key(sync_key, &[0u8; 32], b"ecoforms-smtp-encryption-v1")
}

#[tauri::command]
pub fn load_crypto_key(
    key_bytes: Vec<u8>,
    state: tauri::State<'_, CryptoState>,
    smtp_state: tauri::State<'_, SmtpCryptoState>,
    db_state: tauri::State<'_, DbState>,
    session: tauri::State<'_, SessionState>,
) -> Result<(), String> {
    if key_bytes.len() != 32 {
        return Err("Chave deve ter 32 bytes (AES-256)".to_string());
    }

    let conn_guard = db_state
        .conn
        .lock()
        .map_err(|e| format!("Lock poisoned: {e}"))?;
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;
    session.validate_against_db(conn)?;

    let mut key_arr = [0u8; 32];
    key_arr.copy_from_slice(&key_bytes);
    let smtp_key = derive_smtp_key(&key_arr);
    *state.0.lock().unwrap() = Some(key_arr);
    *smtp_state.0.lock().unwrap() = Some(smtp_key);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use tauri::Manager;

    fn setup_db() -> DbState {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE usuarios (id TEXT PRIMARY KEY, perfil TEXT, ativo INTEGER);
             INSERT INTO usuarios (id, perfil, ativo) VALUES ('user-1', 'admin', 1);",
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
        app.manage(CryptoState(Mutex::new(None)));
        app.manage(SmtpCryptoState(Mutex::new(None)));
        app
    }

    #[test]
    fn load_crypto_key_requires_valid_session() {
        let app = make_app(SessionState::new());
        let err = load_crypto_key(
            vec![7; 32],
            app.state::<CryptoState>(),
            app.state::<SmtpCryptoState>(),
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap_err();

        assert!(err.contains("Sessão não iniciada"));
    }

    #[test]
    fn load_crypto_key_accepts_authenticated_session() {
        let session = SessionState::new();
        *session.user_id.lock().unwrap() = Some("user-1".to_string());
        *session.perfil.lock().unwrap() = Some("admin".to_string());
        let app = make_app(session);

        load_crypto_key(
            vec![9; 32],
            app.state::<CryptoState>(),
            app.state::<SmtpCryptoState>(),
            app.state::<DbState>(),
            app.state::<SessionState>(),
        )
        .unwrap();

        assert!(app.state::<CryptoState>().0.lock().unwrap().is_some());
        assert!(app.state::<SmtpCryptoState>().0.lock().unwrap().is_some());
    }
}
