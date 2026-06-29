use std::collections::HashMap;
use std::io::Read;

#[derive(serde::Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

/// Proxy HTTP request through Rust (bypasses WebView CSP).
/// Accepts GET or POST; headers are a flat string map; body is optional JSON string.
#[tauri::command]
pub fn lan_http_request(
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    validate_lan_url(&url)?;

    let mut req = match method.to_uppercase().as_str() {
        "POST" => ureq::post(&url),
        "GET" | _ => ureq::get(&url),
    };

    for (k, v) in &headers {
        req = req.set(k, v);
    }

    let response = if let Some(body_str) = body {
        req.send_string(&body_str)
    } else {
        req.call()
    };

    match response {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.into_string().unwrap_or_default();
            Ok(HttpResponse { status, body })
        }
        Err(ureq::Error::Status(code, resp)) => {
            let body = resp.into_string().unwrap_or_default();
            Ok(HttpResponse { status: code, body })
        }
        Err(e) => Err(format!("LAN HTTP error: {e}")),
    }
}

/// Proxy HTTP GET returning raw bytes (for file downloads).
#[tauri::command]
pub fn lan_http_get_bytes(
    url: String,
    headers: HashMap<String, String>,
) -> Result<Vec<u8>, String> {
    validate_lan_url(&url)?;

    let mut req = ureq::get(&url);
    for (k, v) in &headers {
        req = req.set(k, v);
    }

    let resp = req.call().map_err(|e| format!("LAN HTTP error: {e}"))?;

    let mut bytes = Vec::new();
    resp.into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| format!("LAN read error: {e}"))?;
    Ok(bytes)
}

/// Reject non-HTTP(S) URLs as a basic SSRF guard.
fn validate_lan_url(url: &str) -> Result<(), String> {
    let lower = url.to_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        return Err("URL inválida: apenas http/https permitido".to_string());
    }
    Ok(())
}
