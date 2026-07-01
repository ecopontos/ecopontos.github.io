use serde::{Deserialize, Serialize};
use tauri::State;
use crate::database::DbState;
use crate::commands::crypto::SmtpCryptoState;
use crate::session::SessionState;
use crate::commands::audit::log_audit;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use lettre::{
    message::Mailbox,
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailConfig {
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_password: String,
    pub from_email: String,
    pub from_name: String,
    pub use_tls: bool,
    pub enabled: bool,
}

fn decrypt_blob(blob: &[u8], key: &[u8; 32]) -> Result<String, String> {
    if blob.len() < 13 {
        return Err("Encrypted password blob too short".into());
    }
    let (nonce_bytes, ciphertext) = blob.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher.decrypt(nonce, ciphertext).map_err(|e| e.to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

fn encrypt_password(password: &str, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let nonce_bytes: [u8; 12] = rand::random();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, password.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut blob = nonce_bytes.to_vec();
    blob.extend(ciphertext);
    Ok(blob)
}

struct EmailConfigRaw {
    smtp_host: String,
    smtp_port: i64,
    smtp_user: String,
    smtp_password: String,
    smtp_password_encrypted: Option<Vec<u8>>,
    from_email: String,
    from_name: String,
    use_tls: i64,
    enabled: i64,
}

fn load_config(db: &rusqlite::Connection, crypto: Option<&SmtpCryptoState>) -> Result<EmailConfig, String> {
    let result = db.query_row(
        "SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_password_encrypted,
                from_email, from_name, use_tls, enabled
         FROM configuracao_email WHERE id = 'default'",
        [],
        |row| Ok(EmailConfigRaw {
            smtp_host: row.get(0)?,
            smtp_port: row.get(1)?,
            smtp_user: row.get(2)?,
            smtp_password: row.get(3)?,
            smtp_password_encrypted: row.get(4)?,
            from_email: row.get(5)?,
            from_name: row.get(6)?,
            use_tls: row.get(7)?,
            enabled: row.get(8)?,
        }),
    );

    match result {
        Ok(raw) => {
            let password = match raw.smtp_password_encrypted {
                Some(blob) if !blob.is_empty() => {
                    let guard = crypto
                        .ok_or("Crypto key not loaded. Login required to decrypt email password.")?
                        .0.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
                    let key = guard.as_ref().ok_or("Crypto key not loaded. Login required.")?;
                    decrypt_blob(&blob, key)?
                }
                _ => raw.smtp_password,
            };

            Ok(EmailConfig {
                smtp_host: raw.smtp_host,
                smtp_port: raw.smtp_port as u16,
                smtp_user: raw.smtp_user,
                smtp_password: password,
                from_email: raw.from_email,
                from_name: raw.from_name,
                use_tls: raw.use_tls != 0,
                enabled: raw.enabled != 0,
            })
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err("Configuração de e-mail não encontrada. Configure o SMTP em Configurações > E-mail.".to_string())
        }
        Err(e) if e.to_string().contains("no such column: smtp_password_encrypted") => {
            // Legacy table without encrypted column — fallback
            let raw = db.query_row(
                "SELECT smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name, use_tls, enabled
                 FROM configuracao_email WHERE id = 'default'",
                [],
                |row| Ok(EmailConfigRaw {
                    smtp_host: row.get(0)?,
                    smtp_port: row.get(1)?,
                    smtp_user: row.get(2)?,
                    smtp_password: row.get(3)?,
                    smtp_password_encrypted: None,
                    from_email: row.get(4)?,
                    from_name: row.get(5)?,
                    use_tls: row.get(6)?,
                    enabled: row.get(7)?,
                }),
            ).map_err(|e| e.to_string())?;

            Ok(EmailConfig {
                smtp_host: raw.smtp_host,
                smtp_port: raw.smtp_port as u16,
                smtp_user: raw.smtp_user,
                smtp_password: raw.smtp_password,
                from_email: raw.from_email,
                from_name: raw.from_name,
                use_tls: raw.use_tls != 0,
                enabled: raw.enabled != 0,
            })
        }
        Err(other) => Err(other.to_string()),
    }
}


#[tauri::command]
pub fn send_email(
    state: State<DbState>,
    crypto: State<SmtpCryptoState>,
    session: State<SessionState>,
    to: String,
    subject: String,
    body: String,
) -> Result<(), String> {
    let config = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let db = conn.as_ref().ok_or("Database not connected")?;
        load_config(db, Some(&crypto))?
    };

    if !config.enabled {
        return Err("Envio de e-mail está desabilitado. Ative-o em Configurações > E-mail.".to_string());
    }

    let from: Mailbox = format!("{} <{}>", config.from_name, config.from_email)
        .parse()
        .map_err(|e| format!("E-mail de origem inválido: {}", e))?;

    let to_addr: Mailbox = to.parse()
        .map_err(|_| format!("Endereço de e-mail inválido: {}", to))?;

    let email = Message::builder()
        .from(from)
        .to(to_addr)
        .subject(&subject)
        .body(body)
        .map_err(|e| format!("Erro ao montar e-mail: {}", e))?;

    let creds = Credentials::new(config.smtp_user.clone(), config.smtp_password.clone());

    let mailer = if config.use_tls {
        SmtpTransport::starttls_relay(&config.smtp_host)
            .map_err(|e| format!("Erro SMTP: {}", e))?
            .port(config.smtp_port)
            .credentials(creds)
            .build()
    } else {
        SmtpTransport::builder_dangerous(&config.smtp_host)
            .port(config.smtp_port)
            .credentials(creds)
            .build()
    };

    mailer.send(&email).map_err(|e| format!("Falha ao enviar: {}", e))?;

    let user_id = session.user_id.lock().map_err(|e| format!("Lock poisoned: {}", e))?
        .clone().unwrap_or_default();
    let perfil = session.perfil.lock().map_err(|e| format!("Lock poisoned: {}", e))?
        .clone().unwrap_or_default();
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let db = conn.as_ref().ok_or("Database not connected")?;
    let _ = log_audit(db, &user_id, &perfil, "email.send", None, None, None, Some(&to), None);

    Ok(())
}

#[tauri::command]
pub fn test_email_connection(state: State<DbState>, crypto: State<SmtpCryptoState>) -> Result<String, String> {
    let config = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let db = conn.as_ref().ok_or("Database not connected")?;
        load_config(db, Some(&crypto))?
    };

    let creds = Credentials::new(config.smtp_user.clone(), config.smtp_password.clone());

    let mailer = if config.use_tls {
        SmtpTransport::starttls_relay(&config.smtp_host)
            .map_err(|e| format!("Erro SMTP: {}", e))?
            .port(config.smtp_port)
            .credentials(creds)
            .build()
    } else {
        SmtpTransport::builder_dangerous(&config.smtp_host)
            .port(config.smtp_port)
            .credentials(creds)
            .build()
    };

    mailer
        .test_connection()
        .map_err(|e| format!("Falha na conexão: {}", e))?;

    Ok(format!("Conexão OK — {}:{}", config.smtp_host, config.smtp_port))
}

#[tauri::command]
pub fn migrate_smtp_password(state: State<DbState>, crypto: State<SmtpCryptoState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let db = conn.as_ref().ok_or("Database not connected")?;

    let guard = crypto.0.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let key = guard.as_ref().ok_or("Crypto key not loaded. Login required.")?;

    // Ensure encrypted column exists
    db.execute("ALTER TABLE configuracao_email ADD COLUMN smtp_password_encrypted BLOB", [])
        .map_err(|e| {
            if e.to_string().contains("duplicate column name") {
                rusqlite::Error::QueryReturnedNoRows // silenced
            } else {
                e
            }
        })
        .ok();

    // Read plaintext password
    let plaintext: String = db.query_row(
        "SELECT smtp_password FROM configuracao_email WHERE id = 'default'",
        [],
        |row| row.get(0),
    ).unwrap_or_default();

    if plaintext.is_empty() {
        return Ok("No plaintext password to migrate.".into());
    }

    let blob = encrypt_password(&plaintext, key)?;
    db.execute(
        "UPDATE configuracao_email SET smtp_password_encrypted = ?1, smtp_password = '' WHERE id = 'default'",
        [&blob],
    ).map_err(|e| e.to_string())?;

    Ok("SMTP password encrypted successfully.".into())
}
