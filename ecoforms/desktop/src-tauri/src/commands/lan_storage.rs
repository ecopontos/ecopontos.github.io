use base64::{engine::general_purpose::STANDARD as B64, Engine};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::State;

use crate::database::DbState;
use crate::lan_paths;
use crate::session::SessionState;

fn conn_from_state<'a>(state: &'a State<'_, DbState>) -> Result<std::sync::MutexGuard<'a, Option<rusqlite::Connection>>, String> {
    state.conn.lock().map_err(|e| format!("Database lock poisoned: {e}"))
}

fn authorize_lan_access(conn: &rusqlite::Connection, session: &SessionState) -> Result<(), String> {
    match session.validate_against_db(conn) {
        Ok(_) => Ok(()),
        Err(err) if lan_paths::no_users_exist(conn) => Ok(()),
        Err(err) => Err(err),
    }
}

fn authorize_lan_write(conn: &rusqlite::Connection, session: &SessionState) -> Result<(), String> {
    match session.validate_against_db(conn) {
        Ok(_) => Ok(()),
        Err(err) if lan_paths::no_users_exist(conn) => Ok(()),
        Err(err) => Err(err),
    }
}

fn resolve_lan_target(conn: &rusqlite::Connection, rel_path: &str, allow_empty: bool) -> Result<PathBuf, String> {
    let base = lan_paths::resolve_lan_base_path(conn)?;
    let base = lan_paths::canonicalize_base_dir(&base)?;
    lan_paths::confine_relative_path(&base, rel_path, allow_empty)
}

fn ensure_parent_dir(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory {}: {e}", parent.display()))?;
        }
    }
    Ok(())
}

/// Reads a file from the LAN storage root and returns its contents as base64.
#[tauri::command]
pub fn lan_read_file(
    path: String,
    db_state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let conn_guard = conn_from_state(&db_state)?;
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    authorize_lan_access(conn, &session)?;
    let target = resolve_lan_target(conn, &path, false)?;
    let bytes = fs::read(&target).map_err(|e| format!("lan_read_file: {e}"))?;
    Ok(B64.encode(bytes))
}

/// Writes base64-encoded content to a file inside the LAN storage root.
#[tauri::command]
pub fn lan_write_file(
    path: String,
    content: String,
    db_state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let conn_guard = conn_from_state(&db_state)?;
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    authorize_lan_write(conn, &session)?;
    let target = resolve_lan_target(conn, &path, false)?;
    ensure_parent_dir(&target)?;

    let bytes = B64.decode(&content).map_err(|e| format!("lan_write_file decode: {e}"))?;
    let mut file = fs::File::create(&target).map_err(|e| format!("lan_write_file create: {e}"))?;
    file.write_all(&bytes).map_err(|e| format!("lan_write_file write: {e}"))?;
    Ok(())
}

/// Lists filenames (not full paths) in a directory under the LAN storage root.
#[tauri::command]
pub fn lan_list_dir(
    path: String,
    db_state: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<Vec<String>, String> {
    let conn_guard = conn_from_state(&db_state)?;
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    authorize_lan_access(conn, &session)?;
    let target = resolve_lan_target(conn, &path, true)?;
    if !target.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(&target).map_err(|e| format!("lan_list_dir: {e}"))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::DbState;
    use crate::session::SessionState;
    use std::sync::Mutex;
    use tauri::Manager;

    fn setup_db() -> DbState {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE usuarios (id TEXT PRIMARY KEY, perfil TEXT, ativo INTEGER);
             CREATE TABLE tbl_configuracoes_sistema (chave TEXT PRIMARY KEY, valor TEXT, atualizado_em TEXT);
             CREATE TABLE hierarquia_perfis (perfil TEXT PRIMARY KEY, nivel INTEGER);
             INSERT INTO usuarios (id, perfil, ativo) VALUES ('user-1', 'admin', 1);
             INSERT INTO hierarquia_perfis (perfil, nivel) VALUES ('admin', 0);",
        )
        .unwrap();
        DbState {
            conn: Mutex::new(Some(conn)),
            db_path: Mutex::new(None),
        }
    }

    fn make_app(db: DbState, session: SessionState) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_app();
        app.manage(db);
        app.manage(session);
        app
    }

    #[test]
    fn helper_rejects_absolute_paths() {
        assert!(lan_paths::normalize_relative_path("/tmp/evil.db", false).is_err());
    }

    #[test]
    fn helper_rejects_parent_traversal() {
        assert!(lan_paths::normalize_relative_path("../evil.db", false).is_err());
    }

    #[test]
    fn helper_allows_base_listing() {
        let base = std::env::temp_dir().join(format!("lan-base-{}", uuid::Uuid::new_v4().simple()));
        std::fs::create_dir_all(&base).unwrap();
        let confined = lan_paths::confine_relative_path(&base, "", true).unwrap();
        assert_eq!(confined, base);
    }

    #[test]
    fn read_write_list_require_valid_session_or_bootstrap() {
        let db = setup_db();
        let app = make_app(db, SessionState::new());
        let db_state = app.state::<DbState>();
        let session = app.state::<SessionState>();

        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        assert!(authorize_lan_access(conn, &session).is_err());
    }
}
