use sha2::{Sha256, Digest};
use std::sync::Mutex;

pub struct CryptoState(pub Mutex<Option<[u8; 32]>>);
pub struct SmtpCryptoState(pub Mutex<Option<[u8; 32]>>);

/// HKDF-SHA256 (RFC 5869) — Extract + Expand with L ≤ 32 bytes.
fn hkdf_sha256(ikm: &[u8], salt: &[u8], info: &[u8], length: usize) -> Vec<u8> {
    assert!(length <= 32, "HKDF output length must be <= 32 bytes");

    let prk = hmac_sha256(salt, ikm);

    let mut data = info.to_vec();
    data.push(1u8);
    let okm = hmac_sha256(&prk, &data);

    okm[..length].to_vec()
}

/// Derive a 32-byte domain-separated key via HKDF-SHA256.
fn derive_domain_key(master_key: &[u8; 32], master_salt: &[u8], context: &[u8]) -> [u8; 32] {
    let okm = hkdf_sha256(master_key, master_salt, context, 32);
    let mut key = [0u8; 32];
    key.copy_from_slice(&okm);
    key
}

/// HMAC-SHA256 (RFC 2104) — manual implementation, no external crate.
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

/// Derive a domain-separated SMTP encryption key from the sync key via HKDF-SHA256.
fn derive_smtp_key(sync_key: &[u8; 32]) -> [u8; 32] {
    derive_domain_key(sync_key, &[0u8; 32], b"ecoforms-smtp-encryption-v1")
}

#[tauri::command]
pub fn load_crypto_key(
    key_bytes: Vec<u8>,
    state: tauri::State<'_, CryptoState>,
    smtp_state: tauri::State<'_, SmtpCryptoState>,
) -> Result<(), String> {
    if key_bytes.len() != 32 {
        return Err("Chave deve ter 32 bytes (AES-256)".to_string());
    }
    let mut key_arr = [0u8; 32];
    key_arr.copy_from_slice(&key_bytes);
    let smtp_key = derive_smtp_key(&key_arr);
    *state.0.lock().unwrap() = Some(key_arr);
    *smtp_state.0.lock().unwrap() = Some(smtp_key);
    Ok(())
}
