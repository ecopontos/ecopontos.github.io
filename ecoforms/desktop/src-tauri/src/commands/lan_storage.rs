use std::fs;
use std::io::Write;
use std::path::PathBuf;
use base64::{engine::general_purpose::STANDARD as B64, Engine};

/// Validates that a path is safe: no `..` components, is absolute or relative-clean.
fn validate_path(path: &str) -> Result<PathBuf, String> {
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
    Ok(p)
}

/// Reads a file from the local filesystem and returns its contents as a base64 string.
#[tauri::command]
pub fn lan_read_file(path: String) -> Result<String, String> {
    let p = validate_path(&path)?;
    let bytes = fs::read(&p).map_err(|e| format!("lan_read_file: {}", e))?;
    Ok(B64.encode(bytes))
}

/// Writes base64-encoded content to a file, creating parent directories as needed.
#[tauri::command]
pub fn lan_write_file(path: String, content: String) -> Result<(), String> {
    let p = validate_path(&path)?;
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("lan_write_file mkdir: {}", e))?;
        }
    }
    let bytes = B64.decode(&content).map_err(|e| format!("lan_write_file decode: {}", e))?;
    let mut file = fs::File::create(&p).map_err(|e| format!("lan_write_file create: {}", e))?;
    file.write_all(&bytes).map_err(|e| format!("lan_write_file write: {}", e))?;
    Ok(())
}

/// Lists filenames (not full paths) in a directory.
#[tauri::command]
pub fn lan_list_dir(path: String) -> Result<Vec<String>, String> {
    let p = validate_path(&path)?;
    if !p.exists() {
        return Ok(vec![]);
    }
    let entries = fs::read_dir(&p).map_err(|e| format!("lan_list_dir: {}", e))?;
    let mut names: Vec<String> = entries
        .filter_map(|e| {
            let entry = e.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            Some(name)
        })
        .collect();
    names.sort();
    Ok(names)
}
