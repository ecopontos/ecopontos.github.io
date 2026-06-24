use tauri::State;
use crate::database::DbState;
use crate::session::SessionState;
use crate::commands::rbac::check_permission;
use crate::commands::audit::log_audit;

fn validate_session_and_permission(
    session: &SessionState,
    db: &DbState,
    permissao: &str,
) -> Result<(String, String), String> {
    let conn_guard = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados não conectado")?;

    let (user_id, perfil) = session.validate_against_db(conn)?;
    check_permission(conn, &perfil, permissao)?;

    Ok((user_id, perfil))
}

// ── Demanda ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn demanda_aceitar(
    id: String,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let (user_id, perfil) = validate_session_and_permission(&session, &db, "activities.manage")?;

    let conn_guard = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados não conectado")?;

    conn.execute(
        "UPDATE demandas SET status = 'aceita', aceito_por = ?2, aceito_em = datetime('now'), atualizado_em = datetime('now') WHERE id = ?1",
        [&id, &user_id],
    ).map_err(|e| format!("Erro ao aceitar demanda: {}", e))?;

    let _ = log_audit(conn, &user_id, &perfil, "demanda.aceitar", Some("demandas"), Some(&id), None, None, None);
    Ok(())
}

#[tauri::command]
pub fn demanda_encerrar(
    id: String,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<(), String> {
    let (user_id, perfil) = validate_session_and_permission(&session, &db, "activities.manage")?;

    let conn_guard = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados não conectado")?;

    conn.execute(
        "UPDATE demandas SET status = 'encerrada', encerrado_por = ?2, encerrado_em = datetime('now'), atualizado_em = datetime('now') WHERE id = ?1",
        [&id, &user_id],
    ).map_err(|e| format!("Erro ao encerrar demanda: {}", e))?;

    let _ = log_audit(conn, &user_id, &perfil, "demanda.encerrar", Some("demandas"), Some(&id), None, None, None);
    Ok(())
}

// ── Ecoponto ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn ecoponto_agendar_remocao(
    ecoponto_id: String,
    setor_destino: String,
    observacao: Option<String>,
    db: State<'_, DbState>,
    session: State<'_, SessionState>,
) -> Result<String, String> {
    let (user_id, perfil) = validate_session_and_permission(&session, &db, "activities.manage")?;

    let conn_guard = db.conn.lock().map_err(|e| format!("Lock poisoned: {}", e))?;
    let conn = conn_guard.as_ref().ok_or("Banco de dados não conectado")?;

    let tarefa_id = format!("{:x}", rand::random::<u128>());

    conn.execute(
        "INSERT INTO tarefas (id, titulo, status, setor_id, criado_por, criado_em, atualizado_em) VALUES (?1, ?2, 'todo', ?3, ?4, datetime('now'), datetime('now'))",
        [&tarefa_id, &format!("Remocao ecoponto {}", ecoponto_id), &setor_destino, &user_id],
    ).map_err(|e| format!("Erro ao criar tarefa de remocao: {}", e))?;

    let _ = log_audit(conn, &user_id, &perfil, "ecoponto.agendar_remocao", Some("tarefas"), Some(&tarefa_id), None, Some(&observacao.unwrap_or_default()), None);
    Ok(tarefa_id)
}
