use super::state::{LanRole, LanServerState};
use std::net::SocketAddr;
use std::sync::Arc;

pub async fn set_role(state: &Arc<LanServerState>, role: LanRole, hub_addr: Option<SocketAddr>) {
    *state.role.write().await = role.clone();

    if let Some(addr) = hub_addr {
        *state.hub_addr.write().await = Some(addr);
    }

    if role != LanRole::Hub {
        return;
    }

    *state.hub_addr.write().await = None;
}

pub async fn resolve_role_from_db(state: &Arc<LanServerState>) -> LanRole {
    let db_path = state.db_path.read().await.clone();
    let db_path = match db_path {
        Some(p) => p,
        None => return LanRole::Disabled,
    };

    let result = tokio::task::spawn_blocking(move || {
        let conn = LanServerState::open_db_connection(&db_path).ok()?;
        let role_str: Option<String> = conn.query_row(
            "SELECT valor FROM configuracoes_sistema WHERE chave = 'lan_server_role'",
            [],
            |row| row.get(0),
        ).ok();
        role_str
    }).await;

    match result {
        Ok(Some(role_str)) => match role_str.as_str() {
            "hub" => LanRole::Hub,
            "spoke" => LanRole::Spoke,
            _ => LanRole::Disabled,
        },
        _ => LanRole::Disabled,
    }
}

pub async fn persist_role(state: &Arc<LanServerState>, role: &LanRole) -> Result<(), String> {
    let db_path = state.db_path.read().await.clone();
    let db_path = db_path.ok_or("DB not configured")?;

    let role_str = match role {
        LanRole::Hub => "hub",
        LanRole::Spoke => "spoke",
        LanRole::Disabled => "disabled",
    };

    let role_val = role_str.to_string();
    tokio::task::spawn_blocking(move || {
        let conn = LanServerState::open_db_connection(&db_path)?;
        conn.execute(
            "INSERT OR REPLACE INTO configuracoes_sistema (chave, valor, atualizado_em)
             VALUES ('lan_server_role', ?1, datetime('now'))",
            [&role_val],
        ).map_err(|e| format!("Persist role error: {e}"))?;
        Ok(())
    }).await.map_err(|e| e.to_string())?
}
