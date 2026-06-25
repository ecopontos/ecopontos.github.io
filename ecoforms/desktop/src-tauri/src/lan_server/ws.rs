use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use std::sync::Arc;
use tokio::sync::broadcast;

use super::state::{LanServerState, PeerInfo, LanRole};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<LanServerState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<LanServerState>) {
    let mut rx = state.ws_broadcast.subscribe();
    let mut device_id: Option<String> = None;

    loop {
        tokio::select! {
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                            let msg_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            match msg_type {
                                "auth" => {
                                    let did = parsed.get("device_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("unknown")
                                        .to_string();
                                    let name = parsed.get("display_name")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or(&did)
                                        .to_string();

                                    device_id = Some(did.clone());

                                    {
                                        let mut peers = state.peers.write().await;
                                        peers.insert(did.clone(), PeerInfo {
                                            device_id: did.clone(),
                                            display_name: name.clone(),
                                            addr: None,
                                            role: LanRole::Spoke,
                                            last_seen: Some(std::time::Instant::now()),
                                        });
                                    }

                                    let join_msg = serde_json::json!({
                                        "type": "peer_joined",
                                        "device_id": did,
                                        "display_name": name,
                                    });
                                    let _ = state.ws_broadcast.send(join_msg.to_string());

                                    let peers = state.peer_summaries().await;
                                    let presence = serde_json::json!({
                                        "type": "presence",
                                        "peers": peers,
                                    });
                                    let _ = socket.send(Message::Text(presence.to_string().into())).await;
                                }
                                "ping" => {
                                    if let Some(ref did) = device_id {
                                        let mut peers = state.peers.write().await;
                                        if let Some(peer) = peers.get_mut(did) {
                                            peer.last_seen = Some(std::time::Instant::now());
                                        }
                                    }
                                    let _ = socket.send(Message::Text(r#"{"type":"pong"}"#.into())).await;
                                }
                                _ => {}
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
                        if socket.send(Message::Text(msg.into())).await.is_err() {
                            break;
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
        let leave_msg = serde_json::json!({
            "type": "peer_left",
            "device_id": did,
        });
        let _ = state.ws_broadcast.send(leave_msg.to_string());
    }
}
