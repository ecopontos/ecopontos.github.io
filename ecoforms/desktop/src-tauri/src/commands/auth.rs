use rusqlite::OptionalExtension;
use serde::Serialize;
use tauri::State;

use crate::check_password;
use crate::database::{row_value_to_json, DbState};

/// Colunas que nunca devem ser devolvidas ao frontend, mesmo neste command
/// dedicado de login (a verificação de senha já ocorre aqui, em Rust).
const SENSITIVE_COLUMNS: [&str; 3] = ["hash_senha", "password_hash", "sal_sync"];

#[derive(Debug, Serialize)]
pub struct LoginResult {
    pub found: bool,
    pub password_valid: bool,
    pub user: Option<serde_json::Value>,
}

/// Busca um usuário por `nome_usuario` e verifica a senha em Rust, sem nunca
/// expor `hash_senha`/`password_hash`/`sal_sync` ao frontend (diferente de
/// `db_query`, que bloqueia a leitura dessas colunas por completo).
#[tauri::command]
pub fn db_login(
    username: String,
    password: String,
    state: State<'_, DbState>,
) -> Result<LoginResult, String> {
    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    let mut stmt = conn
        .prepare("SELECT * FROM usuarios WHERE nome_usuario = ?1 LIMIT 1")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let columns: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();

    let values = stmt
        .query_row([&username], |row| {
            let mut values = Vec::new();
            for i in 0..columns.len() {
                values.push(row_value_to_json(row, i)?);
            }
            Ok(values)
        })
        .optional()
        .map_err(|e| format!("Query failed: {}", e))?;

    let Some(values) = values else {
        return Ok(LoginResult {
            found: false,
            password_valid: false,
            user: None,
        });
    };

    let hash_senha = columns
        .iter()
        .position(|c| c.eq_ignore_ascii_case("hash_senha"))
        .and_then(|i| values[i].as_str())
        .unwrap_or("");

    let password_valid = check_password(&password, hash_senha);

    let mut user = serde_json::Map::new();
    for (col, value) in columns.iter().zip(values.into_iter()) {
        let lower = col.to_lowercase();
        if SENSITIVE_COLUMNS.iter().any(|c| *c == lower) {
            continue;
        }
        user.insert(col.clone(), value);
    }

    Ok(LoginResult {
        found: true,
        password_valid,
        user: Some(serde_json::Value::Object(user)),
    })
}
