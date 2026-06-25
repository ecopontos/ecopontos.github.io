use std::sync::Mutex;
use std::time::Instant;
use tauri::State;
use rusqlite::Connection;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionInfo {
    pub user_id: String,
    pub perfil: String,
}

pub struct SessionState {
    pub user_id: Mutex<Option<String>>,
    pub perfil: Mutex<Option<String>>,
    pub validated_at: Mutex<Option<Instant>>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            user_id: Mutex::new(None),
            perfil: Mutex::new(None),
            validated_at: Mutex::new(None),
        }
    }

    /// Re-valida no banco se o usuário ainda existe e está ativo.
    pub fn validate_against_db(&self, conn: &Connection) -> Result<(String, String), String> {
        let user_id = self.user_id.lock()
            .map_err(|e| format!("Session lock poisoned: {}", e))?
            .clone()
            .ok_or("Sessão não iniciada".to_string())?;

        let perfil = self.perfil.lock()
            .map_err(|e| format!("Session lock poisoned: {}", e))?
            .clone()
            .ok_or("Sessão não iniciada".to_string())?;

        let row: (String, i64) = conn.query_row(
            "SELECT perfil, ativo FROM usuarios WHERE id = ?1 LIMIT 1",
            [&user_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
        ).map_err(|_| "Usuário não encontrado ou sessão inválida".to_string())?;

        if row.1 != 1 {
            return Err("Usuário inativo. Sessão encerrada.".to_string());
        }

        if row.0 != perfil {
            return Err("Perfil do usuário alterado. Faça login novamente.".to_string());
        }

        *self.validated_at.lock().map_err(|e| format!("Lock poisoned: {}", e))? = Some(Instant::now());

        Ok((user_id, perfil))
    }
}

#[tauri::command]
pub fn set_session(
    user_id: String,
    perfil: String,
    db_state: State<'_, crate::database::DbState>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let conn_guard = db_state.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados não conectado")?;

    // Validar no banco antes de aceitar a sessão
    let row: (String, i64) = conn.query_row(
        "SELECT perfil, ativo FROM usuarios WHERE id = ?1 LIMIT 1",
        [&user_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
    ).map_err(|_| "Usuário não encontrado".to_string())?;

    if row.1 != 1 {
        return Err("Usuário inativo".to_string());
    }
    if row.0 != perfil {
        return Err("Perfil inválido".to_string());
    }

    *session.user_id.lock().map_err(|e| format!("Lock poisoned: {}", e))? = Some(user_id);
    *session.perfil.lock().map_err(|e| format!("Lock poisoned: {}", e))? = Some(perfil);
    *session.validated_at.lock().map_err(|e| format!("Lock poisoned: {}", e))? = Some(Instant::now());

    Ok(())
}

#[tauri::command]
pub fn clear_session(session: State<'_, SessionState>) -> Result<(), String> {
    *session.user_id.lock().map_err(|e| format!("Lock poisoned: {}", e))? = None;
    *session.perfil.lock().map_err(|e| format!("Lock poisoned: {}", e))? = None;
    *session.validated_at.lock().map_err(|e| format!("Lock poisoned: {}", e))? = None;
    Ok(())
}

#[tauri::command]
pub fn get_session(session: State<'_, SessionState>) -> Result<Option<SessionInfo>, String> {
    let user_id = session.user_id.lock().map_err(|e| format!("Lock poisoned: {}", e))?.clone();
    let perfil = session.perfil.lock().map_err(|e| format!("Lock poisoned: {}", e))?.clone();

    match (user_id, perfil) {
        (Some(uid), Some(p)) => Ok(Some(SessionInfo { user_id: uid, perfil: p })),
        _ => Ok(None),
    }
}
