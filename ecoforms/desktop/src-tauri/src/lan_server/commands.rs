use std::sync::Arc;
use tauri::State;

use super::auth;
use super::hub;
use super::server;
use super::state::{LanRole, LanServerInfo, LanServerState, PeerSummary};
use crate::database::DbState;
use crate::session::SessionState;

#[tauri::command]
pub async fn lan_server_start(
    state: State<'_, Arc<LanServerState>>,
    db_state: State<'_, DbState>,
    session: State<'_, SessionState>,
    port: Option<u16>,
    role: Option<String>,
) -> Result<LanServerInfo, String> {
    {
        let conn_guard = db_state.conn.lock().map_err(|e| format!("Lock poisoned: {e}"))?;
        let conn = conn_guard.as_ref().ok_or("Database not connected")?;
        session.validate_against_db(conn)
            .map_err(|e| format!("Sessão inválida: {e}"))?;
    }
    let db_path = db_state.db_path.lock().unwrap().clone()
        .ok_or("Database not connected")?;
    *state.db_path.write().await = Some(db_path.clone());

    if let Some(app_data) = db_path.parent() {
        *state.app_data_dir.write().await = Some(app_data.to_path_buf());
    }

    let lan_role = match role.as_deref() {
        Some("hub") => LanRole::Hub,
        Some("spoke") => LanRole::Spoke,
        _ => hub::resolve_role_from_db(&state).await,
    };

    hub::set_role(&state, lan_role.clone(), None).await;
    hub::persist_role(&state, &lan_role).await?;

    let actual_port = server::start(state.inner().clone(), port.unwrap_or(9400)).await?;

    let mut info = state.get_info().await;
    info.port = actual_port;
    Ok(info)
}

#[tauri::command]
pub async fn lan_server_auth_token(
    state: State<'_, Arc<LanServerState>>,
    db_state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    {
        let conn_guard = db_state.conn.lock().map_err(|e| format!("Lock poisoned: {e}"))?;
        let conn = conn_guard.as_ref().ok_or("Database not connected")?;
        session.validate_against_db(conn)
            .map_err(|e| format!("Sessão inválida: {e}"))?;
    }
    auth::load_or_create_token(state.inner()).await
}

#[tauri::command]
pub async fn lan_server_stop(
    state: State<'_, Arc<LanServerState>>,
) -> Result<(), String> {
    server::stop(state.inner()).await
}

#[tauri::command]
pub async fn lan_server_status(
    state: State<'_, Arc<LanServerState>>,
) -> Result<LanServerInfo, String> {
    Ok(state.get_info().await)
}

#[tauri::command]
pub async fn lan_server_set_role(
    state: State<'_, Arc<LanServerState>>,
    db_state: State<'_, DbState>,
    session: State<'_, SessionState>,
    role: String,
    hub_addr: Option<String>,
) -> Result<(), String> {
    {
        let conn_guard = db_state.conn.lock().map_err(|e| format!("Lock poisoned: {e}"))?;
        let conn = conn_guard.as_ref().ok_or("Database not connected")?;
        session.validate_against_db(conn)
            .map_err(|e| format!("Sessão inválida: {e}"))?;
    }
    let lan_role = match role.as_str() {
        "hub" => LanRole::Hub,
        "spoke" => LanRole::Spoke,
        "disabled" => LanRole::Disabled,
        _ => return Err(format!("Invalid role: {role}")),
    };

    let addr = if let Some(addr_str) = hub_addr {
        Some(addr_str.parse().map_err(|e| format!("Invalid address: {e}"))?)
    } else {
        None
    };

    hub::set_role(&state, lan_role.clone(), addr).await;
    hub::persist_role(&state, &lan_role).await?;
    Ok(())
}

#[tauri::command]
pub async fn lan_server_discover_peers(
    state: State<'_, Arc<LanServerState>>,
) -> Result<Vec<PeerSummary>, String> {
    Ok(state.peer_summaries().await)
}
