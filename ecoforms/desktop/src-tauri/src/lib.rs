mod database;
mod network;
mod supabase_admin;
mod session;
mod sql_guard;
pub mod commands;

use database::DbState;
use commands::crypto::{CryptoState, SmtpCryptoState};
use session::SessionState;
use sha2::{Sha256, Digest};
use tauri::Manager;
use std::sync::Mutex;

/// Verifica uma senha contra um hash bcrypt ou SHA-256 hex.
/// Hash vazio ou inválido resulta em `false` (não em erro), pois esta função
/// é usada em fluxos de login onde "senha incorreta" e "hash ausente"
/// devem ser tratados da mesma forma pelo chamador.
pub(crate) fn check_password(password: &str, hash: &str) -> bool {
    if hash.starts_with("$2") {
        // Bcrypt hash — verify using bcrypt
        bcrypt::verify(password, hash).unwrap_or(false)
    } else if hash.is_empty() {
        false
    } else {
        // SHA-256 hex hash — compare
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let result = hasher.finalize();
        let hex_hash = hex::encode(result);
        hex_hash == hash
    }
}

#[tauri::command]
fn verify_password(password: String, hash: String) -> Result<bool, String> {
    Ok(check_password(&password, &hash))
}

#[tauri::command]
fn hash_password(password: String) -> Result<String, String> {
    bcrypt::hash(&password, 12).map_err(|e| format!("Bcrypt hash error: {}", e))
}

#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        Err("Devtools não disponíveis em builds de release".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log::info!("Starting Tauri Application...");
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }

                // Dev-only: log first-login.txt path on first boot
                let app_data = app.path().app_data_dir().ok();
                if let Some(app_data) = app_data {
                    let creds_path: std::path::PathBuf = app_data.join("first-login.txt");
                    if creds_path.exists() {
                        println!("🔑  first-login.txt: {}", creds_path.display());
                    }
                }
            }
            Ok(())
        })
        .manage(DbState::new())
        .manage(SessionState::new())
        .manage(supabase_admin::SupabaseAdminState::new())
        .manage(CryptoState(Mutex::new(None)))
        .manage(SmtpCryptoState(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            database::db_connect,
            database::db_query,
            database::db_execute,
            database::db_execute_batch,
            database::db_last_insert_id,
            database::db_export_for_mobile,
            session::set_session,
            session::clear_session,
            session::get_session,
            commands::auth::db_login,
            commands::actions::demanda_aceitar,
            commands::actions::demanda_encerrar,
            commands::actions::ecoponto_agendar_remocao,
            verify_password,
            hash_password,
            network::network_probe_path,
            network::network_list_parquet,
            network::network_write_parquet,
            network::fetch_cep,
            supabase_admin::supabase_admin_query,
            supabase_admin::supabase_admin_status,
            commands::crypto::load_crypto_key,
            commands::setup::create_first_admin,
            commands::email::send_email,
            commands::email::test_email_connection,
            commands::email::migrate_smtp_password,
            commands::lan_storage::lan_read_file,
            commands::lan_storage::lan_write_file,
            commands::lan_storage::lan_list_dir,
            commands::sync_roteiros::sync_roteiros_externos,
            commands::sync_roteiros::sync_roteiros_status,
            commands::sync_pesagens::sync_pesagens_externas,
            commands::sync_residuos::fetch_residuos_externos,
            commands::sync_residuos::sync_residuos_externos,
            commands::key_rotation::rotate_sync_salt,
            commands::key_rotation::recover_sync_salt,
            commands::key_rotation::list_salt_history,
            toggle_devtools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

