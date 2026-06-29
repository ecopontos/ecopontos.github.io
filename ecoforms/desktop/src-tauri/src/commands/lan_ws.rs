use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{Mutex, mpsc, oneshot};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{SinkExt, StreamExt};

pub struct LanWsState {
    sender: Arc<Mutex<Option<mpsc::Sender<String>>>>,
    stopper: Arc<Mutex<Option<oneshot::Sender<()>>>>,
}

impl LanWsState {
    pub fn new() -> Self {
        Self {
            sender: Arc::new(Mutex::new(None)),
            stopper: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn lan_ws_connect(
    app: AppHandle,
    state: tauri::State<'_, LanWsState>,
    url: String,
    device_id: String,
    display_name: String,
    auth_token: String,
) -> Result<(), String> {
    // Validate URL scheme
    if !url.starts_with("ws://") && !url.starts_with("wss://") {
        return Err("URL inválida: apenas ws/wss permitido".to_string());
    }

    // Stop any existing connection first
    drop_existing(&state).await;

    let (tx, mut rx) = mpsc::channel::<String>(64);
    let (stop_tx, stop_rx) = oneshot::channel::<()>();

    *state.sender.lock().await = Some(tx);
    *state.stopper.lock().await = Some(stop_tx);

    let sender_ref = Arc::clone(&state.sender);
    let stopper_ref = Arc::clone(&state.stopper);

    tokio::spawn(async move {
        let result = connect_async(&url).await;
        let (ws_stream, _) = match result {
            Ok(pair) => pair,
            Err(e) => {
                app.emit("lan-ws-state", serde_json::json!({
                    "state": "disconnected",
                    "reason": format!("Conexão falhou: {e}")
                })).ok();
                clear_state(&sender_ref, &stopper_ref).await;
                return;
            }
        };

        let (mut write, mut read) = ws_stream.split();

        // Send auth frame
        let auth = serde_json::json!({
            "type": "auth",
            "device_id": device_id,
            "display_name": display_name,
            "token": auth_token
        });
        if write.send(Message::Text(auth.to_string())).await.is_err() {
            app.emit("lan-ws-state", serde_json::json!({"state": "disconnected"})).ok();
            clear_state(&sender_ref, &stopper_ref).await;
            return;
        }

        let mut stop_rx = stop_rx;

        loop {
            tokio::select! {
                // Incoming from hub
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            // Check for auth messages before forwarding
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                                let msg_type = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");
                                match msg_type {
                                    "auth_ok" => {
                                        app.emit("lan-ws-state", serde_json::json!({"state": "connected"})).ok();
                                        continue;
                                    }
                                    "auth_failed" => {
                                        let reason = parsed.get("reason").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                        app.emit("lan-ws-state", serde_json::json!({
                                            "state": "auth_failed",
                                            "reason": reason
                                        })).ok();
                                        let _ = write.close().await;
                                        clear_state(&sender_ref, &stopper_ref).await;
                                        return;
                                    }
                                    _ => {}
                                }
                            }
                            app.emit("lan-ws-message", &text).ok();
                        }
                        Some(Ok(Message::Close(_))) | None => {
                            app.emit("lan-ws-state", serde_json::json!({"state": "disconnected"})).ok();
                            clear_state(&sender_ref, &stopper_ref).await;
                            return;
                        }
                        Some(Err(e)) => {
                            app.emit("lan-ws-state", serde_json::json!({
                                "state": "disconnected",
                                "reason": e.to_string()
                            })).ok();
                            clear_state(&sender_ref, &stopper_ref).await;
                            return;
                        }
                        _ => {}
                    }
                }
                // Outgoing from JS
                Some(msg) = rx.recv() => {
                    if write.send(Message::Text(msg)).await.is_err() {
                        app.emit("lan-ws-state", serde_json::json!({"state": "disconnected"})).ok();
                        clear_state(&sender_ref, &stopper_ref).await;
                        return;
                    }
                }
                // Stop signal
                _ = &mut stop_rx => {
                    let _ = write.close().await;
                    app.emit("lan-ws-state", serde_json::json!({"state": "disconnected"})).ok();
                    return;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn lan_ws_send(
    state: tauri::State<'_, LanWsState>,
    message: String,
) -> Result<(), String> {
    let guard = state.sender.lock().await;
    if let Some(tx) = guard.as_ref() {
        tx.send(message).await.map_err(|_| "WebSocket não está conectado".to_string())
    } else {
        Err("WebSocket não está conectado".to_string())
    }
}

#[tauri::command]
pub async fn lan_ws_disconnect(state: tauri::State<'_, LanWsState>) -> Result<(), String> {
    drop_existing(&state).await;
    Ok(())
}

async fn drop_existing(state: &LanWsState) {
    if let Some(stop_tx) = state.stopper.lock().await.take() {
        let _ = stop_tx.send(());
    }
    *state.sender.lock().await = None;
}

async fn clear_state(
    sender: &Arc<Mutex<Option<mpsc::Sender<String>>>>,
    stopper: &Arc<Mutex<Option<oneshot::Sender<()>>>>,
) {
    *sender.lock().await = None;
    *stopper.lock().await = None;
}
