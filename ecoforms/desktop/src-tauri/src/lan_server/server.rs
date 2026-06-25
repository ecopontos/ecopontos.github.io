use axum::Router;
use axum::routing::{get, post};
use std::net::SocketAddr;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tower_http::cors::CorsLayer;

use super::discovery;
use super::file_routes;
use super::routes;
use super::state::LanServerState;
use super::ws;

pub async fn start(state: Arc<LanServerState>, port: u16) -> Result<u16, String> {
    if state.is_running.load(Ordering::Relaxed) {
        return Err("LAN server already running".into());
    }

    let db_path = state.db_path.read().await.clone()
        .ok_or("DB path not configured — call db_connect first")?;

    LanServerState::open_db_connection(&db_path)
        .map_err(|e| format!("Cannot open LAN DB: {e}"))?;

    let app = Router::new()
        .route("/ws", get(ws::ws_handler))
        .route("/api/sync/events", get(routes::pull_events))
        .route("/api/sync/events", post(routes::push_events))
        .route("/api/files/{id}", get(file_routes::download_file))
        .route("/api/files", post(file_routes::upload_file))
        .route("/api/status", get(routes::server_status))
        .route("/api/peers", get(routes::list_peers))
        .layer(CorsLayer::permissive())
        .with_state(state.clone());

    let bind_addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(bind_addr).await
        .map_err(|e| format!("Cannot bind to port {port}: {e}"))?;

    let actual_port = listener.local_addr()
        .map(|a| a.port())
        .unwrap_or(port);

    *state.port.write().await = actual_port;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    *state.shutdown_tx.lock().unwrap() = Some(shutdown_tx);

    state.is_running.store(true, Ordering::Relaxed);

    let role = state.role.read().await.clone();
    let device_id = state.device_id.clone();
    let mdns_handle = discovery::start_announce(&device_id, actual_port, &role).ok();
    let browse_daemon = discovery::start_browse(state.clone()).ok();

    let server_state = state.clone();
    tokio::spawn(async move {
        log::info!("LAN server listening on 0.0.0.0:{actual_port}");

        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .ok();

        server_state.is_running.store(false, Ordering::Relaxed);
        server_state.peers.write().await.clear();

        if let Some(h) = mdns_handle {
            h.stop();
        }
        if let Some(d) = browse_daemon {
            let _ = d.shutdown();
        }

        log::info!("LAN server stopped");
    });

    Ok(actual_port)
}

pub async fn stop(state: &Arc<LanServerState>) -> Result<(), String> {
    if !state.is_running.load(Ordering::Relaxed) {
        return Ok(());
    }

    let tx = state.shutdown_tx.lock().unwrap().take();
    if let Some(tx) = tx {
        let _ = tx.send(());
    }

    tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    Ok(())
}
