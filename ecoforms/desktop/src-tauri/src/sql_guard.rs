//! Helpers estruturais para validar SQL recebido via comandos genéricos
//! (`db_query`, `db_execute`, `db_execute_batch`). Substitui checagens por
//! substring sobre o texto SQL bruto, que geram falsos positivos (nome de
//! tabela dentro de comentário/literal) e falsos negativos (statements
//! adicionais embutidos, aliases, identificadores entre aspas).

/// Remove comentários (`-- ...` até o fim da linha e `/* ... */`) e o
/// conteúdo de literais de string entre aspas simples (`'...'`),
/// preservando os delimitadores. Identificadores entre aspas duplas
/// (`"..."`) ou backtick (`` `...` ``) têm seu conteúdo **preservado** —
/// são nomes de tabela/coluna, não literais, e `extract_target_table`/
/// `extract_set_columns` precisam deles para reconhecer identificadores
/// quotados. Usado como base para todas as checagens estruturais abaixo —
/// qualquer keyword/nome de tabela dentro de um comentário ou literal de
/// string deixa de ser considerado.
pub fn strip_comments_and_strings(sql: &str) -> String {
    let chars: Vec<char> = sql.chars().collect();
    let mut out = String::with_capacity(chars.len());
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];

        // Comentário de linha: -- até \n
        if c == '-' && chars.get(i + 1) == Some(&'-') {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }

        // Comentário de bloco: /* ... */
        if c == '/' && chars.get(i + 1) == Some(&'*') {
            i += 2;
            while i < chars.len() && !(chars[i] == '*' && chars.get(i + 1) == Some(&'/')) {
                i += 1;
            }
            i = (i + 2).min(chars.len());
            continue;
        }

        // Literal de string entre aspas simples — mantém os delimitadores
        // mas descarta o conteúdo (e trata '' como escape).
        if c == '\'' {
            let quote = c;
            out.push(quote);
            i += 1;
            while i < chars.len() {
                if chars[i] == quote {
                    if chars.get(i + 1) == Some(&quote) {
                        // escape de aspas duplicadas dentro do literal
                        i += 2;
                        continue;
                    }
                    out.push(quote);
                    i += 1;
                    break;
                }
                i += 1;
            }
            continue;
        }

        // Identificador entre aspas duplas ou backtick — preserva o
        // conteúdo (nome de tabela/coluna), apenas avança corretamente
        // tratando aspas duplicadas como escape.
        if c == '"' || c == '`' {
            let quote = c;
            out.push(quote);
            i += 1;
            while i < chars.len() {
                if chars[i] == quote {
                    if chars.get(i + 1) == Some(&quote) {
                        out.push(quote);
                        out.push(quote);
                        i += 2;
                        continue;
                    }
                    out.push(quote);
                    i += 1;
                    break;
                }
                out.push(chars[i]);
                i += 1;
            }
            continue;
        }

        out.push(c);
        i += 1;
    }

    out
}

