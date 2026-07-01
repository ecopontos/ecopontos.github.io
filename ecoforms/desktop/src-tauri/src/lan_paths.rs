use rusqlite::Connection;
use std::fs;
use std::path::{Component, Path, PathBuf};

pub fn read_lan_sync_path(conn: &Connection) -> Result<Option<PathBuf>, String> {
    let result = conn.query_row(
        "SELECT valor FROM configuracoes_sistema WHERE chave = 'lan_sync_path' LIMIT 1",
        [],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(Some(PathBuf::from(trimmed)))
            }
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(err) => {
            let msg = err.to_string();
            if msg.contains("no such table") {
                Ok(None)
            } else {
                Err(format!("Failed to read lan_sync_path: {err}"))
            }
        }
    }
}

pub fn resolve_lan_base_path(conn: &Connection) -> Result<PathBuf, String> {
    read_lan_sync_path(conn)?.ok_or_else(|| "LAN sync path not configured".to_string())
}

pub fn canonicalize_base_dir(base: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(base)
        .map_err(|e| format!("Failed to create base directory {}: {e}", base.display()))?;
    fs::canonicalize(base)
        .map_err(|e| format!("Failed to resolve base directory {}: {e}", base.display()))
}

pub fn confine_relative_path(base: &Path, rel_path: &str, allow_empty: bool) -> Result<PathBuf, String> {
    let normalized = normalize_relative_path(rel_path, allow_empty)?;
    if normalized.as_os_str().is_empty() {
        return Ok(base.to_path_buf());
    }
    let target = base.join(normalized);
    verify_no_symlink_escape(base, &target)?;
    Ok(target)
}

/// Verifica que `target` não escapa de `base` via symlink.
/// Para caminhos existentes, canonicaliza o alvo e exige `starts_with(base)`.
/// Para caminhos não criados ainda (write), canonicaliza o pai existente.
pub fn verify_no_symlink_escape(base: &Path, target: &Path) -> Result<(), String> {
    if target.exists() {
        let resolved = fs::canonicalize(target)
            .map_err(|e| format!("Failed to resolve target path: {e}"))?;
        if !resolved.starts_with(base) {
            return Err("Path escapes the allowed base directory (symlink)".to_string());
        }
    } else if let Some(parent) = target.parent() {
        if parent.exists() {
            let resolved_parent = fs::canonicalize(parent)
                .map_err(|e| format!("Failed to resolve parent directory: {e}"))?;
            if !resolved_parent.starts_with(base) {
                return Err("Parent path escapes the allowed base directory (symlink)".to_string());
            }
        }
    }
    Ok(())
}

pub fn normalize_relative_path(rel_path: &str, allow_empty: bool) -> Result<PathBuf, String> {
    if rel_path.is_empty() {
        return if allow_empty {
            Ok(PathBuf::new())
        } else {
            Err("Relative path must not be empty".to_string())
        };
    }

    let candidate = Path::new(rel_path);
    if candidate.is_absolute() {
        return Err("Absolute paths are not allowed".to_string());
    }

    let mut cleaned = PathBuf::new();
    for component in candidate.components() {
        match component {
            Component::Normal(part) => cleaned.push(part),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Path traversal and absolute prefixes are not allowed".to_string());
            }
        }
    }

    if cleaned.as_os_str().is_empty() && !allow_empty {
        return Err("Relative path must not be empty".to_string());
    }

    Ok(cleaned)
}

pub fn no_users_exist(conn: &Connection) -> bool {
    conn.query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get::<_, i64>(0))
        .map(|count| count == 0)
        .unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::env;

    fn temp_dir(prefix: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!(
            "{}-{}",
            prefix,
            uuid::Uuid::new_v4().simple(),
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn normalize_relative_path_rejects_absolute() {
        assert!(normalize_relative_path("/tmp/ecoforms.db", false).is_err());
    }

    #[test]
    fn normalize_relative_path_rejects_parent_dir() {
        assert!(normalize_relative_path("../escape.db", false).is_err());
    }

    #[test]
    fn confine_relative_path_allows_empty_for_base_listing() {
        let base = temp_dir("lan-path-base");
        let confined = confine_relative_path(&base, "", true).unwrap();
        assert_eq!(confined, base);
    }

    #[test]
    fn read_lan_sync_path_returns_configured_path() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE configuracoes_sistema (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TEXT);",
        )
        .unwrap();
        let target = temp_dir("lan-path-config");
        db.execute(
            "INSERT INTO configuracoes_sistema (chave, valor, atualizado_em) VALUES ('lan_sync_path', ?1, datetime('now'))",
            [&target.to_string_lossy().to_string()],
        )
        .unwrap();

        let resolved = read_lan_sync_path(&db).unwrap().unwrap();
        assert_eq!(resolved, target);
    }
}
