/**
 * Catálogo de queries: Usuários
 *
 * Distribuição por perfil/setor, carga de trabalho ativa
 * e acesso a formulários.
 */
import type { QueryDef } from './_types';

export const USUARIOS_POR_PERFIL: QueryDef = {
  sql: `
    SELECT
        perfil,
        COUNT(*) AS total
    FROM usuarios
    WHERE ativo = 1
    GROUP BY perfil
    ORDER BY total DESC
  `,
  description: 'Número de usuários ativos por perfil/papel',
  params: [],
  use: 'operacional',
  returns: '{ perfil, total }[]',
};

export const USUARIOS_POR_SETOR: QueryDef = {
  sql: `
    SELECT
        COALESCE(s.descricao, s.nome, 'Sem setor') AS setor,
        COUNT(DISTINCT u.id)                        AS total
    FROM usuarios u
    LEFT JOIN usuarios_setores us ON us.usuario_id = u.id
    LEFT JOIN setores s            ON s.id = us.setor_id
    WHERE u.ativo = 1
    GROUP BY s.id
    ORDER BY total DESC
  `,
  description: 'Usuários ativos agrupados por setor (via tabela de junção usuarios_setores)',
  params: [],
  use: 'operacional',
  returns: '{ setor, total }[]',
};

export const CARGA_TRABALHO_USUARIO: QueryDef = {
  sql: `
    SELECT
        u.id                                                                AS user_id,
        u.nome                                                              AS usuario,
        u.perfil,
        COUNT(t.id)                                                         AS tarefas_abertas,
        SUM(CASE WHEN t.status = 'em_progresso'         THEN 1 ELSE 0 END) AS em_progresso,
        SUM(CASE WHEN t.prioridade = 'alta'
                  AND t.status != 'concluido'           THEN 1 ELSE 0 END) AS alta_prioridade,
        SUM(CASE WHEN t.status != 'concluido'
                  AND t.prazo IS NOT NULL
                  AND date(t.prazo) < date('now')       THEN 1 ELSE 0 END) AS atrasadas
    FROM usuarios u
    LEFT JOIN tarefas t ON t.atribuido_para = u.id
                       AND t.status != 'concluido'
                       AND (t.arquivado != 1 OR t.arquivado IS NULL)
    WHERE u.ativo = 1
    GROUP BY u.id
    ORDER BY tarefas_abertas DESC
  `,
  description: 'Carga de trabalho ativa por usuário: tarefas abertas, em progresso, alta prioridade e atrasadas',
  params: [],
  use: 'dashboard',
  returns: '{ user_id, usuario, perfil, tarefas_abertas, em_progresso, alta_prioridade, atrasadas }[]',
};

export const USUARIOS_COM_ACESSO_FORM: QueryDef = {
  sql: `
    SELECT u.id, u.nome, u.email, u.perfil, 1 AS acesso_explicito
    FROM usuarios u
    WHERE u.ativo = 1
      AND u.perfil NOT IN ('admin', 'gerente')
      AND EXISTS (
          SELECT 1 FROM tarefas t
          WHERE t.atribuido_para = u.id
            AND t.id_formulario = ?
            AND t.status IN ('a_fazer', 'em_progresso')
            AND t.arquivado = 0
      )
    UNION
    SELECT id, nome, email, perfil, 0 AS acesso_explicito
    FROM usuarios
    WHERE perfil IN ('admin', 'gerente') AND ativo = 1
    ORDER BY acesso_explicito DESC, nome ASC
  `,
  description: 'Usuários com acesso a um formulário: por tarefa ativa (explícito) ou por perfil admin/gerente',
  params: ['id_formulario'],
  use: 'operacional',
  returns: '{ id, nome, email, perfil, acesso_explicito }[]',
};

export const SETORES_ATIVOS: QueryDef = {
  sql: `SELECT id, nome, descricao FROM setores WHERE ativo = 1 ORDER BY nome`,
  description: 'Setores ativos para selects e listagens',
  params: [],
  use: 'operacional',
  returns: '{ id, nome, descricao }[]',
};

