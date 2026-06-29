use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::IntoResponse;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::broadcast;

use super::auth;
use super::state::{LanRole, LanServerState, PeerInfo};

pub async fn ws_handler(
    headers: HeaderMap,
    ws: WebSocketUpgrade,
    State(state): State<Arc<LanServerState>>,
) -> impl IntoResponse {
    if let Some(origin) = headers.get(header::ORIGIN) {
        if !auth::is_allowed_origin(origin) {
            auth::record_rejection(
                &state,
                "unknown",
                "lan.ws.origin_rejected",
                "lan_ws",
                origin.to_str().unwrap_or("invalid origin"),
            )
            .await;
            return (StatusCode::FORBIDDEN, "Origin not allowed").into_response();
        }
    }

    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<LanServerState>) {
    let mut rx = state.ws_broadcast.subscribe();
    let mut device_id: Option<String> = None;
    let mut authenticated = false;

    loop {
        tokio::select! {
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                            let msg_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            match msg_type {
                                "auth" => {
                                    if authenticated {
                                        continue;
                                    }
                                    match auth::authorize_ws(&state, &parsed).await {
                                        Ok(peer_auth) => {
                                            device_id = Some(peer_auth.device_id.clone());
                                            authenticated = true;

                                            {
                                                let mut peers = state.peers.write().await;
                                                peers.insert(peer_auth.device_id.clone(), PeerInfo {
                                                    device_id: peer_auth.device_id.clone(),
                                                    display_name: peer_auth.display_name.clone(),
                                                    addr: None,
                                                    role: LanRole::Spoke,
                                                    last_seen: Some(std::time::Instant::now()),
                                                });
                                            }

                                            let ack = json!({
                                                "type": "auth_ok",
                                                "device_id": peer_auth.device_id,
                                                "display_name": peer_auth.display_name,
                                            });
                                            let _ = socket.send(Message::Text(ack.to_string())).await;

                                            let join_msg = json!({
                                                "type": "peer_joined",
                                                "device_id": device_id.clone().unwrap_or_default(),
                                            });
                                            let _ = state.ws_broadcast.send(join_msg.to_string());

                                            let peers = state.peer_summaries().await;
                                            let presence = json!({
                                                "type": "presence",
                                                "peers": peers,
                                            });
                                            let _ = socket.send(Message::Text(presence.to_string())).await;
                                        }
                                        Err(err) => {
                                            let failed = json!({
                                                "type": "auth_failed",
                                                "reason": err,
                                            });
                                            let _ = socket.send(Message::Text(failed.to_string())).await;
                                            let _ = socket.close().await;
                                            break;
                                        }
                                    }
                                }
                                "ping" => {
                                    if !authenticated {
                                        let failed = json!({
                                            "type": "auth_failed",
                                            "reason": "Authentication required",
                                        });
                                        let _ = socket.send(Message::Text(failed.to_string())).await;
                                        let _ = socket.close().await;
                                        break;
                                    }
                                    if let Some(ref did) = device_id {
                                        let mut peers = state.peers.write().await;
                                        if let Some(peer) = peers.get_mut(did) {
                                            peer.last_seen = Some(std::time::Instant::now());
                                        }
                                    }
                                    let _ = socket.send(Message::Text(r#"{"type":"pong"}"#.into())).await;
                                }
                                _ => {
                                    if !authenticated {
                                        let failed = json!({
                                            "type": "auth_failed",
                                            "reason": "Authentication required",
                                        });
                                        let _ = socket.send(Message::Text(failed.to_string())).await;
                                        let _ = socket.close().await;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
            broadcast_msg = rx.recv() => {
                match broadcast_msg {
                    Ok(msg) => {
                        if authenticated {
                            if socket.send(Message::Text(msg)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(_) => break,
                }
            }
        }
    }

    if let Some(did) = &device_id {
        state.peers.write().await.remove(did);
        let leave_msg = json!({
            "type": "peer_left",
            "device_id": did,
        });
        let _ = state.ws_broadcast.send(leave_msg.to_string());
    }
}
