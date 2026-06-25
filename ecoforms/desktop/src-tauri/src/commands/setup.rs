use rusqlite::Connection;
use tauri::State;
use serde::{Deserialize, Serialize};
use rand::Rng;
use crate::database::DbState;
use crate::commands::audit::log_audit;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateFirstAdminResult {
    pub id: String,
    pub username: String,
}

/// Política de senha do primeiro admin: mínimo 8 caracteres, com pelo menos
/// uma letra e um dígito. Substitui a antiga exigência de "só números".
fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Senha deve ter pelo menos 8 caracteres, com letras e números.".to_string());
    }
    if !password.chars().any(|c| c.is_ascii_alphabetic()) {
        return Err("Senha deve ter pelo menos 8 caracteres, com letras e números.".to_string());
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err("Senha deve ter pelo menos 8 caracteres, com letras e números.".to_string());
    }
    Ok(())
}

/// Cria o primeiro administrador do sistema.
/// Só funciona quando usuarios está vazia (instalação limpa).
/// Proteção contra re-execução: falha se já houver usuários.
#[tauri::command]
pub fn create_first_admin(
    nome: String,
    username: String,
    password: String,
    state: State<'_, DbState>,
) -> Result<CreateFirstAdminResult, String> {
    // 1. Validar inputs
    let nome = nome.trim();
    let username = username.trim();
    let password = password.trim();

    if nome.len() < 2 {
        return Err("Nome completo deve ter pelo menos 2 caracteres.".to_string());
    }
    if username.len() < 3 {
        return Err("Username deve ter pelo menos 3 caracteres.".to_string());
    }
    if username.contains(' ') {
        return Err("Username não pode conter espaços.".to_string());
    }
    validate_password(password)?;

    let conn_guard = state.conn.lock().unwrap();
    let conn = conn_guard
        .as_ref()
        .ok_or_else(|| "Database not connected".to_string())?;

    // 2. Proteção: falhar se já existir algum usuário
    let existing_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get(0))
        .map_err(|e| format!("Erro ao verificar usuarios existentes: {}", e))?;

    if existing_count > 0 {
        return Err("Ja existem usuarios no sistema. Use a tela de login.".to_string());
    }

    // 3. Gerar ID, hash da senha e sync_salt
    let user_id = format!("{:x}", rand::random::<u128>());
    let password_hash = bcrypt::hash(&password, 12)
        .map_err(|e| format!("Erro ao hash senha: {}", e))?;

    let salt: [u8; 32] = rand::thread_rng().gen();
    let sync_salt = hex::encode(salt);

    let now = chrono::Utc::now().to_rfc3339();
    let default_org = "ecoforms-org-001";

    // 4. Seed RBAC tables antes do INSERT (FK perfil → perfis)
    seed_rbac_tables(conn)?;

    // 5. Inserir admin
    conn.execute(
        "INSERT INTO usuarios (id, nome_usuario, nome, hash_senha, perfil, ativo, id_organizacao, sal_sync, criado_em, atualizado_em)
         VALUES (?1, ?2, ?3, ?4, 'admin', 1, ?5, ?6, ?7, ?7)",
        [&user_id, username, nome, &password_hash, default_org, &sync_salt, &now],
    ).map_err(|e| format!("Erro ao criar administrador: {}", e))?;

    // 6. Log de auditoria
    let metadata = format!("{{\"bootstrap\":true,\"username\":\"{}\"}}", username);
    let _ = log_audit(
        conn,
        "system",
        "system",
        "system.bootstrap",
        Some("usuarios"),
        Some(&user_id),
        None,
        Some(&format!("{{\"nome\":\"{}\",\"username\":\"{}\",\"perfil\":\"admin\"}}", nome, username)),
        Some(&metadata),
    );

    Ok(CreateFirstAdminResult {
        id: user_id,
        username: username.to_string(),
    })
}

/// Semeia o admin padrão (admin/admin) no boot, reutilizável diretamente sobre a conexão.
/// ADR-051 (Gap 3, revisado): chamado a partir de `db_connect`, não exposto como command Tauri,
/// e somente quando `cfg!(debug_assertions) && std::env::var("ECOFORMS_SEED_ADMIN").is_ok()` —
/// builds release nunca chamam esta função; builds debug exigem opt-in explícito via env.
///
/// Tolerante e idempotente:
/// - no-op (`Ok(None)`) se a tabela `usuarios` ainda não existe (boot antes do schema);
/// - no-op (`Ok(None)`) se já houver qualquer usuário;
/// - cria o admin padrão e retorna `Ok(Some(user_id))` apenas em base com schema e sem usuários.
pub fn seed_default_admin_conn(conn: &Connection) -> Result<Option<String>, String> {
    // Boot order: db_connect roda antes de ensure-columns.ts. Em install fresco a tabela
    // ainda não existe — nesse caso saímos silenciosamente e o seed efetiva no boot seguinte.
    let table_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='usuarios'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if table_exists == 0 {
        return Ok(None);
    }

    let existing_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get(0))
        .map_err(|e| format!("Erro ao verificar usuarios existentes: {}", e))?;
    if existing_count > 0 {
        return Ok(None);
    }

    let user_id = format!("{:x}", rand::random::<u128>());
    let password_hash = bcrypt::hash("admin", 12)
        .map_err(|e| format!("Erro ao hash senha: {}", e))?;

    let salt: [u8; 32] = rand::thread_rng().gen();
    let sync_salt = hex::encode(salt);
    let now = chrono::Utc::now().to_rfc3339();

    seed_rbac_tables(conn)?;

    conn.execute(
        "INSERT INTO usuarios (id, nome_usuario, nome, hash_senha, perfil, ativo, id_organizacao, sal_sync, criado_em, atualizado_em)
         VALUES (?1, 'admin', 'Administrador', ?2, 'admin', 1, 'ecoforms-org-001', ?3, ?4, ?4)",
        [&user_id, &password_hash, &sync_salt, &now],
    ).map_err(|e| format!("Erro ao criar admin padrao: {}", e))?;

    let _ = log_audit(
        conn,
        "system",
        "system",
        "system.seed_admin",
        Some("usuarios"),
        Some(&user_id),
        None,
        Some("{\"bootstrap\":true,\"default\":true,\"username\":\"admin\"}"),
        Some("{\"source\":\"db_connect\"}"),
    );

    Ok(Some(user_id))
}

