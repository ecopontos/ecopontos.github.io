use std::fs;
use std::io::Write;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

fn validate_network_path(path: &str) -> Result<PathBuf, String> {
    if path.is_empty() {
        return Err("Path must not be empty".to_string());
    }
    let p = PathBuf::from(path);
    for component in p.components() {
        use std::path::Component;
        if matches!(component, Component::ParentDir) {
            return Err("Path traversal ('..') is not allowed".to_string());
        }
    }
    // If path exists, resolve canonical path to catch symlink tricks
    if p.exists() {
        let canonical = std::fs::canonicalize(&p)
            .map_err(|e| format!("Failed to resolve path: {}", e))?;
        return Ok(canonical);
    }
    Ok(p)
}

#[derive(Serialize, Deserialize)]
pub struct CepData {
    pub logradouro: Option<String>,
    pub bairro: Option<String>,
    pub localidade: Option<String>,
    pub uf: Option<String>,
}

#[tauri::command]
pub fn fetch_cep(cep: String) -> Result<Option<CepData>, String> {
    let digits: String = cep.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 8 {
        return Ok(None);
    }
    let url = format!("https://viacep.com.br/ws/{}/json/", digits);
    let response = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(8))
        .call()
        .map_err(|e| format!("CEP request failed: {}", e))?;
    let body: serde_json::Value = response
        .into_json()
        .map_err(|e| format!("CEP parse failed: {}", e))?;
    let is_error = body.get("erro").map(|v| {
        v.as_bool().unwrap_or(false) || v.as_str() == Some("true")
    }).unwrap_or(false);
    if is_error {
        return Ok(None);
    }
    Ok(Some(CepData {
        logradouro: body["logradouro"].as_str().map(str::to_owned),
        bairro: body["bairro"].as_str().map(str::to_owned),
        localidade: body["localidade"].as_str().map(str::to_owned),
        uf: body["uf"].as_str().map(str::to_owned),
    }))
}

#[derive(Serialize)]
pub struct ProbeResult {
    pub accessible: bool,
    pub readable: bool,
    pub writable: bool,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct ParquetFileInfo {
    pub name: String,
    pub size: u64,
    pub modified: Option<String>,
    pub full_path: String,
}

#[tauri::command]
pub fn network_probe_path(path: String) -> Result<ProbeResult, String> {
    let p = validate_network_path(&path)?;

    if !p.exists() {
        return Ok(ProbeResult {
            accessible: false,
            readable: false,
            writable: false,
            error: Some(format!("Path does not exist: {}", path)),
        });
    }

    if !p.is_dir() {
        return Ok(ProbeResult {
            accessible: false,
            readable: false,
            writable: false,
            error: Some(format!("Path is not a directory: {}", path)),
        });
    }

    let readable = fs::read_dir(&p).is_ok();

    let test_file = p.join(".ecoforms_write_test");
    let writable = match fs::File::create(&test_file) {
        Ok(_) => {
            let _ = fs::remove_file(&test_file);
            true
        }
        Err(_) => false,
    };

    Ok(ProbeResult {
        accessible: true,
        readable,
        writable,
        error: None,
    })
}

#[tauri::command]
pub fn network_list_parquet(path: String) -> Result<Vec<ParquetFileInfo>, String> {
    let p = validate_network_path(&path)?;

    if !p.exists() || !p.is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    let entries = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut files = Vec::new();

    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy().to_string();

        if !name.ends_with(".parquet") {
            continue;
        }

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let modified = meta.modified().ok().and_then(|t| {
            t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| {
                // Format as ISO-8601 approximate (seconds since epoch → simple string)
                let secs = d.as_secs();
                // Convert to a readable datetime string
                let dt = secs;
                format_epoch(dt)
            })
        });

        files.push(ParquetFileInfo {
            name,
            size: meta.len(),
            modified,
            full_path: entry.path().to_string_lossy().to_string(),
        });
    }

    files.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(files)
}

#[tauri::command]
pub fn network_write_parquet(
    path: String,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let dir = validate_network_path(&path)?;

    if !dir.exists() {
        return Err(format!("Directory not found: {}", path));
    }

    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Sanitize filename — only allow alphanumeric, dash, underscore, dot
    let safe_name: String = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();

    if safe_name.is_empty() {
        return Err("Invalid filename".to_string());
    }

    if !safe_name.ends_with(".parquet") {
        return Err("Filename must end with .parquet".to_string());
    }

    let dest = dir.join(&safe_name);

    let mut file = fs::File::create(&dest)
        .map_err(|e| format!("Failed to create file {}: {}", dest.display(), e))?;

    file.write_all(&data)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Converts Unix epoch seconds to a simple ISO-8601-like string.
/// Uses basic arithmetic — no external crate needed.
fn format_epoch(secs: u64) -> String {
    // Days since 1970-01-01
    let mut remaining = secs;
    let s = (remaining % 60) as u32;
    remaining /= 60;
    let m = (remaining % 60) as u32;
    remaining /= 60;
    let h = (remaining % 24) as u32;
    remaining /= 24;

    let mut days = remaining as u32;
    let mut year = 1970u32;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let month_days: [u32; 12] = [31, if is_leap(year) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 0u32;
    for (i, &md) in month_days.iter().enumerate() {
        if days < md {
            month = i as u32 + 1;
            break;
        }
        days -= md;
    }
    let day = days + 1;

    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, h, m, s)
}

fn is_leap(year: u32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}
