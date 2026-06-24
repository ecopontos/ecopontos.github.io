use postgres::{Client, NoTls};
use serde::Serialize;
use tauri::State;

use crate::database::DbState;
use crate::commands::audit::log_audit;

#[derive(Debug, Serialize)]
pub struct ResiduoExterno {
    pub id_cad_residuo: i32,
    pub descricao: String,
    pub sigla: Option<String>,
    pub ativo: bool,
}

#[derive(Debug, Serialize)]
pub struct FetchResiduosResult {
    pub dados: Vec<ResiduoExterno>,
    pub total: usize,
    pub conectado: bool,
}

#[derive(Debug, Serialize)]
pub struct SyncResiduosResult {
    pub inseridos: usize,
    pub atualizados: usize,
    pub erros: usize,
    pub total_externo: usize,
    pub mensagem: String,
}

#[tauri::command]
pub fn fetch_residuos_externos(
    pg_host: String,
    pg_port: u16,
    pg_db: String,
    pg_user: String,
    pg_password: String,
) -> Result<FetchResiduosResult, String> {
    let conn_string = format!(
        "host={} port={} dbname={} user={} password={} connect_timeout=5",
        pg_host, pg_port, pg_db, pg_user, pg_password
    );

    let mut pg_client =
        Client::connect(&conn_string, NoTls).map_err(|e| format!("Erro ao conectar no PostgreSQL: {}", e))?;

    let query = r#"
        SELECT
            id_cad_residuo,
            descricao,
            sigla,
            ativo
        FROM comcap.cad_residuo
        ORDER BY descricao
    "#;

    let pg_rows = pg_client
        .query(query, &[])
        .map_err(|e| format!("Erro ao consultar cad_residuo: {}", e))?;

    let dados: Vec<ResiduoExterno> = pg_rows
        .iter()
        .map(|row| {
            let ativo_val: Option<i16> = row.get("ativo");
            ResiduoExterno {
                id_cad_residuo: row.get("id_cad_residuo"),
                descricao: row.get("descricao"),
                sigla: row.get("sigla"),
                ativo: ativo_val.unwrap_or(0) != 0,
            }
        })
        .collect();

    let total = dados.len();

    Ok(FetchResiduosResult {
        dados,
        total,
        conectado: true,
    })
}

#[tauri::command]
pub fn sync_residuos_externos(
    state: State<'_, DbState>,
    pg_host: String,
    pg_port: u16,
    pg_db: String,
    pg_user: String,
    pg_password: String,
) -> Result<SyncResiduosResult, String> {
    let conn_string = format!(
        "host={} port={} dbname={} user={} password={} connect_timeout=5",
        pg_host, pg_port, pg_db, pg_user, pg_password
    );

    let mut pg_client =
        Client::connect(&conn_string, NoTls).map_err(|e| format!("Erro ao conectar no PostgreSQL: {}", e))?;

    let query = r#"
        SELECT
            id_cad_residuo,
            descricao,
            sigla,
            ativo
        FROM comcap.cad_residuo
        ORDER BY id_cad_residuo
    "#;

    let pg_rows = pg_client
        .query(query, &[])
        .map_err(|e| format!("Erro ao consultar cad_residuo: {}", e))?;

    let total_externo = pg_rows.len();

    let conn_guard = state.conn.lock().unwrap();
    let sqlite_conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Banco SQLite não conectado".to_string())?;

    let mut inseridos = 0usize;
    let mut atualizados = 0usize;
    let mut erros = 0usize;

    for row in &pg_rows {
        let id_cad_residuo: i32 = row.get("id_cad_residuo");
        let descricao: String = row.get("descricao");
        let sigla: Option<String> = row.get("sigla");
        let ativo_val: Option<i16> = row.get("ativo");
        let ativo = ativo_val.unwrap_or(0) != 0;

        let codigo = sigla
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| id_cad_residuo.to_string());

        let exists: bool = sqlite_conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM tipos_residuo WHERE id_externo = ?1",
                [id_cad_residuo],
                |r| r.get(0),
            )
            .unwrap_or(false);

        let result = if exists {
            sqlite_conn.execute(
                "UPDATE tipos_residuo SET nome = ?1, codigo = ?2, sigla = ?3, ativo = ?4 WHERE id_externo = ?5",
                rusqlite::params![descricao, codigo, sigla, ativo as i32, id_cad_residuo],
            )
        } else {
            let new_id = uuid::Uuid::new_v4().to_string();
            sqlite_conn.execute(
                "INSERT INTO tipos_residuo (id, codigo, nome, descricao, cor, ativo, id_externo, sigla, criado_em) VALUES (?1, ?2, ?3, ?4, '#6B7280', ?5, ?6, ?7, datetime('now'))",
                rusqlite::params![new_id, codigo, descricao, descricao, ativo as i32, id_cad_residuo, sigla],
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
                log::error!("Erro ao sincronizar residuo id_externo={}: {}", id_cad_residuo, e);
            }
        }
    }

    let _ = log_audit(
        sqlite_conn,
        "system",
        "admin",
        "sync.residuos.externos",
        Some("tipos_residuo"),
        None,
        None,
        None,
        Some(&format!("inseridos={} atualizados={} erros={}", inseridos, atualizados, erros)),
    );

    Ok(SyncResiduosResult {
        inseridos,
        atualizados,
        erros,
        total_externo,
        mensagem: format!(
            "Sincronização concluída: {} inseridos, {} atualizados, {} erros (total externo: {})",
            inseridos, atualizados, erros, total_externo
        ),
    })
}
