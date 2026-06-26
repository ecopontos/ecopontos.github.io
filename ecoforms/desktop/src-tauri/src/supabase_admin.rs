use serde::{Deserialize, Serialize};
use tauri::State;
use crate::session::SessionState;
use crate::database::DbState;
use crate::commands::audit::log_audit;

#[derive(Debug, Clone)]
pub struct SupabaseAdminState {
    service_role_key: Option<String>,
    supabase_url: Option<String>,
}

impl SupabaseAdminState {
    pub fn new() -> Self {
        Self {
            service_role_key: std::env::var("SUPABASE_SERVICE_ROLE_KEY").ok(),
            supabase_url: std::env::var("NEXT_PUBLIC_SUPABASE_URL").ok(),
        }
    }

    pub fn is_initialized(&self) -> bool {
        self.service_role_key.is_some() && self.supabase_url.is_some()
    }

    fn api_base(&self) -> Result<String, String> {
        let url = self
            .supabase_url
            .as_ref()
            .ok_or_else(|| "SUPABASE_URL not configured".to_string())?;
        let key = self
            .service_role_key
            .as_ref()
            .ok_or_else(|| "SUPABASE_SERVICE_ROLE_KEY not configured".to_string())?;

        if url.is_empty() || key.is_empty() {
            return Err("Supabase credentials are empty".to_string());
        }

        Ok(url.to_string())
    }

    fn api_key(&self) -> Result<String, String> {
        self.service_role_key
            .clone()
            .ok_or_else(|| "SUPABASE_SERVICE_ROLE_KEY not configured".to_string())
    }
}

