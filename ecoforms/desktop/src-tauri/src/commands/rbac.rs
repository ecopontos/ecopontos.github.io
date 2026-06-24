use rusqlite::{Connection, OptionalExtension};

/// Verifica se um perfil possui uma permissão específica na permissoes.
pub fn check_permission(conn: &Connection, perfil: &str, permissao: &str) -> Result<(), String> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM permissoes WHERE perfil = ?1 AND permissao = ?2",
        [perfil, permissao],
        |row| row.get(0),
    ).map_err(|e| format!("Erro ao verificar permissão: {}", e))?;

    if count == 0 {
        return Err(format!(
            "Permissão negada: perfil '{}' não tem a permissão '{}'.",
            perfil, permissao
        ));
    }
    Ok(())
}

/// Verifica se o perfil é admin (nível 0).
pub fn is_admin(conn: &Connection, perfil: &str) -> Result<bool, String> {
    let nivel: Option<i64> = conn.query_row(
        "SELECT nivel FROM hierarquia_perfis WHERE perfil = ?1",
        [perfil],
        |row| row.get(0),
    ).optional().map_err(|e| format!("Erro ao verificar hierarquia: {}", e))?;

    Ok(nivel == Some(0))
}

/// Retorna o nível hierárquico do perfil (0=admin, 1=gerente, ...).
pub fn role_level(conn: &Connection, perfil: &str) -> Result<i32, String> {
    let nivel: i64 = conn.query_row(
        "SELECT nivel FROM hierarquia_perfis WHERE perfil = ?1",
        [perfil],
        |row| row.get(0),
    ).map_err(|_| format!("Perfil '{}' não encontrado na hierarquia.", perfil))?;

    Ok(nivel as i32)
}

/// Retorna os perfis subordinados (nível maior que o do perfil informado).
pub fn get_subordinate_perfis(conn: &Connection, perfil: &str) -> Result<Vec<String>, String> {
    let user_level = role_level(conn, perfil)?;

    let mut stmt = conn.prepare(
        "SELECT perfil FROM hierarquia_perfis WHERE nivel > ?1 ORDER BY nivel ASC"
    ).map_err(|e| format!("Erro ao preparar query: {}", e))?;

    let rows = stmt.query_map([user_level], |row| {
        row.get::<_, String>(0)
    }).map_err(|e| format!("Erro ao consultar subordinados: {}", e))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("Row error: {}", e))?);
    }
    Ok(result)
}

/// Valida se o usuário pode editar outro usuário baseado na hierarquia.
/// Admin pode editar todos. Gerente pode editar subordinados.
pub fn can_edit_user(conn: &Connection, actor_perfil: &str, target_perfil: &str) -> Result<bool, String> {
    if is_admin(conn, actor_perfil)? {
        return Ok(true);
    }

    let actor_level = role_level(conn, actor_perfil)?;
    let target_level = role_level(conn, target_perfil)?;

    // Gerente pode editar perfis de nível maior (subordinados)
    Ok(target_level > actor_level)
}

/// Valida se o usuário pode criar outro usuário com determinado perfil.
pub fn can_create_user_with_role(conn: &Connection, actor_perfil: &str, target_perfil: &str) -> Result<bool, String> {
    if is_admin(conn, actor_perfil)? {
        return Ok(true);
    }

    let actor_level = role_level(conn, actor_perfil)?;
    let target_level = role_level(conn, target_perfil)?;

    // Gerente pode criar perfis subordinados (nível maior)
    Ok(target_level > actor_level)
}
