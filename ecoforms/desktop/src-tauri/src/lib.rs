mod database;
mod network;
mod supabase_admin;
mod session;
mod sql_guard;
mod lan_paths;
mod uuid_v7;
pub mod commands;
pub mod lan_server;

use database::DbState;
use commands::crypto::{CryptoState, SmtpCryptoState};
use session::SessionState;
use sha2::{Sha256, Digest};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
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
fn toggle_devtools(_window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        if _window.is_devtools_open() {
            _window.close_devtools();
        } else {
            _window.open_devtools();
        }
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        Err("Devtools não disponíveis em builds de release".into())
    }
}

#[allow(deprecated)]
#[tauri::command]
fn open_whatsapp_url(app: tauri::AppHandle, phone: String, text: String) -> Result<(), String> {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 10 || digits.len() > 15 {
        return Err("Número de WhatsApp inválido".to_string());
    }

    let normalized_phone = if digits.starts_with("55") {
        digits
    } else {
        format!("55{digits}")
    };

    if normalized_phone.len() < 12 || normalized_phone.len() > 15 {
        return Err("Número de WhatsApp inválido".to_string());
    }

    let encoded_text: String = url_encode_component(&text);
    let url = format!("https://wa.me/{normalized_phone}?text={encoded_text}");
    app.shell()
        .open(url, None)
        .map_err(|e| format!("Falha ao abrir WhatsApp: {e}"))
}

