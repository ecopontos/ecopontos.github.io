use rusqlite::Connection;
use serde_json::json;

/// Registra uma entrada de auditoria em log_auditoria e opcionalmente na fila_eventos_sync.
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
    let audit_id = format!("{:x}", rand::random::<u128>());
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

    // Inserir evento audit.registro na fila_eventos_sync para envio à nuvem
    let event_id = format!("{:x}", rand::random::<u128>());
    let envelope = json!({
        "v": 2,
        "id": event_id,
        "type": "audit.registro",
        "source": {
            "device_id": "desktop",
            "routing_id": "default",
            "routing_type": "setor",
            "module": "audit",
            "app_version": env!("CARGO_PKG_VERSION"),
        },
        "aggregate": {
            "type": "audit",
            "id": audit_id,
        },
        "time": now,
        "schema_version": 1,
        "seq": 0, // será sobrescrito pelo EventBus ao processar
        "prev_event_id": null,
        "correlation_id": null,
        "causation_id": null,
        "data": {
            "action": action,
            "actor_id": actor_id,
            "actor_perfil": actor_perfil,
            "target_table": target_table,
            "target_id": target_id,
        },
        "checksum": "", // o EventBus calcula o checksum ao processar
    });

    let _ = conn.execute(
        "INSERT INTO fila_eventos_sync (id, tipo, carga, tipo_agregado, id_agregado, sequencia, situacao, criado_em)
         VALUES (?1, 'audit.registro', ?2, 'audit', ?3, 0, 'pending', ?4)",
        [
            &event_id,
            &envelope.to_string(),
            &audit_id,
            &now,
        ],
    );

    Ok(audit_id)
}