export const SETORES_ALL: QueryDef = {
  sql: `SELECT id, nome FROM setores ORDER BY nome`,
  description: 'Todos os setores (sem filtro de ativo) — para o editor de usuários',
  params: [],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const SETOR_BY_ID: QueryDef = {
  sql: `SELECT id, nome FROM setores WHERE id = ? LIMIT 1`,
  description: 'Setor (id + nome) por ID — para joins resolvidos na UI',
  params: ['id'],
  use: 'operacional',
  returns: '{ id, nome }',
};

export const USUARIO_PERFIL: QueryDef = {
  sql: `SELECT perfil FROM usuarios WHERE id = ? LIMIT 1`,
  description: 'Perfil de um usuário por ID',
  params: ['id'],
  use: 'operacional',
  returns: '{ perfil }',
};

export const USUARIO_SETOR_PRINCIPAL: QueryDef = {
  sql: `SELECT setor_principal_id FROM usuarios WHERE id = ?`,
  description: 'Setor principal de um usuário por ID',
  params: ['id'],
  use: 'operacional',
  returns: '{ setor_principal_id }',
};

export const USUARIO_DADOS: QueryDef = {
  sql: `SELECT id, nome, email, nome_usuario, perfil, ativo, criado_em, atualizado_em FROM usuarios WHERE id = ?`,
  description: 'Dados completos de um usuário por ID (exportação GDPR)',
  params: ['id'],
  use: 'operacional',
  returns: '{ id, nome, email, username, perfil, ativo, criado_em, atualizado_em }',
};

export const USUARIO_AUTH: QueryDef = {
  sql: `SELECT id, nome, nome_usuario, hash_senha, perfil, ativo, id_organizacao FROM usuarios WHERE id = ? LIMIT 1`,
  description: 'Campos de auth de um usuário (inclui hash_senha — uso interno apenas)',
  params: ['id'],
  use: 'operacional',
  returns: '{ id, nome, nome_usuario, hash_senha, perfil, ativo, id_organizacao }',
};

export const USUARIO_MAPEAMENTO_SUPABASE: QueryDef = {
  sql: `SELECT id_supabase FROM mapeamento_usuarios_supabase WHERE local_id = ?`,
  description: 'ID do Supabase mapeado para um usuário local',
  params: ['local_id'],
  use: 'operacional',
  returns: '{ id_supabase }',
};

export const MAPEAMENTO_USUARIO_DELETE: QueryDef = {
  sql: `DELETE FROM mapeamento_usuarios_supabase WHERE local_id = ?`,
  description: 'Deleta o mapeamento local_id -> id_supabase de um usuario (eliminacao titular)',
  params: ['local_id'],
  use: 'operacional',
  returns: 'void',
};

export const USUARIO_DELETE: QueryDef = {
  sql: `DELETE FROM usuarios WHERE id = ?`,
  description: 'Deleta um usuario (eliminacao titular)',
  params: ['id'],
  use: 'operacional',
  returns: 'void',
};

export const USUARIOS_SETOR_NOTIFICACAO: QueryDef = {
  sql: `SELECT u.id FROM usuarios u JOIN manifestacoes m ON u.setor_principal_id = m.setor_id WHERE m.id = ? AND u.ativo = 1`,
  description: 'Usuários do setor de uma manifestação para notificação',
  params: ['manifestacao_id'],
  use: 'operacional',
  returns: '{ id }[]',
};

export const USUARIOS_ATIVOS: QueryDef = {
  sql: `SELECT id, nome FROM usuarios WHERE ativo = 1 ORDER BY nome ASC`,
  description: 'Lista de usuários ativos (id + nome) para selects e dropdowns',
  params: [],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const USUARIOS_COUNT: QueryDef = {
  sql: `SELECT COUNT(*) AS count FROM usuarios`,
  description: 'Contagem total de usuários (para detecção de first-run no login)',
  params: [],
  use: 'medida',
  returns: '{ count }',
};

export const USUARIO_NOME_BY_ID: QueryDef = {
  sql: `SELECT nome FROM usuarios WHERE id = ? LIMIT 1`,
  description: 'Nome de um usuário por ID (para joins resolvidos na UI)',
  params: ['id'],
  use: 'operacional',
  returns: '{ nome }',
};
