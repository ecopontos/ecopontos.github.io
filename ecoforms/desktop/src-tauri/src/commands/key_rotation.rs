use sha2::{Sha256, Digest};
use rand::Rng;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use tauri::State;
use crate::database::DbState;
use crate::session::SessionState;
use crate::commands::rbac::check_permission;
use crate::commands::audit::log_audit;

/// Derive an AES-256 key from a recovery passphrase using Argon2id (OWASP 2026).
/// Parameters: 64 MiB memory, 3 iterations, 4 parallelism.
pub(crate) fn derive_recovery_key_internal(
    passphrase: &str,
    user_id: &str,
) -> Result<[u8; 32], String> {
    let salt = format!("ecoforms-recovery-v2:{}", user_id);
    let params = Params::new(65536, 3, 4, Some(32))
        .map_err(|e| format!("Invalid Argon2 params: {}", e))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon
        .hash_password_into(passphrase.as_bytes(), salt.as_bytes(), &mut key)
        .map_err(|e| format!("Argon2id key derivation failed: {}", e))?;
    Ok(key)
}

/// Legacy key derivation (SHA-256 × 100k) for backward compatibility.
fn derive_recovery_key_legacy(passphrase: &str) -> [u8; 32] {
    let mut key = [0u8; 32];
    let mut hasher = Sha256::new();
    hasher.update(passphrase.as_bytes());
    for _ in 0..100_000 {
        let mut h = Sha256::new();
        h.update(hasher.finalize_reset());
        h.update(passphrase.as_bytes());
        hasher = h;
    }
    key.copy_from_slice(&hasher.finalize()[..32]);
    key
}

/// Encrypt a salt string with the recovery key (AES-256-GCM)
pub(crate) fn encrypt_salt_internal(salt: &str, recovery_key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(recovery_key).map_err(|e| e.to_string())?;
    let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, salt.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &result))
}

/// Decrypt a salt string with the recovery key
pub fn decrypt_salt(encrypted_b64: &str, recovery_key: &[u8; 32]) -> Result<String, String> {
    let blob = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encrypted_b64)
        .map_err(|e| e.to_string())?;
    if blob.len() < 13 {
        return Err("Blob muito curto".to_string());
    }
    let cipher = Aes256Gcm::new_from_slice(recovery_key).map_err(|e| e.to_string())?;
    let (nonce_bytes, ciphertext) = blob.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| e.to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

/// Generate a new 32-byte hex sync_salt
pub fn generate_salt() -> String {
    let bytes: [u8; 16] = rand::thread_rng().gen();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Hash a salt for integrity verification
fn hash_salt(salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Rotaciona o sync_salt de um usuário, guardando o salt antigo cifrado no escrow.
/// Operação administrativa: requer sessão válida + permissão `system.config`.
#[tauri::command]
pub fn rotate_sync_salt(
    user_id: String,
    recovery_passphrase: String,
    reason: Option<String>,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let conn_guard = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados não conectado")?;

    let (actor_id, actor_perfil) = session.validate_against_db(conn)?;
    check_permission(conn, &actor_perfil, "system.config")?;

    // 1. Get current salt
    let current_salt: String = conn
        .query_row(
            "SELECT sal_sync FROM usuarios WHERE id = ?1",
            [&user_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Falha ao ler salt atual: {}", e))?;

    // 2. Generate new salt
    let new_salt = generate_salt();

    // 3. Derive recovery key from passphrase (Argon2id)
    let recovery_key = derive_recovery_key_internal(&recovery_passphrase, &user_id)?;

    // 4. Encrypt old salt with recovery key → escrow
    let salt_encrypted = encrypt_salt_internal(&current_salt, &recovery_key)?;
    let salt_hash = hash_salt(&current_salt);
    let escrow_id = format!("salt-{}", uuid::Uuid::new_v4());

    // 5. Store encrypted old salt in history (replaced_by = ator da rotação)
    conn.execute(
        "INSERT INTO sync_salt_history (id, user_id, salt_encrypted, salt_hash, replaced_by, reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![escrow_id, user_id, salt_encrypted, salt_hash, actor_id, reason.clone().unwrap_or_default()],
    ).map_err(|e| format!("Falha ao salvar escrow: {}", e))?;

    // 6. Update user with new salt
    conn.execute(
        "UPDATE usuarios SET sal_sync = ?1, atualizado_em = datetime('now') WHERE id = ?2",
        rusqlite::params![new_salt, user_id],
    ).map_err(|e| format!("Falha ao atualizar salt: {}", e))?;

    let _ = log_audit(conn, &actor_id, &actor_perfil, "sync.salt.rotate", Some("usuarios"), Some(&user_id), None, None, reason.as_deref());
    Ok(new_salt)
}

/// Recupera o sync_salt de um usuário a partir do escrow usando a passphrase.
/// Operação administrativa: requer sessão válida + permissão `system.config`.
#[tauri::command]
pub fn recover_sync_salt(
    user_id: String,
    recovery_passphrase: String,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let conn_guard = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados não conectado")?;

    let (actor_id, actor_perfil) = session.validate_against_db(conn)?;
    check_permission(conn, &actor_perfil, "system.config")?;

    let recovery_key = derive_recovery_key_internal(&recovery_passphrase, &user_id)?;
    let recovery_key_legacy = derive_recovery_key_legacy(&recovery_passphrase);

    // Get all historical salts, newest first
    let mut stmt = conn
        .prepare("SELECT salt_encrypted, salt_hash FROM sync_salt_history WHERE user_id = ?1 ORDER BY replaced_at DESC")
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, String)> = stmt
        .query_map([&user_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for (encrypted_b64, expected_hash) in rows {
        // Try Argon2id first, then legacy SHA-256 × 100k
        let decrypted = decrypt_salt(&encrypted_b64, &recovery_key)
            .or_else(|_| decrypt_salt(&encrypted_b64, &recovery_key_legacy));

        match decrypted {
            Ok(decrypted) => {
                // Verify integrity
                if hash_salt(&decrypted) == expected_hash {
                    // Success! Update user with recovered salt
                    conn.execute(
                        "UPDATE usuarios SET sal_sync = ?1, atualizado_em = datetime('now') WHERE id = ?2",
                        rusqlite::params![decrypted, user_id],
                    ).map_err(|e| format!("Falha ao restaurar salt: {}", e))?;
                    let _ = log_audit(conn, &actor_id, &actor_perfil, "sync.salt.recover", Some("usuarios"), Some(&user_id), None, None, None);
                    return Ok(decrypted);
                }
            }
            Err(_) => continue,
        }
    }

    Err("Nenhum salt encontrado com a passphrase fornecida".to_string())
}

/// Lista o histórico de rotações de salt de um usuário.
/// Operação administrativa: requer sessão válida + permissão `system.config`.
#[tauri::command]
pub fn list_salt_history(
    user_id: String,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<Vec<serde_json::Value>, String> {
    let conn_guard = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados não conectado")?;

    let (_actor_id, actor_perfil) = session.validate_against_db(conn)?;
    check_permission(conn, &actor_perfil, "system.config")?;

    let mut stmt = conn
        .prepare("SELECT id, salt_hash, replaced_at, replaced_by, reason FROM sync_salt_history WHERE user_id = ?1 ORDER BY replaced_at DESC")
        .map_err(|e| e.to_string())?;
    
    let rows = stmt
        .query_map([&user_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "salt_hash": row.get::<_, String>(1)?,
                "replaced_at": row.get::<_, String>(2)?,
                "replaced_by": row.get::<_, String>(3)?,
                "reason": row.get::<_, String>(4)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    
    Ok(rows)
}