fn url_encode_component(input: &str) -> String {
    let mut out = String::new();
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

#[tauri::command]
fn write_export_file(path: String, bytes: Vec<u8>, extension: String) -> Result<(), String> {
    let expected_ext = extension.trim().trim_start_matches('.').to_ascii_lowercase();
    if !matches!(expected_ext.as_str(), "csv" | "xlsx") {
        return Err("Extensão de exportação não permitida".to_string());
    }

    let path = std::path::PathBuf::from(path);
    let actual_ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .ok_or_else(|| "Arquivo sem extensão".to_string())?;

    if actual_ext != expected_ext {
        return Err(format!("Arquivo deve usar extensão .{expected_ext}"));
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Caminho de exportação inválido".to_string())?;
    if !parent.exists() || !parent.is_dir() {
        return Err("Diretório de exportação não existe".to_string());
    }
    if path.exists() && path.is_dir() {
        return Err("Destino de exportação é um diretório".to_string());
    }

    std::fs::write(&path, bytes)
        .map_err(|e| format!("Falha ao gravar exportação: {e}"))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AttachmentCopyResult {
    file_name: String,
    storage_path: String,
    mime_type: Option<String>,
}

#[tauri::command]
fn copy_attachment_to_appdata(
    app: tauri::AppHandle,
    source_path: String,
    dest_name: String,
) -> Result<AttachmentCopyResult, String> {
    let source = std::path::PathBuf::from(source_path);
    if !source.is_file() {
        return Err("Arquivo de origem inválido".to_string());
    }

    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .map(ToOwned::to_owned)
        .ok_or_else(|| "Nome de arquivo inválido".to_string())?;
    let safe_dest_name = sanitize_attachment_file_name(&dest_name);
    if safe_dest_name.is_empty() {
        return Err("Nome de destino inválido".to_string());
    }

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Falha ao resolver AppData: {e}"))?;
    let anexos_dir = app_data.join("anexos");
    std::fs::create_dir_all(&anexos_dir)
        .map_err(|e| format!("Falha ao criar diretório de anexos: {e}"))?;

    let dest_path = anexos_dir.join(safe_dest_name);
    std::fs::copy(&source, &dest_path)
        .map_err(|e| format!("Falha ao copiar anexo: {e}"))?;

    let mime_type = source
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| format!("application/{}", ext.to_ascii_lowercase()));

    Ok(AttachmentCopyResult {
        file_name,
        storage_path: dest_path.to_string_lossy().to_string(),
        mime_type,
    })
}

fn sanitize_attachment_file_name(input: &str) -> String {
    input
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

#[tauri::command]
fn read_csv_text_file(path: String) -> Result<String, String> {
    const MAX_CSV_BYTES: u64 = 10 * 1024 * 1024;

    let path = std::path::PathBuf::from(path);
    if !path.is_file() {
        return Err("Arquivo CSV inválido".to_string());
    }

    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .ok_or_else(|| "Arquivo sem extensão".to_string())?;
    if ext != "csv" {
        return Err("Apenas arquivos .csv são permitidos".to_string());
    }

    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Falha ao ler metadados do CSV: {e}"))?;
    if metadata.len() > MAX_CSV_BYTES {
        return Err("CSV excede o limite de 10 MB".to_string());
    }

    std::fs::read_to_string(&path)
        .map_err(|e| format!("Falha ao ler CSV como UTF-8: {e}"))
}

fn sanitize_storage_file_name(input: &str) -> String {
    input
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

fn validate_storage_sub_path(sub_path: &str) -> Result<(), String> {
    if sub_path.contains("..") {
        return Err("Caminho inválido: componente de parent".to_string());
    }
    if sub_path.starts_with('/') || sub_path.starts_with('\\') {
        return Err("Caminho inválido: absoluto não permitido".to_string());
    }
    Ok(())
}

#[tauri::command]
fn offline_storage_save_file(
    app: tauri::AppHandle,
    sub_path: String,
    file_name: String,
    data: Vec<u8>,
) -> Result<String, String> {
    validate_storage_sub_path(&sub_path)?;

    let safe_name = sanitize_storage_file_name(&file_name);
    if safe_name.is_empty() {
        return Err("Nome de arquivo inválido".to_string());
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let stored_name = format!("{timestamp}_{safe_name}");

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Falha ao resolver AppData: {e}"))?;

    let storage_base = app_data.join("storage");
    let target_dir = if sub_path.is_empty() {
        storage_base.clone()
    } else {
        storage_base.join(&sub_path)
    };

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Falha ao criar diretório de armazenamento: {e}"))?;

    let file_path = target_dir.join(&stored_name);
    std::fs::write(&file_path, &data)
        .map_err(|e| format!("Falha ao salvar arquivo: {e}"))?;

    let rel_path = if sub_path.is_empty() {
        format!("storage/{stored_name}")
    } else {
        format!("storage/{sub_path}/{stored_name}")
    };

    Ok(rel_path)
}

#[tauri::command]
fn offline_storage_read_file(
    app: tauri::AppHandle,
    relative_path: String,
) -> Result<Vec<u8>, String> {
    if relative_path.contains("..") {
        return Err("Caminho inválido".to_string());
    }
    let normalized = relative_path.replace('\\', "/");
    if !normalized.starts_with("storage/") {
        return Err("Caminho fora da área de armazenamento".to_string());
    }

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Falha ao resolver AppData: {e}"))?;

    let file_path = app_data.join(&relative_path);

    let app_data_canonical = app_data
        .canonicalize()
        .map_err(|e| format!("Falha ao resolver AppData: {e}"))?;
    let canonical = file_path
        .canonicalize()
        .map_err(|e| format!("Arquivo não encontrado: {e}"))?;

    if !canonical.starts_with(&app_data_canonical) {
        return Err("Caminho fora da área de armazenamento".to_string());
    }

    std::fs::read(&canonical).map_err(|e| format!("Falha ao ler arquivo: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log::info!("Starting Tauri Application...");
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                _app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }

                // Dev-only: log first-login.txt path on first boot
                let app_data = _app.path().app_data_dir().ok();
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
        .manage(std::sync::Arc::new(lan_server::LanServerState::new(
            uuid::Uuid::new_v4().to_string(),
        )))
        .manage(commands::lan_ws::LanWsState::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            database::db_connect,
            database::db_query,
            database::db_execute,
            database::db_execute_batch,
            database::db_transaction,
            database::db_has_users,
            database::db_last_insert_id,
            database::db_export_for_mobile,
            database::db_read_mobile_export,
            session::clear_session,
            session::get_session,
            commands::auth::db_login,
            commands::auth::get_or_create_own_sync_salt,
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
            commands::setup::bootstrap_seed_rbac,
            commands::setup::bootstrap_set_lan_sync_path,
            commands::setup::bootstrap_import_seed_users,
            commands::email::send_email,
            commands::email::test_email_connection,
            commands::email::migrate_smtp_password,
            commands::lan_storage::lan_read_file,
            commands::lan_storage::lan_write_file,
            commands::lan_storage::lan_list_dir,
            commands::legacy_sync::pg_legacy_config_get,
            commands::legacy_sync::pg_legacy_config_save,
            commands::sync_roteiros::sync_roteiros_externos,
            commands::sync_roteiros::sync_roteiros_status,
            commands::sync_pesagens::sync_pesagens_externas,
            commands::sync_residuos::fetch_residuos_externos,
            commands::sync_residuos::sync_residuos_externos,
            commands::key_rotation::rotate_sync_salt,
            commands::key_rotation::recover_sync_salt,
            commands::key_rotation::list_salt_history,
            toggle_devtools,
            open_whatsapp_url,
            write_export_file,
            copy_attachment_to_appdata,
            read_csv_text_file,
            offline_storage_save_file,
            offline_storage_read_file,
            lan_server::lan_server_start,
            lan_server::lan_server_stop,
            lan_server::lan_server_status,
            lan_server::lan_server_auth_token,
            lan_server::lan_server_set_role,
            lan_server::lan_server_discover_peers,
            commands::lan_http::lan_http_request,
            commands::lan_http::lan_http_get_bytes,
            commands::lan_ws::lan_ws_connect,
            commands::lan_ws::lan_ws_send,
            commands::lan_ws::lan_ws_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