/// Retorna `true` se, após normalização, o SQL contém apenas um statement
/// (ignora um único `;` final seguido de espaço em branco).
pub fn is_single_statement(normalized: &str) -> bool {
    let trimmed = normalized.trim();
    match trimmed.find(';') {
        None => true,
        Some(pos) => trimmed[pos + 1..].trim().is_empty(),
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum StatementKind {
    Select,
    Insert,
    Update,
    Delete,
    Other,
}

/// Classifica o statement pelo primeiro keyword (após normalização).
/// `WITH` (CTE) é tratado como `Select` — não há fluxo legítimo de
/// `WITH ... INSERT/UPDATE/DELETE` neste codebase, e tratar como leitura
/// mantém `db_query` restrito a SELECT/CTE.
pub fn statement_kind(normalized: &str) -> StatementKind {
    let trimmed = normalized.trim_start();
    let first_word: String = trimmed
        .chars()
        .take_while(|c| c.is_alphanumeric() || *c == '_')
        .collect::<String>()
        .to_uppercase();

    match first_word.as_str() {
        "SELECT" | "WITH" => StatementKind::Select,
        "INSERT" => StatementKind::Insert,
        "UPDATE" => StatementKind::Update,
        "DELETE" => StatementKind::Delete,
        _ => StatementKind::Other,
    }
}

/// Extrai o nome (em maiúsculas, sem aspas) da tabela alvo de um
/// `INSERT INTO`, `UPDATE` ou `DELETE FROM`. Retorna `None` se não
/// encontrar um identificador no formato esperado.
pub fn extract_target_table(normalized: &str, kind: &StatementKind) -> Option<String> {
    let trimmed = normalized.trim_start();
    let upper = trimmed.to_uppercase();

    let rest: String = match kind {
        StatementKind::Insert => {
            // INSERT [OR <algo>] INTO <tabela>
            let after_insert = upper.strip_prefix("INSERT")?;
            let after_insert = after_insert.trim_start();
            let after_or = if let Some(stripped) = after_insert.strip_prefix("OR") {
                // pula "OR <ROLLBACK|REPLACE|...>"
                let stripped = stripped.trim_start();
                let skip = stripped
                    .find(char::is_whitespace)
                    .unwrap_or(stripped.len());
                stripped[skip..].trim_start()
            } else {
                after_insert
            };
            let after_into = after_or.strip_prefix("INTO")?;
            after_into.trim_start().to_string()
        }
        StatementKind::Update => upper.strip_prefix("UPDATE")?.trim_start().to_string(),
        StatementKind::Delete => {
            let after_delete = upper.strip_prefix("DELETE")?.trim_start();
            after_delete.strip_prefix("FROM")?.trim_start().to_string()
        }
        _ => return None,
    };

    extract_leading_identifier(&rest)
}

/// Lê o primeiro identificador de `rest` (que já está em maiúsculas),
/// removendo aspas/backticks/colchetes se presentes.
fn extract_leading_identifier(rest: &str) -> Option<String> {
    let rest = rest.trim_start();
    if rest.is_empty() {
        return None;
    }

    let first = rest.chars().next()?;
    if first == '"' || first == '`' || first == '[' {
        let closing = match first {
            '[' => ']',
            other => other,
        };
        let body: String = rest
            .chars()
            .skip(1)
            .take_while(|c| *c != closing)
            .collect();
        if body.is_empty() {
            None
        } else {
            Some(body)
        }
    } else {
        let ident: String = rest
            .chars()
            .take_while(|c| c.is_alphanumeric() || *c == '_')
            .collect();
        if ident.is_empty() {
            None
        } else {
            Some(ident)
        }
    }
}

/// Retorna `true` se o statement é um `INSERT OR IGNORE INTO ...` —
/// semântica "insere a linha apenas se ainda não existir pela PK/UNIQUE",
/// nunca sobrescreve ou altera dados já presentes. Usado para permitir
/// seeds idempotentes de tabelas RBAC (`perfis`, `hierarquia_perfis`)
/// durante `bootstrap`, mesmo em boots após o primeiro usuário já existir
/// (o `ensure-columns` roda em todo boot, não só no primeiro).
pub fn is_insert_or_ignore(normalized: &str) -> bool {
    let upper = normalized.trim_start().to_uppercase();
    let Some(after_insert) = upper.strip_prefix("INSERT") else { return false };
    let Some(after_or) = after_insert.trim_start().strip_prefix("OR") else { return false };
    after_or.trim_start().starts_with("IGNORE")
}

/// Para `UPDATE ... SET col1 = ..., col2 = ...`, retorna os nomes das
/// colunas (em maiúsculas, sem aspas) referenciadas no SET. Para
/// `INSERT INTO tbl (col1, col2) VALUES (...)`, retorna as colunas da
/// lista de colunas. Em ambos os casos, ignora o que vem depois do
/// trecho relevante (WHERE/VALUES).
pub fn extract_set_columns(normalized: &str) -> Vec<String> {
    let trimmed = normalized.trim_start();
    let upper = trimmed.to_uppercase();

    if let Some(set_pos) = upper.find(" SET ") {
        // UPDATE ... SET <col> = <expr>, <col> = <expr> [WHERE ...]
        let after_set = &trimmed[set_pos + 5..];
        let upper_after_set = &upper[set_pos + 5..];
        let end = upper_after_set.find(" WHERE ").unwrap_or(after_set.len());
        let set_clause = &after_set[..end];

        return set_clause
            .split(',')
            .filter_map(|assignment| {
                let lhs = assignment.split('=').next()?.trim();
                extract_leading_identifier(&lhs.to_uppercase())
            })
            .collect();
    }

    if upper.starts_with("INSERT") {
        // INSERT INTO tbl (col1, col2, ...) VALUES (...)
        if let Some(open) = trimmed.find('(') {
            if let Some(close_rel) = trimmed[open..].find(')') {
                let close = open + close_rel;
                let cols = &trimmed[open + 1..close];
                return cols
                    .split(',')
                    .filter_map(|c| extract_leading_identifier(&c.trim().to_uppercase()))
                    .collect();
            }
        }
    }

    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_line_comments() {
        let sql = "SELECT id -- comment about USUARIOS\nFROM clientes";
        let normalized = strip_comments_and_strings(sql);
        assert!(!normalized.to_uppercase().contains("USUARIOS"));
    }

    #[test]
    fn strips_block_comments() {
        let sql = "UPDATE /* USUARIOS hidden */ clientes SET nome = 'x'";
        let normalized = strip_comments_and_strings(sql);
        assert_eq!(extract_target_table(&normalized, &StatementKind::Update), Some("CLIENTES".to_string()));
    }

    #[test]
    fn strips_string_literal_contents() {
        let sql = "INSERT INTO pedidos (obs) VALUES ('fala sobre USUARIOS e PERMISSOES')";
        let normalized = strip_comments_and_strings(sql);
        assert!(!normalized.to_uppercase().contains("USUARIOS"));
        assert_eq!(extract_target_table(&normalized, &StatementKind::Insert), Some("PEDIDOS".to_string()));
    }

    #[test]
    fn handles_escaped_quotes_in_literal() {
        let sql = "UPDATE clientes SET nome = 'O''Brien USUARIOS'";
        let normalized = strip_comments_and_strings(sql);
        assert!(!normalized.to_uppercase().contains("USUARIOS"));
    }

    #[test]
    fn detects_multi_statement() {
        let sql = "SELECT 1; DROP TABLE usuarios";
        let normalized = strip_comments_and_strings(sql);
        assert!(!is_single_statement(&normalized));
    }

    #[test]
    fn allows_trailing_semicolon() {
        let sql = "SELECT 1;  ";
        let normalized = strip_comments_and_strings(sql);
        assert!(is_single_statement(&normalized));
    }

    #[test]
    fn statement_kind_treats_with_as_select() {
        let normalized = strip_comments_and_strings("WITH cte AS (SELECT 1) SELECT * FROM cte");
        assert_eq!(statement_kind(&normalized), StatementKind::Select);
    }

    #[test]
    fn extract_target_table_update_quoted() {
        let normalized = strip_comments_and_strings("UPDATE \"usuarios\" SET nome = 'x' WHERE id = 1");
        assert_eq!(extract_target_table(&normalized, &StatementKind::Update), Some("USUARIOS".to_string()));
    }

    #[test]
    fn detects_insert_or_ignore() {
        let normalized = strip_comments_and_strings("INSERT OR IGNORE INTO perfis (id, nome) VALUES ('admin', 'Admin')");
        assert!(is_insert_or_ignore(&normalized));
    }

    #[test]
    fn does_not_treat_plain_insert_or_other_as_insert_or_ignore() {
        assert!(!is_insert_or_ignore(&strip_comments_and_strings("INSERT INTO perfis (id) VALUES ('admin')")));
        assert!(!is_insert_or_ignore(&strip_comments_and_strings("INSERT OR REPLACE INTO perfis (id) VALUES ('admin')")));
        assert!(!is_insert_or_ignore(&strip_comments_and_strings("UPDATE perfis SET nome = 'x'")));
    }

    #[test]
    fn extract_target_table_insert_or_replace() {
        let normalized = strip_comments_and_strings("INSERT OR REPLACE INTO tbl_permissions (a) VALUES (1)");
        assert_eq!(extract_target_table(&normalized, &StatementKind::Insert), Some("TBL_PERMISSIONS".to_string()));
    }

    #[test]
    fn extract_target_table_delete_from() {
        let normalized = strip_comments_and_strings("DELETE FROM hierarquia_perfis WHERE id = 1");
        assert_eq!(extract_target_table(&normalized, &StatementKind::Delete), Some("HIERARQUIA_PERFIS".to_string()));
    }

    #[test]
    fn does_not_match_table_name_in_comment_as_target() {
        // A tabela real é "clientes"; "USUARIOS" só aparece num comentário.
        let normalized = strip_comments_and_strings("UPDATE clientes /* não é USUARIOS */ SET nome = 'x'");
        assert_eq!(extract_target_table(&normalized, &StatementKind::Update), Some("CLIENTES".to_string()));
    }

    #[test]
    fn extract_set_columns_update() {
        let normalized = strip_comments_and_strings("UPDATE usuarios SET perfil = 'admin', nome = 'x' WHERE id = 1");
        let cols = extract_set_columns(&normalized);
        assert_eq!(cols, vec!["PERFIL".to_string(), "NOME".to_string()]);
    }

    #[test]
    fn extract_set_columns_insert() {
        let normalized = strip_comments_and_strings("INSERT INTO usuarios (nome, hash_senha) VALUES ('a', 'b')");
        let cols = extract_set_columns(&normalized);
        assert_eq!(cols, vec!["NOME".to_string(), "HASH_SENHA".to_string()]);
    }

    #[test]
    fn select_with_password_column_detected_via_columns_not_text() {
        // A checagem de coluna sensível deve ser feita sobre os nomes de
        // coluna retornados pela query, não pelo texto do SQL — então um
        // alias diferente do nome da coluna não escapa, e um nome de
        // coluna meramente parecido (password_hash_updated_at) não bate.
        let sensitive = ["PASSWORD_HASH", "HASH_SENHA"];
        let columns = vec!["id".to_string(), "hash_senha".to_string()];
        let blocked = columns.iter().any(|c| sensitive.contains(&c.to_uppercase().as_str()));
        assert!(blocked);

        let columns_ok = vec!["id".to_string(), "hash_senha_updated_at".to_string()];
        let blocked_ok = columns_ok.iter().any(|c| sensitive.contains(&c.to_uppercase().as_str()));
        assert!(!blocked_ok);
    }
}