/// Popula perfis, hierarquia_perfis e permissoes se estiverem vazias.
pub fn seed_rbac_tables(conn: &Connection) -> Result<(), String> {
    let perfis_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM perfis", [], |row| row.get(0))
        .unwrap_or(0);

    if perfis_count > 0 {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO perfis (id, nome, descricao) VALUES
            ('admin','Administrador','Acesso total'),
            ('gerente','Gerente','Gestao de usuarios e relatorios'),
            ('coordenador','Coordenador','Coordenacao de equipe'),
            ('encarregado','Encarregado','Supervisao de campo'),
            ('operador','Operador','Execucao de tarefas'),
            ('campo','Campo','Execucao de tarefas')",
        [],
    ).map_err(|e| format!("Erro ao seed perfis: {}", e))?;

    conn.execute(
        "INSERT INTO hierarquia_perfis (perfil, nivel, descricao) VALUES
            ('admin',0,'Acesso total'),
            ('gerente',1,'Gestao'),
            ('coordenador',2,'Coordenacao'),
            ('encarregado',3,'Supervisao'),
            ('operador',4,'Execucao'),
            ('campo',4,'Execucao')",
        [],
    ).map_err(|e| format!("Erro ao seed hierarchy: {}", e))?;

    let perms_batches = [
        "('admin','users.create'),('gerente','users.create')",
        "('admin','users.edit'),('gerente','users.edit')",
        "('admin','users.delete')",
        "('admin','users.view_all'),('gerente','users.view_all')",
        "('admin','users.change_password'),('gerente','users.change_password'),('coordenador','users.change_password'),('campo','users.change_password'),('operador','users.change_password'),('encarregado','users.change_password')",
        "('admin','forms.create'),('gerente','forms.create')",
        "('admin','forms.edit'),('gerente','forms.edit')",
        "('admin','forms.delete')",
        "('admin','forms.assign'),('gerente','forms.assign')",
        "('admin','forms.fill'),('gerente','forms.fill'),('coordenador','forms.fill'),('campo','forms.fill'),('operador','forms.fill'),('encarregado','forms.fill')",
        "('admin','data.view_all'),('gerente','data.view_all')",
        "('admin','data.view_own'),('gerente','data.view_own'),('coordenador','data.view_own'),('campo','data.view_own'),('operador','data.view_own'),('encarregado','data.view_own')",
        "('admin','data.edit_all')",
        "('admin','data.edit_own'),('gerente','data.edit_own'),('coordenador','data.edit_own'),('campo','data.edit_own'),('operador','data.edit_own'),('encarregado','data.edit_own')",
        "('admin','data.delete')",
        "('admin','data.export'),('gerente','data.export')",
        "('admin','data.archive'),('gerente','data.archive')",
        "('admin','system.config')",
        "('admin','system.logs'),('gerente','system.logs')",
        "('admin','system.sync'),('gerente','system.sync'),('coordenador','system.sync'),('campo','system.sync'),('operador','system.sync'),('encarregado','system.sync')",
        "('admin','system.device_setup'),('gerente','system.device_setup')",
        "('admin','reports.view'),('gerente','reports.view')",
        "('admin','reports.export'),('gerente','reports.export')",
        "('admin','activities.manage'),('gerente','activities.manage')",
        "('admin','tasks.reassign'),('gerente','tasks.reassign'),('encarregado','tasks.reassign')",
        "('admin','clients.view'),('gerente','clients.view'),('coordenador','clients.view')",
        "('admin','clients.create'),('gerente','clients.create')",
        "('admin','clients.edit'),('gerente','clients.edit')",
        "('admin','clients.delete')",
        "('admin','clients.export'),('gerente','clients.export')",
        "('admin','crm.view'),('gerente','crm.view'),('coordenador','crm.view'),('encarregado','crm.view')",
        "('admin','crm.edit'),('gerente','crm.edit'),('coordenador','crm.edit')",
        "('admin','ouvidoria.view'),('gerente','ouvidoria.view'),('coordenador','ouvidoria.view'),('encarregado','ouvidoria.view')",
        "('admin','ouvidoria.create'),('gerente','ouvidoria.create'),('coordenador','ouvidoria.create'),('encarregado','ouvidoria.create')",
        "('admin','ouvidoria.respond'),('gerente','ouvidoria.respond'),('coordenador','ouvidoria.respond')",
        "('admin','ouvidoria.close'),('gerente','ouvidoria.close')",
    ];

    for batch in &perms_batches {
        conn.execute(
            &format!("INSERT INTO permissoes (perfil, permissao) VALUES {}", batch),
            [],
        ).map_err(|e| format!("Erro ao seed permissoes: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_short_numeric_only_password() {
        assert!(validate_password("1234").is_err());
    }

    #[test]
    fn rejects_long_alpha_only_password() {
        assert!(validate_password("abcdefgh").is_err());
    }

    #[test]
    fn rejects_long_numeric_only_password() {
        assert!(validate_password("12345678").is_err());
    }

    #[test]
    fn accepts_mixed_alphanumeric_password() {
        assert!(validate_password("abc12345").is_ok());
    }
}
