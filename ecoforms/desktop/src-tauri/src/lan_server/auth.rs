use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::Json;
use serde::Serialize;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;

use super::state::LanServerState;
use crate::uuid_v7::uuid_v7_string;

const AUTH_TOKEN_FILE: &str = ".ecoforms-lan-token";
const DEVICE_ID_HEADER: &str = "x-device-id";
const LAN_TOKEN_HEADER: &str = "x-lan-token";

#[derive(Debug, Clone)]
pub struct LanHttpAuth {
    pub device_id: String,
}

#[derive(Debug, Clone)]
pub struct LanWsAuth {
    pub device_id: String,
    pub display_name: String,
}

#[derive(Serialize)]
pub struct ErrorBody {
    pub error: String,
}

fn json_error(status: StatusCode, message: impl Into<String>) -> (StatusCode, Json<ErrorBody>) {
    (status, Json(ErrorBody { error: message.into() }))
}

pub async fn record_rejection(
    state: &Arc<LanServerState>,
    actor_id: &str,
    action: &str,
    target: &str,
    reason: &str,
) {
    let db_path = state.db_path.read().await.clone();
    let Some(db_path) = db_path else {
        return;
    };

    let actor_id = actor_id.to_string();
    let action = action.to_string();
    let target = target.to_string();
    let reason = reason.to_string();

    let _ = tokio::task::spawn_blocking(move || {
        let conn = LanServerState::open_db_connection(&db_path)?;
        let audit_id = uuid_v7_string();
        let now = chrono::Utc::now().to_rfc3339();
        let metadata = serde_json::json!({
            "reason": reason,
            "actor_device_id": actor_id,
            "target": target,
        })
        .to_string();

        conn.execute(
            "INSERT INTO log_auditoria (id, id_ator, perfil_ator, acao, tabela_alvo, id_alvo, valor_anterior, valor_novo, metadados, criado_em, sincronizado)
             VALUES (?1, ?2, 'lan', ?3, ?4, ?5, '', '', ?6, ?7, 0)",
            rusqlite::params![audit_id, actor_id, action, "lan_server", target, metadata, now],
        )
        .map_err(|e| format!("Failed to write LAN rejection audit: {e}"))?;

        Ok::<_, String>(())
    })
    .await;
}

async fn resolve_auth_root(state: &Arc<LanServerState>) -> Result<PathBuf, String> {
    let db_path = state.db_path.read().await.clone();
    if let Some(db_path) = db_path {
        let lan_sync_path = tokio::task::spawn_blocking(move || -> Option<PathBuf> {
            let conn = LanServerState::open_db_connection(&db_path).ok()?;
            let value: String = conn.query_row(
                "SELECT valor FROM tbl_configuracoes_sistema WHERE chave = 'lan_sync_path' LIMIT 1",
                [],
                |row| row.get(0),
            ).ok()?;
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(PathBuf::from(trimmed))
            }
        }).await.map_err(|e| format!("LAN auth path task failed: {e}"))?;

        if let Some(path) = lan_sync_path {
            return Ok(path);
        }
    }

    if let Some(app_data) = state.app_data_dir.read().await.clone() {
        return Ok(app_data);
    }

    if let Some(db_path) = state.db_path.read().await.clone() {
        if let Some(parent) = db_path.parent() {
            return Ok(parent.to_path_buf());
        }
    }

    Err("LAN auth root not configured".into())
}

fn generate_token() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

pub fn is_allowed_origin(origin: &HeaderValue) -> bool {
    origin
        .to_str()
        .ok()
        .map(|value| {
            value == "tauri://localhost"
                || value == "https://tauri.localhost"
                || value == "http://localhost"
                || value.starts_with("http://localhost:")
                || value == "https://localhost"
                || value.starts_with("https://localhost:")
                || value == "http://127.0.0.1"
                || value.starts_with("http://127.0.0.1:")
                || value == "https://127.0.0.1"
                || value.starts_with("https://127.0.0.1:")
        })
        .unwrap_or(false)
}

