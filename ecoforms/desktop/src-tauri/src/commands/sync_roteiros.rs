use postgres::{Client, NoTls};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::audit::log_audit;
use crate::commands::crypto::CryptoState;
use crate::commands::legacy_sync::{build_conn_string, load_pg_legacy_credentials};
use crate::database::DbState;
use crate::session::SessionState;

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub inseridos: usize,
    pub atualizados: usize,
    pub erros: usize,
    pub total_externo: usize,
    pub mensagem: String,
    pub detalhes_erros: Vec<String>,
}

#[tauri::command]
pub fn sync_roteiros_externos(
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    crypto: State<'_, CryptoState>,
) -> Result<SyncResult, String> {
    let actor_id = session.user_id.lock()
        .map_err(|e| format!("Session lock poisoned: {e}"))?
        .clone()
        .ok_or("Sessão não iniciada — faça login antes de sincronizar")?;
    let actor_perfil = session.perfil.lock()
        .map_err(|e| format!("Session lock poisoned: {e}"))?
        .clone()
        .unwrap_or_else(|| "operacional".to_string());
    let conn_guard = state.conn.lock().map_err(|e| format!("Database lock poisoned: {}", e))?;
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Banco SQLite não conectado".to_string())?;
    let pg_config = load_pg_legacy_credentials(conn, &session, &crypto, &state)?;
    let conn_string = build_conn_string(&pg_config);

    let mut pg_client =
        Client::connect(&conn_string, NoTls).map_err(|e| format!("Erro ao conectar no PostgreSQL: {}", e))?;

    let query = r#"
        SELECT
            r.id_roteiro,
            r.nm_roteiro,
            r.descricao,
            s.descricao AS situacao_nome,
            t.descricao AS turno_nome,
            b.descricao AS base_nome,
            res.descricao AS residuo_nome,
            r.id_periodicidade AS periodicidade_raw,
            r.dt_cadastro::text,
            r.dt_atualizacao::text,
            r.nu_peso_estimado,
            r.nu_km_estimado,
            r.id_departamento,
            d.descricao AS departamento_nome
        FROM comcap.cad_roteiro r
        LEFT JOIN comcap.cad_situacao s ON r.id_situacao = s.id_cad_situacao
        LEFT JOIN comcap.cad_turno t ON r.id_turno = t.id_cad_turno
        LEFT JOIN comcap.cad_base b ON r.id_base = b.id_cad_base
        LEFT JOIN comcap.cad_residuo res ON r.id_residuo = res.id_cad_residuo
        LEFT JOIN comcap.cad_departamento d ON r.id_departamento = d.id_cad_departamento
        ORDER BY r.id_roteiro
    "#;

    let pg_rows = pg_client
        .query(query, &[])
        .map_err(|e| format!("Erro ao consultar cad_roteiro: {}", e))?;

    let total_externo = pg_rows.len();

    let periodicidade_query = "SELECT id_cad_periodicidade, descricao FROM comcap.cad_periodicidade";
    let period_map_rows = pg_client
        .query(periodicidade_query, &[])
        .map_err(|e| format!("Erro ao consultar cad_periodicidade: {}", e))?;

    let mut period_map: std::collections::HashMap<i32, String> = std::collections::HashMap::new();
    for pr in &period_map_rows {
        let id: i32 = pr.get(0);
        let desc: String = pr.get(1);
        period_map.insert(id, desc);
    }

    let sqlite_conn = conn;

    let mut inseridos = 0usize;
    let mut atualizados = 0usize;
    let mut erros = 0usize;
    let mut detalhes_erros: Vec<String> = Vec::new();

    for row in &pg_rows {
        let id_roteiro: i32 = row.get(0);
        let codigo = id_roteiro.to_string();
        let nome = row.get::<_, Option<String>>(1).unwrap_or_default();
        let descricao = row.get::<_, Option<String>>(2);
        let situacao_nome = row.get::<_, Option<String>>(3);
        let turno_nome = row.get::<_, Option<String>>(4);
        let base_nome = row.get::<_, Option<String>>(5);
        let residuo_nome = row.get::<_, Option<String>>(6);
        let periodicidade_raw = row.get::<_, Option<String>>(7);
        let dt_cadastro = row.get::<_, Option<String>>(8);
        let dt_atualizacao = row.get::<_, Option<String>>(9);
        let _nu_peso_estimado: Option<f64> = row.get(10);
        let _nu_km_estimado: Option<f64> = row.get(11);

        let periodicidade_nomes = periodicidade_raw.as_ref().map(|raw| {
            raw.split(',')
                .filter_map(|id_str| {
                    let id: i32 = id_str.trim().parse().ok()?;
                    period_map.get(&id).cloned()
                })
                .collect::<Vec<_>>()
                .join(", ")
        });

        let situacao = match situacao_nome.as_deref() {
            Some("Ativo") => "ativo",
            Some("Inativo") => "inativo",
            _ => "inativo",
        };

        let criado_em = dt_cadastro.unwrap_or_else(|| "datetime('now')".to_string());
        let atualizado_em = dt_atualizacao.unwrap_or_else(|| "datetime('now')".to_string());

        let exists: bool = sqlite_conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM roteiros WHERE codigo = ?1",
                [&codigo],
                |r| r.get(0),
            )
            .unwrap_or(false);

        let result = if exists {
            sqlite_conn.execute(
                "UPDATE roteiros SET nome = ?1, descricao = ?2, periodicidade = ?3, turno = ?4, base = ?5, situacao = ?6, residuo = ?7, atualizado_em = ?8 WHERE codigo = ?9",
                rusqlite::params![
                    nome,
                    descricao,
                    periodicidade_nomes.unwrap_or_default(),
                    turno_nome,
                    base_nome,
                    situacao,
                    residuo_nome,
                    atualizado_em,
                    codigo,
                ],
            )
        } else {
            let new_id = Uuid::new_v4().to_string();
            sqlite_conn.execute(
                "INSERT INTO roteiros (id, codigo, nome, descricao, periodicidade, turno, base, situacao, residuo, criado_por, criado_em, atualizado_em) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                rusqlite::params![
                    new_id,
                    codigo,
                    nome,
                    descricao,
                    periodicidade_nomes.unwrap_or_default(),
                    turno_nome,
                    base_nome,
                    situacao,
                    residuo_nome,
                    actor_id,
                    criado_em,
                    atualizado_em,
                ],
            )
        };

        match result {
            Ok(_) => {
                if exists {
                    atualizados += 1;
                } else {
                    inseridos += 1;
                }
            }
            Err(e) => {
                erros += 1;
                let detalhe = format!("Roteiro {}: {}", codigo, e);
                log::error!("Erro ao sincronizar roteiro {}: {}", codigo, e);
                detalhes_erros.push(detalhe);
            }
        }
    }

    let _ = log_audit(sqlite_conn, &actor_id, &actor_perfil, "sync.roteiros.externos", Some("roteiros"), None, None, None, Some(&format!("inseridos={} atualizados={} erros={}", inseridos, atualizados, erros)));

    Ok(SyncResult {
        inseridos,
        atualizados,
        erros,
        total_externo,
        mensagem: format!(
            "Sincronização concluída: {} inseridos, {} atualizados, {} erros (total externo: {})",
            inseridos, atualizados, erros, total_externo
        ),
        detalhes_erros,
    })
}

#[tauri::command]
pub fn sync_roteiros_status(
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    crypto: State<'_, CryptoState>,
) -> Result<serde_json::Value, String> {
    let conn_guard = state.conn.lock().map_err(|e| format!("Database lock poisoned: {}", e))?;
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Banco SQLite não conectado".to_string())?;
    let pg_config = load_pg_legacy_credentials(conn, &session, &crypto, &state)?;
    let conn_string = build_conn_string(&pg_config);

    let mut pg_client =
        Client::connect(&conn_string, NoTls).map_err(|e| format!("Erro ao conectar no PostgreSQL: {}", e))?;

    let count: i64 = pg_client
        .query_one("SELECT COUNT(*) FROM comcap.cad_roteiro", &[])
        .map_err(|e| format!("Erro ao consultar cad_roteiro: {}", e))?
        .get(0);

    let sqlite_conn = conn;

    let local_count: i64 = sqlite_conn
        .query_row("SELECT COUNT(*) FROM roteiros WHERE codigo IS NOT NULL", [], |r| r.get(0))
        .unwrap_or(0);

    Ok(serde_json::json!({
        "total_externo": count,
        "total_local": local_count,
        "conectado": true,
    }))
}
