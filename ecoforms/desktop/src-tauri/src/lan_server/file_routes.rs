use axum::body::Body;
use axum::extract::{Multipart, Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use std::sync::Arc;
use tokio::fs;

use super::auth;
use super::state::LanServerState;
use crate::uuid_v7::uuid_v7_string;

pub async fn download_file(
    State(state): State<Arc<LanServerState>>,
    headers: HeaderMap,
    Path(anexo_id): Path<String>,
) -> impl IntoResponse {
    let _auth = match auth::authorize_http(&state, &headers).await {
        Ok(auth) => auth,
        Err(resp) => return resp.into_response(),
    };

    let db_path = state.db_path.read().await.clone();
    let app_data = state.app_data_dir.read().await.clone();

    let (db_path, app_data) = match (db_path, app_data) {
        (Some(d), Some(a)) => (d, a),
        _ => return (StatusCode::SERVICE_UNAVAILABLE, "Server not configured").into_response(),
    };

    let file_info = tokio::task::spawn_blocking(move || {
        let conn = LanServerState::open_db_connection(&db_path)?;
        let result = conn.query_row(
            "SELECT caminho_storage, tipo_mime, nome_arquivo FROM anexos WHERE id = ?1",
            [&anexo_id],
            |row| Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            )),
        ).map_err(|e| format!("Not found: {e}"))?;
        Ok::<_, String>(result)
    }).await;

    let (rel_path, mime_type, filename) = match file_info {
        Ok(Ok(info)) => info,
        Ok(Err(e)) => return (StatusCode::NOT_FOUND, e).into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let full_path = app_data.join(&rel_path);

    if !full_path.starts_with(&app_data) {
        return (StatusCode::FORBIDDEN, "Path traversal blocked").into_response();
    }

    match fs::read(&full_path).await {
        Ok(bytes) => {
            let content_type = mime_type.unwrap_or_else(|| "application/octet-stream".into());
            let disp_name = filename.unwrap_or_else(|| "file".into());
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, content_type),
                    (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{disp_name}\"")),
                ],
                Body::from(bytes),
            ).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, "File not found on disk").into_response(),
    }
}

pub async fn upload_file(
    State(state): State<Arc<LanServerState>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let _auth = match auth::authorize_http(&state, &headers).await {
        Ok(auth) => auth,
        Err(resp) => return resp.into_response(),
    };

    let app_data = state.app_data_dir.read().await.clone();
    let db_path = state.db_path.read().await.clone();

    let (app_data, db_path) = match (app_data, db_path) {
        (Some(a), Some(d)) => (a, d),
        _ => return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error": "Server not configured"}))).into_response(),
    };

    let mut anexo_id = String::new();
    let mut filename = String::new();
    let mut mime_type = String::from("application/octet-stream");
    let mut domain = String::from("general");
    let mut file_bytes: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            if let Some(fname) = field.file_name() {
                if filename.is_empty() {
                    filename = fname.to_string();
                }
            }
            if let Ok(b) = field.bytes().await {
                file_bytes = Some(b.to_vec());
            }
        } else {
            let val: String = field.text().await.unwrap_or_default();
            match name.as_str() {
                "id" => anexo_id = val,
                "filename" => filename = val,
                "mime_type" => mime_type = val,
                "domain" => domain = val,
                _ => {}
            }
        }
    }

    let bytes = match file_bytes {
        Some(b) => b,
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "No file provided"}))).into_response(),
    };

    if anexo_id.is_empty() {
        anexo_id = uuid_v7_string();
    }

    let timestamp = chrono::Utc::now().timestamp_millis();
    let safe_name = filename.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let rel_path = format!("storage/{domain}/{timestamp}_{safe_name}");
    let full_path = app_data.join(&rel_path);

    if let Some(parent) = full_path.parent() {
        let _ = fs::create_dir_all(parent).await;
    }

    if let Err(e) = fs::write(&full_path, &bytes).await {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("Write failed: {e}")}))).into_response();
    }

    let size = bytes.len();
    let rel_path_clone = rel_path.clone();
    let anexo_id_clone = anexo_id.clone();
    let mime_clone = mime_type.clone();
    let filename_clone = safe_name.clone();

    let db_result = tokio::task::spawn_blocking(move || {
        let conn = LanServerState::open_db_connection(&db_path)?;
        conn.execute(
            "INSERT OR REPLACE INTO anexos (id, caminho_storage, tipo_mime, nome_arquivo, sincronizado)
             VALUES (?1, ?2, ?3, ?4, 0)",
            rusqlite::params![anexo_id_clone, rel_path_clone, mime_clone, filename_clone],
        ).map_err(|e| format!("DB insert failed: {e}"))?;
        Ok::<_, String>(())
    }).await;

    match db_result {
        Ok(Ok(_)) => Json(serde_json::json!({
            "id": anexo_id,
            "caminho_storage": rel_path,
            "size_bytes": size,
        })).into_response(),
        Ok(Err(e)) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}