pub async fn load_or_create_token(state: &Arc<LanServerState>) -> Result<String, String> {
    if let Some(token) = state.auth_token.read().await.clone() {
        return Ok(token);
    }

    let root = resolve_auth_root(state).await?;
    let token_path = root.join(AUTH_TOKEN_FILE);
    if let Some(parent) = token_path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to prepare LAN auth directory: {e}"))?;
    }

    let mut should_write = false;
    let token = match fs::read_to_string(&token_path).await {
        Ok(contents) => {
            let trimmed = contents.trim();
            if trimmed.is_empty() {
                should_write = true;
                generate_token()
            } else {
                trimmed.to_string()
            }
        }
        Err(err) if err.kind() == ErrorKind::NotFound => {
            should_write = true;
            generate_token()
        }
        Err(err) => return Err(format!("Failed to read LAN auth token: {err}")),
    };

    if should_write {
        fs::write(&token_path, format!("{token}\n"))
            .await
            .map_err(|e| format!("Failed to store LAN auth token: {e}"))?;
    }

    *state.auth_token.write().await = Some(token.clone());
    Ok(token)
}

pub async fn authorize_http(
    state: &Arc<LanServerState>,
    headers: &HeaderMap,
) -> Result<LanHttpAuth, (StatusCode, Json<ErrorBody>)> {
    if let Some(origin) = headers.get(header::ORIGIN) {
        if !is_allowed_origin(origin) {
            let origin_value = origin.to_str().unwrap_or("invalid origin");
            record_rejection(
                state,
                "unknown",
                "lan.http.origin_rejected",
                "lan_http",
                origin_value,
            )
            .await;
            return Err(json_error(StatusCode::FORBIDDEN, "Origin not allowed"));
        }
    }

    let device_id = headers
        .get(DEVICE_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    let device_hint = device_id.clone().unwrap_or_else(|| "unknown".to_string());
    let device_id = match device_id {
        Some(value) => value,
        None => {
            record_rejection(
                state,
                "unknown",
                "lan.http.device_missing",
                "lan_http",
                "Missing X-Device-Id header",
            )
            .await;
            return Err(json_error(StatusCode::BAD_REQUEST, "Missing X-Device-Id header"));
        }
    };

    let token = headers
        .get(LAN_TOKEN_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);
    let token = match token {
        Some(value) => value,
        None => {
            record_rejection(
                state,
                &device_hint,
                "lan.http.token_missing",
                "lan_http",
                "Missing X-LAN-Token header",
            )
            .await;
            return Err(json_error(StatusCode::BAD_REQUEST, "Missing X-LAN-Token header"));
        }
    };

    let expected = match load_or_create_token(state).await {
        Ok(token) => token,
        Err(e) => {
            record_rejection(
                state,
                &device_hint,
                "lan.http.token_lookup_failed",
                "lan_http",
                &e,
            )
            .await;
            return Err(json_error(StatusCode::INTERNAL_SERVER_ERROR, e));
        }
    };

    if token != expected {
        record_rejection(
            state,
            &device_hint,
            "lan.http.token_invalid",
            "lan_http",
            "Invalid LAN token",
        )
        .await;
        return Err(json_error(StatusCode::FORBIDDEN, "Invalid LAN token"));
    }

    Ok(LanHttpAuth { device_id })
}

pub async fn authorize_ws(
    state: &Arc<LanServerState>,
    payload: &serde_json::Value,
) -> Result<LanWsAuth, String> {
    let device_id = match payload
        .get("device_id")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(value) => value.to_string(),
        None => {
            record_rejection(
                state,
                "unknown",
                "lan.ws.device_missing",
                "lan_ws",
                "Missing device_id",
            )
            .await;
            return Err("Missing device_id".to_string());
        }
    };

    let token = match payload
        .get("token")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(value) => value.to_string(),
        None => {
            record_rejection(
                state,
                &device_id,
                "lan.ws.token_missing",
                "lan_ws",
                "Missing LAN token",
            )
            .await;
            return Err("Missing LAN token".into());
        }
    };

    let expected = match load_or_create_token(state).await {
        Ok(token) => token,
        Err(e) => {
            record_rejection(
                state,
                &device_id,
                "lan.ws.token_lookup_failed",
                "lan_ws",
                &e,
            )
            .await;
            return Err(e);
        }
    };
    if token != expected {
        record_rejection(
            state,
            &device_id,
            "lan.ws.token_invalid",
            "lan_ws",
            "Invalid LAN token",
        )
        .await;
        return Err("Invalid LAN token".into());
    }

    let display_name = payload
        .get("display_name")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&device_id)
        .to_string();

    Ok(LanWsAuth {
        device_id,
        display_name,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lan_server::{LanRole, LanServerState};
    use rusqlite::Connection;
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::atomic::AtomicBool;
    use std::sync::Mutex;
    use tokio::sync::{broadcast, RwLock};

    fn unique_dir(prefix: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("{}-{}", prefix, uuid::Uuid::new_v4().simple()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn make_state(db_path: Option<PathBuf>, app_data_dir: Option<PathBuf>) -> Arc<LanServerState> {
        Arc::new(LanServerState {
            is_running: AtomicBool::new(false),
            role: RwLock::new(LanRole::Disabled),
            peers: RwLock::new(HashMap::new()),
            port: RwLock::new(9400),
            device_id: "device-test".to_string(),
            hub_addr: RwLock::new(None),
            ws_broadcast: broadcast::channel(16).0,
            db_path: RwLock::new(db_path),
            auth_token: RwLock::new(None),
            app_data_dir: RwLock::new(app_data_dir),
            shutdown_tx: Mutex::new(None),
        })
    }

    #[tokio::test]
    async fn load_or_create_token_prefers_lan_sync_path() {
        let app_data_dir = unique_dir("lan-auth-app");
        let db_dir = unique_dir("lan-auth-db");
        let shared_dir = unique_dir("lan-auth-shared");
        let db_path = db_dir.join("ecoforms.sqlite");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE tbl_configuracoes_sistema (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TEXT);",
        ).unwrap();
        conn.execute(
            "INSERT INTO tbl_configuracoes_sistema (chave, valor, atualizado_em) VALUES ('lan_sync_path', ?1, datetime('now'))",
            [&shared_dir.to_string_lossy().to_string()],
        ).unwrap();

        let state = make_state(Some(db_path), Some(app_data_dir.clone()));
        let token = load_or_create_token(&state).await.unwrap();
        let token_path = shared_dir.join(AUTH_TOKEN_FILE);

        assert!(token_path.exists());
        assert_eq!(fs::read_to_string(&token_path).unwrap().trim(), token);
        assert!(!app_data_dir.join(AUTH_TOKEN_FILE).exists());
    }

    #[tokio::test]
    async fn authorize_http_rejects_invalid_token() {
        let state = make_state(None, Some(unique_dir("lan-auth-http")));
        *state.auth_token.write().await = Some("expected-token".into());

        let mut headers = HeaderMap::new();
        headers.insert("X-Device-Id", HeaderValue::from_static("peer-1"));
        headers.insert("X-LAN-Token", HeaderValue::from_static("wrong-token"));

        let err = authorize_http(&state, &headers).await.unwrap_err();
        assert_eq!(err.0, StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn authorize_ws_accepts_valid_token() {
        let state = make_state(None, Some(unique_dir("lan-auth-ws")));
        *state.auth_token.write().await = Some("expected-token".into());

        let payload = serde_json::json!({
            "type": "auth",
            "device_id": "peer-1",
            "display_name": "Peer 1",
            "token": "expected-token"
        });

        let auth = authorize_ws(&state, &payload).await.unwrap();
        assert_eq!(auth.device_id, "peer-1");
        assert_eq!(auth.display_name, "Peer 1");
    }

    #[test]
    fn origin_allowlist_is_strict() {
        assert!(is_allowed_origin(&HeaderValue::from_static("tauri://localhost")));
        assert!(is_allowed_origin(&HeaderValue::from_static("http://localhost:3001")));
        assert!(!is_allowed_origin(&HeaderValue::from_static("https://example.com")));
    }
}