#[derive(Debug, Deserialize)]
pub struct AdminOperationRequest {
    table: String,
    operation: String,
    user_id: String,
    payload: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct AdminOperationResponse {
    success: bool,
    message: String,
    data: Option<serde_json::Value>,
}

fn check_admin_permission(user_role: &str) -> Result<(), String> {
    if user_role != "admin" {
        return Err(format!(
            "Unauthorized: only admins can perform admin operations. User role: {}",
            user_role
        ));
    }
    Ok(())
}

fn api_get(url: &str, api_key: &str) -> Result<serde_json::Value, String> {
    let response = ureq::get(url)
        .set("Authorization", &format!("Bearer {}", api_key))
        .set("apikey", api_key)
        .call()
        .map_err(|e| format!("HTTP GET failed: {}", e))?;

    let body: serde_json::Value = response
        .into_json()
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(body)
}

fn api_post(url: &str, api_key: &str, payload: &serde_json::Value) -> Result<serde_json::Value, String> {
    let response = ureq::post(url)
        .set("Authorization", &format!("Bearer {}", api_key))
        .set("apikey", api_key)
        .set("Content-Type", "application/json")
        .send_json(payload)
        .map_err(|e| format!("HTTP POST failed: {}", e))?;

    let body: serde_json::Value = response
        .into_json()
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(body)
}

fn api_put(url: &str, api_key: &str, payload: &serde_json::Value) -> Result<serde_json::Value, String> {
    let response = ureq::put(url)
        .set("Authorization", &format!("Bearer {}", api_key))
        .set("apikey", api_key)
        .set("Content-Type", "application/json")
        .send_json(payload)
        .map_err(|e| format!("HTTP PUT failed: {}", e))?;

    let body: serde_json::Value = response
        .into_json()
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(body)
}

fn api_delete(url: &str, api_key: &str) -> Result<serde_json::Value, String> {
    let response = ureq::delete(url)
        .set("Authorization", &format!("Bearer {}", api_key))
        .set("apikey", api_key)
        .call()
        .map_err(|e| format!("HTTP DELETE failed: {}", e))?;

    let body: serde_json::Value = response
        .into_json()
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(body)
}

#[tauri::command]
pub async fn supabase_admin_query(
    request: AdminOperationRequest,
    state: State<'_, SupabaseAdminState>,
    session: State<'_, SessionState>,
    db: State<'_, DbState>,
) -> Result<AdminOperationResponse, String> {
    let user_role = session.perfil.lock()
        .map_err(|e| format!("Session lock poisoned: {}", e))?
        .clone()
        .ok_or("Sessão não iniciada. Faça login primeiro.".to_string())?;

    check_admin_permission(&user_role)?;

    if !state.is_initialized() {
        return Err("Supabase credentials not configured on backend".to_string());
    }

    log::info!(
        "[ADMIN] User {} ({}) attempting {} on table {}",
        request.user_id,
        user_role,
        request.operation,
        request.table
    );

    let allowed_tables = vec![
        "usuarios",
        "perfis",
        "hierarquia_perfis",
        "permissoes",
    ];

    if !allowed_tables.contains(&request.table.as_str()) {
        return Err(format!(
            "Unauthorized table: {}. Allowed: {:?}",
            request.table, allowed_tables
        ));
    }

    let base_url = state.api_base()?;
    let api_key = state.api_key()?;

    match request.operation.as_str() {
        "read_users" => {
            log::info!("[ADMIN] Fetching users from Supabase Auth (requested by {})", request.user_id);

            let url = format!("{}/auth/v1/admin/users", base_url);
            match api_get(&url, &api_key) {
                Ok(data) => {
                    // Extract users array from response
                    let users = data
                        .get("users")
                        .or(Some(&data))
                        .cloned();

                    Ok(AdminOperationResponse {
                        success: true,
                        message: "Users fetched from Supabase Auth".to_string(),
                        data: users,
                    })
                }
                Err(e) => {
                    log::error!("[ADMIN] Failed to fetch users: {}", e);
                    Ok(AdminOperationResponse {
                        success: false,
                        message: e,
                        data: None,
                    })
                }
            }
        }
        "create_user" => {
            if request.table != "usuarios" {
                return Err("Create operation only allowed on usuarios".to_string());
            }

            log::info!(
                "[ADMIN] User {} creating new Supabase Auth user",
                request.user_id
            );

            let url = format!("{}/auth/v1/admin/users", base_url);
            match api_post(&url, &api_key, &request.payload) {
                Ok(data) => {
                    let conn = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
                    let conn_ref = conn.as_ref().ok_or("Database not connected")?;
                    let _ = log_audit(conn_ref, &request.user_id, &user_role, "supabase.user.create", Some("usuarios"), None, None, None, None);
                    Ok(AdminOperationResponse {
                        success: true,
                        message: "User created in Supabase Auth".to_string(),
                        data: Some(data),
                    })
                    }
                Err(e) => {
                    log::error!("[ADMIN] Failed to create user: {}", e);
                    Ok(AdminOperationResponse {
                        success: false,
                        message: e,
                        data: None,
                    })
                }
            }
        }
        "update_user" => {
            if request.table != "usuarios" {
                return Err("Update operation only allowed on usuarios".to_string());
            }

            let target_id = request
                .payload
                .get("supabase_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if target_id.is_empty() {
                return Err("Missing supabase_id in payload".to_string());
            }

            log::info!(
                "[ADMIN] User {} updating Supabase Auth user {}",
                request.user_id,
                target_id
            );

            let url = format!("{}/auth/v1/admin/users/{}", base_url, target_id);
            match api_put(&url, &api_key, &request.payload) {
                Ok(data) => {
                    let conn = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
                    let conn_ref = conn.as_ref().ok_or("Database not connected")?;
                    let _ = log_audit(conn_ref, &request.user_id, &user_role, "supabase.user.update", Some("usuarios"), Some(target_id), None, None, None);
                    Ok(AdminOperationResponse {
                        success: true,
                        message: format!("User {} updated in Supabase Auth", target_id),
                        data: Some(data),
                    })
                    }
                Err(e) => {
                    log::error!("[ADMIN] Failed to update user {}: {}", target_id, e);
                    Ok(AdminOperationResponse {
                        success: false,
                        message: e,
                        data: None,
                    })
                }
            }
        }
        "delete_user" => {
            if request.table != "usuarios" {
                return Err("Delete operation only allowed on usuarios".to_string());
            }

            let target_id = request
                .payload
                .get("supabase_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if target_id.is_empty() {
                return Err("Missing supabase_id in payload".to_string());
            }

            log::info!(
                "[ADMIN] User {} deleting Supabase Auth user {}",
                request.user_id,
                target_id
            );

            let url = format!("{}/auth/v1/admin/users/{}", base_url, target_id);
            match api_delete(&url, &api_key) {
                Ok(data) => {
                    let conn = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
                    let conn_ref = conn.as_ref().ok_or("Database not connected")?;
                    let _ = log_audit(conn_ref, &request.user_id, &user_role, "supabase.user.delete", Some("usuarios"), Some(target_id), None, None, None);
                    Ok(AdminOperationResponse {
                        success: true,
                        message: format!("User {} deleted from Supabase Auth", target_id),
                        data: Some(data),
                    })
                    }
                Err(e) => {
                    log::error!("[ADMIN] Failed to delete user {}: {}", target_id, e);
                    Ok(AdminOperationResponse {
                        success: false,
                        message: e,
                        data: None,
                    })
                }
            }
        }
        _ => Err(format!("Unknown operation: {}", request.operation)),
    }
}

#[tauri::command]
pub fn supabase_admin_status(state: State<'_, SupabaseAdminState>) -> AdminOperationResponse {
    AdminOperationResponse {
        success: state.is_initialized(),
        message: if state.is_initialized() {
            "Supabase admin credentials loaded".to_string()
        } else {
            "Supabase admin credentials not configured".to_string()
        },
        data: Some(serde_json::json!({
            "initialized": state.is_initialized(),
            "has_service_role": state.service_role_key.is_some(),
            "has_url": state.supabase_url.is_some(),
        })),
    }
}
