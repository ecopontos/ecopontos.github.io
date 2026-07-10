use rusqlite::Connection;
use crate::uuid_v7::uuid_v7_string;

/// Registra uma entrada de auditoria em log_auditoria (somente local).
#[allow(clippy::too_many_arguments)]
pub fn log_audit(
    conn: &Connection,
    actor_id: &str,
    actor_perfil: &str,
    action: &str,
    target_table: Option<&str>,
    target_id: Option<&str>,
    old_value: Option<&str>,
    new_value: Option<&str>,
    metadata: Option<&str>,
) -> Result<String, String> {
    let audit_id = uuid_v7_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO log_auditoria (id, id_ator, perfil_ator, acao, tabela_alvo, id_alvo, valor_anterior, valor_novo, metadados, criado_em, sincronizado)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0)",
        [
            &audit_id,
            actor_id,
            actor_perfil,
            action,
            target_table.unwrap_or(""),
            target_id.unwrap_or(""),
            old_value.unwrap_or(""),
            new_value.unwrap_or(""),
            metadata.unwrap_or(""),
            &now,
        ],
    ).map_err(|e| format!("Erro ao registrar audit log: {}", e))?;

    // Auditoria fica apenas local. O enfileiramento em fila_eventos_sync foi
    // removido: montava um envelope com seq=0/checksum vazio/routing "default"
    // que chegava inválido ao push (não há EventBus no path desktop).
    // Para sincronizar auditoria no futuro, emitir via SyncOutbox (bridge TS).

    Ok(audit_id)
}
