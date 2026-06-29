use std::collections::HashSet;

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
pub struct SyncPesagensResult {
    pub inseridos: usize,
    pub atualizados: usize,
    pub execucoes_criadas: usize,
    pub erros: usize,
    pub total_externo: usize,
    pub mensagem: String,
    pub detalhes_erros: Vec<String>,
}

/// Sincroniza pesagens (comcap.cad_balanca) de despachos vinculados a roteiros,
/// no intervalo [data_inicio, data_fim] (formato "YYYY-MM-DD"), para a tabela
/// local `execucao_pesagens`, criando/atualizando a `execucao_coleta` correspondente
/// e recalculando os agregados (peso_total, numero_viagens, id_despacho, codigo_despacho).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn sync_pesagens_externas(
    state: State<'_, DbState>,
    session: State<'_, SessionState>,
    crypto: State<'_, CryptoState>,
    data_inicio: String,
    data_fim: String,
) -> Result<SyncPesagensResult, String> {
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
            cb.id_balanca,
            cb.id_despacho,
            (cb.dt_pesagem + cb.hr_pesagem)::text AS data_pesagem,
            cb.dt_pesagem::text AS dt_pesagem_only,
            cdr.id_roteiro,
            ctc.descricao AS tipo_coleta,
            cb.nu_frota::text AS veiculo,
            cres.descricao AS residuo,
            co.descricao AS origem,
            cdest.descricao AS destino,
            cb.nu_liquido::float8 AS peso_liquido,
            cb.id_situacao,
            ctrl.descricao AS status_despacho
        FROM comcap.cad_balanca cb
        JOIN comcap.cad_despacho cd ON cb.id_despacho = cd.id_despacho
        JOIN comcap.cad_despacho_roteiro cdr ON cd.id_despacho = cdr.id_despacho
        JOIN comcap.cad_roteiro cr ON cdr.id_roteiro = cr.id_roteiro
        LEFT JOIN comcap.cad_tipo_coleta ctc ON cr.id_tipo_coleta = ctc.id_cad_tipo_coleta
        LEFT JOIN comcap.cad_residuo cres ON cb.id_residuo = cres.id_cad_residuo
        LEFT JOIN comcap.cad_origem co ON cb.id_origem = co.id_cad_origem
        LEFT JOIN comcap.cad_destino cdest ON cb.id_destino = cdest.id_cad_destino
        LEFT JOIN comcap.cad_controle ctrl ON cd.id_controle = ctrl.id_controle
        WHERE cb.id_situacao = 1
          AND cb.dt_pesagem >= $1::text::date
          AND cb.dt_pesagem <= $2::text::date
        ORDER BY cb.dt_pesagem, cb.id_balanca
    "#;

    let pg_rows = pg_client
        .query(query, &[&data_inicio, &data_fim])
        .map_err(|e| format!("Erro ao consultar cad_balanca: {}", e))?;

    let total_externo = pg_rows.len();

    let sqlite_conn = conn;

    let mut inseridos = 0usize;
    let mut atualizados = 0usize;
    let mut execucoes_criadas = 0usize;
    let mut erros = 0usize;
    let mut detalhes_erros: Vec<String> = Vec::new();
    let mut execucoes_afetadas: HashSet<String> = HashSet::new();

    for row in &pg_rows {
        let id_balanca: i32 = row.get(0);
        let id_despacho: i32 = row.get(1);
        let data_pesagem: String = row.get(2);
        let dt_pesagem_only: String = row.get(3);
        let id_roteiro: i32 = row.get(4);
        let tipo_coleta: Option<String> = row.get(5);
        let veiculo: Option<String> = row.get(6);
        let residuo: Option<String> = row.get(7);
        let origem: Option<String> = row.get(8);
        let destino: Option<String> = row.get(9);
        let peso_liquido: Option<f64> = row.get(10);
        let situacao: i32 = row.get(11);
        let status_despacho: Option<String> = row.get(12);

        let codigo_roteiro = id_roteiro.to_string();
        let codigo_despacho = id_despacho.to_string();

        let roteiro_local_id: Option<String> = sqlite_conn
            .query_row(
                "SELECT id FROM roteiros WHERE codigo = ?1",
                [&codigo_roteiro],
                |r| r.get(0),
            )
            .ok();

        let roteiro_local_id = match roteiro_local_id {
            Some(id) => id,
            None => {
                erros += 1;
                let detalhe = format!("Pesagem id_balanca={}: roteiro externo {} não sincronizado localmente", id_balanca, codigo_roteiro);
                log::warn!("{}", detalhe);
                detalhes_erros.push(detalhe);
                continue;
            }
        };

        let execucao_id: Option<String> = sqlite_conn
            .query_row(
                "SELECT id FROM execucao_coleta WHERE roteiro_id = ?1 AND date(data_execucao) = date(?2)",
                rusqlite::params![roteiro_local_id, dt_pesagem_only],
                |r| r.get(0),
            )
            .ok();

        let execucao_id = match execucao_id {
            Some(id) => id,
            None => {
                let new_id = Uuid::new_v4().to_string();
                let result = sqlite_conn.execute(
                    "INSERT INTO execucao_coleta (id, roteiro_id, data_execucao, status, criado_em) VALUES (?1, ?2, ?3, 'concluida', datetime('now'))",
                    rusqlite::params![new_id, roteiro_local_id, dt_pesagem_only],
                );
                match result {
                    Ok(_) => {
                        execucoes_criadas += 1;
                        new_id
                    }
                    Err(e) => {
                        erros += 1;
                        let detalhe = format!("Execução roteiro {} em {}: {}", roteiro_local_id, dt_pesagem_only, e);
                        log::error!("Erro ao criar execução para roteiro {} em {}: {}", roteiro_local_id, dt_pesagem_only, e);
                        detalhes_erros.push(detalhe);
                        continue;
                    }
                }
            }
        };

        let pesagem_exists: Option<String> = sqlite_conn
            .query_row(
                "SELECT id FROM execucao_pesagens WHERE id_balanca = ?1",
                [id_balanca],
                |r| r.get(0),
            )
            .ok();

        let result = match &pesagem_exists {
            Some(pesagem_id) => sqlite_conn.execute(
                "UPDATE execucao_pesagens SET
                    execucao_id = ?1, id_despacho = ?2, codigo_despacho = ?3, data_pesagem = ?4,
                    veiculo = ?5, residuo = ?6, origem = ?7, destino = ?8, tipo_coleta = ?9,
                    peso_liquido = ?10, situacao = ?11, status_despacho = ?12
                 WHERE id = ?13",
                rusqlite::params![
                    execucao_id, id_despacho, codigo_despacho, data_pesagem,
                    veiculo, residuo, origem, destino, tipo_coleta,
                    peso_liquido, situacao, status_despacho, pesagem_id,
                ],
            ),
            None => {
                let new_id = Uuid::new_v4().to_string();
                sqlite_conn.execute(
                    "INSERT INTO execucao_pesagens
                        (id, execucao_id, id_balanca, id_despacho, codigo_despacho, data_pesagem,
                         veiculo, residuo, origem, destino, tipo_coleta, peso_liquido, situacao, status_despacho)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                    rusqlite::params![
                        new_id, execucao_id, id_balanca, id_despacho, codigo_despacho, data_pesagem,
                        veiculo, residuo, origem, destino, tipo_coleta, peso_liquido, situacao, status_despacho,
                    ],
                )
            }
        };

        match result {
            Ok(_) => {
                execucoes_afetadas.insert(execucao_id);
                if pesagem_exists.is_some() {
                    atualizados += 1;
                } else {
                    inseridos += 1;
                }
            }
            Err(e) => {
                erros += 1;
                let detalhe = format!("Pesagem id_balanca={}: {}", id_balanca, e);
                log::error!("Erro ao sincronizar pesagem id_balanca={}: {}", id_balanca, e);
                detalhes_erros.push(detalhe);
            }
        }
    }

    // id_despacho/codigo_despacho refletem apenas o despacho mais recente do dia quando há
    // múltiplos despachos por roteiro/data — ver docs/BACKEND_NAO_EXPOSTO.md secao 6.
    for execucao_id in &execucoes_afetadas {
        let _ = sqlite_conn.execute(
            "UPDATE execucao_coleta SET
                peso_total = (SELECT COALESCE(SUM(peso_liquido), 0) FROM execucao_pesagens WHERE execucao_id = ?1),
                numero_viagens = (SELECT COUNT(*) FROM execucao_pesagens WHERE execucao_id = ?1),
                id_despacho = (SELECT id_despacho FROM execucao_pesagens WHERE execucao_id = ?1 ORDER BY data_pesagem DESC LIMIT 1),
                codigo_despacho = (SELECT codigo_despacho FROM execucao_pesagens WHERE execucao_id = ?1 ORDER BY data_pesagem DESC LIMIT 1)
             WHERE id = ?1",
            [execucao_id],
        );
    }

    let _ = log_audit(
        sqlite_conn,
        &actor_id,
        &actor_perfil,
        "sync.pesagens.externas",
        Some("execucao_pesagens"),
        None,
        None,
        None,
        Some(&format!(
            "inseridos={} atualizados={} execucoes_criadas={} erros={} periodo={}..{}",
            inseridos, atualizados, execucoes_criadas, erros, data_inicio, data_fim
        )),
    );

    Ok(SyncPesagensResult {
        inseridos,
        atualizados,
        execucoes_criadas,
        erros,
        total_externo,
        mensagem: format!(
            "Sincronização concluída: {} pesagens inseridas, {} atualizadas, {} execuções criadas, {} erros (total externo: {})",
            inseridos, atualizados, execucoes_criadas, erros, total_externo
        ),
        detalhes_erros,
    })
}
