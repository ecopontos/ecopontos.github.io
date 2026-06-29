use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::auth;
use super::state::LanServerState;

#[derive(Deserialize)]
pub struct PullEventsQuery {
    pub since_seq: Option<i64>,
    pub routing_id: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct LanEvent {
    pub id: String,
    pub tipo: String,
    pub carga: serde_json::Value,
    pub sequencia_lan: i64,
    pub id_roteamento: String,
    pub dispositivo_origem: String,
    pub recebido_em: String,
}

#[derive(Serialize)]
pub struct PushResult {
    pub accepted: usize,
    pub rejected: usize,
    pub errors: Vec<String>,
}

#[derive(Deserialize)]
pub struct IncomingEvent {
    pub id: String,
    pub tipo: String,
    pub carga: serde_json::Value,
    pub id_roteamento: String,
    pub dispositivo_origem: String,
}



const MAX_PUSH_EVENTS: usize = 500;

fn validate_incoming_event(event: &IncomingEvent) -> Result<(), String> {
    if event.id.trim().is_empty() {
        return Err("Missing event id".into());
    }
    if event.tipo.trim().is_empty() {
        return Err("Missing event type".into());
    }
    if event.dispositivo_origem.trim().is_empty() {
        return Err("Missing dispositivo_origem".into());
    }
    if event.carga.is_null() {
        return Err("Missing carga".into());
    }
    if !event.carga.is_object() && !event.carga.is_array() {
        return Err("carga must be a JSON object or array".into());
    }
    Ok(())
}

pub async fn pull_events(
    State(state): State<Arc<LanServerState>>,
    headers: HeaderMap,
    Query(params): Query<PullEventsQuery>,
) -> impl IntoResponse {
    let _auth = match auth::authorize_http(&state, &headers).await {
        Ok(auth) => auth,
        Err(resp) => return resp.into_response(),
    };

    let since = params.since_seq.unwrap_or(0);
    let limit = params.limit.unwrap_or(100).min(500);
    let routing_id = params.routing_id.clone().unwrap_or_default();

    let db_path = state.db_path.read().await.clone();
    let db_path = match db_path {
        Some(p) => p,
        None => return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error": "DB not configured"}))).into_response(),
    };

    let result = tokio::task::spawn_blocking(move || {
        let conn = LanServerState::open_db_connection(&db_path)?;
        let mut stmt = conn.prepare(
            "SELECT id, tipo, carga, sequencia_lan, id_roteamento, dispositivo_origem, recebido_em
             FROM fila_eventos_lan
             WHERE id_roteamento = ?1 AND sequencia_lan > ?2
             ORDER BY sequencia_lan ASC
             LIMIT ?3"
        ).map_err(|e| format!("Prepare error: {e}"))?;

        let events: Vec<LanEvent> = stmt.query_map(
            rusqlite::params![routing_id, since, limit],
            |row| {
                let carga_str: String = row.get(2)?;
                let carga: serde_json::Value = serde_json::from_str(&carga_str).unwrap_or(serde_json::Value::Null);
                Ok(LanEvent {
                    id: row.get(0)?,
                    tipo: row.get(1)?,
                    carga,
                    sequencia_lan: row.get(3)?,
                    id_roteamento: row.get(4)?,
                    dispositivo_origem: row.get(5)?,
                    recebido_em: row.get(6)?,
                })
            }
        ).map_err(|e| format!("Query error: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

        Ok::<_, String>(events)
    }).await;

    match result {
        Ok(Ok(events)) => Json(serde_json::json!(events)).into_response(),
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn push_events(
    State(state): State<Arc<LanServerState>>,
    headers: HeaderMap,
    Json(events): Json<Vec<IncomingEvent>>,
) -> impl IntoResponse {
    let auth = match auth::authorize_http(&state, &headers).await {
        Ok(auth) => auth,
        Err(resp) => return resp.into_response(),
    };

    if events.len() > MAX_PUSH_EVENTS {
        auth::record_rejection(
            &state,
            &auth.device_id,
            "lan.schema.batch_too_large",
            "api/sync/events",
            &format!("Too many events: {}", events.len()),
        )
        .await;
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(serde_json::json!({"error": "Too many events in a single batch"})),
        )
            .into_response();
    }

    for event in &events {
        if let Err(reason) = validate_incoming_event(event) {
            auth::record_rejection(
                &state,
                &auth.device_id,
                "lan.schema.event_rejected",
                "api/sync/events",
                &reason,
            )
            .await;
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": reason})),
            )
                .into_response();
        }
    }

    let db_path = state.db_path.read().await.clone();
    let db_path = match db_path {
        Some(p) => p,
        None => return (StatusCode::SERVICE_UNAVAILABLE, Json(PushResult { accepted: 0, rejected: 0, errors: vec!["DB not configured".into()] })).into_response(),
    };

    let broadcast_tx = state.ws_broadcast.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = LanServerState::open_db_connection(&db_path)?;

        let mut accepted = 0usize;
        let mut rejected = 0usize;
        let mut errors = Vec::new();

        for event in &events {
            let existing: bool = conn.query_row(
                "SELECT COUNT(*) FROM fila_eventos_lan WHERE id = ?1",
                [&event.id],
                |row| row.get::<_, i64>(0),
            ).unwrap_or(0) > 0;

            if existing {
                continue;
            }

            let next_seq: i64 = conn.query_row(
                "SELECT COALESCE(MAX(sequencia_lan), 0) + 1 FROM fila_eventos_lan WHERE id_roteamento = ?1",
                [&event.id_roteamento],
                |row| row.get(0),
            ).unwrap_or(1);

            let carga_str = event.carga.to_string();

            match conn.execute(
                "INSERT INTO fila_eventos_lan (id, tipo, carga, sequencia_lan, id_roteamento, dispositivo_origem)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![event.id, event.tipo, carga_str, next_seq, event.id_roteamento, event.dispositivo_origem],
            ) {
                Ok(_) => {
                    accepted += 1;
                    let notification = serde_json::json!({
                        "type": "event_available",
                        "event_type": event.tipo,
                        "aggregate_id": event.id,
                        "seq": next_seq,
                        "routing_id": event.id_roteamento,
                    });
                    let _ = broadcast_tx.send(notification.to_string());
                }
                Err(e) => {
                    rejected += 1;
                    errors.push(format!("Event {}: {e}", event.id));
                }
            }
        }

        Ok::<_, String>(PushResult { accepted, rejected, errors })
    }).await;

    match result {
        Ok(Ok(r)) => (StatusCode::OK, Json(r)).into_response(),
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, Json(PushResult { accepted: 0, rejected: 0, errors: vec![e] })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(PushResult { accepted: 0, rejected: 0, errors: vec![e.to_string()] })).into_response(),
    }
}

pub async fn server_status(
    State(state): State<Arc<LanServerState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _auth = match auth::authorize_http(&state, &headers).await {
        Ok(auth) => auth,
        Err(resp) => return resp.into_response(),
    };

    let info = state.get_info().await;
    Json(serde_json::json!(info)).into_response()
}

pub async fn list_peers(
    State(state): State<Arc<LanServerState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _auth = match auth::authorize_http(&state, &headers).await {
        Ok(auth) => auth,
        Err(resp) => return resp.into_response(),
    };

    let peers = state.peer_summaries().await;
    Json(serde_json::json!(peers)).into_response()
}
