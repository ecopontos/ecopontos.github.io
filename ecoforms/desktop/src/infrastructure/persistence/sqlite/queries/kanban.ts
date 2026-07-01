import type { QueryDef } from './_types';

export const KANBAN_TAREFAS: QueryDef = {
  sql: `
    SELECT t.*,
           u_criador.nome    AS criado_por_nome,
           u_atrib.nome      AS atribuido_para_nome,
           p.nome            AS projeto_nome,
           p.cor             AS projeto_cor,
           s.nome            AS setor_nome,
           (SELECT COUNT(*) FROM tarefas_comentarios c WHERE c.tarefa_id = t.id) AS total_comentarios
    FROM tarefas t
    LEFT JOIN usuarios     u_criador ON u_criador.id = t.criado_por
    LEFT JOIN usuarios     u_atrib   ON u_atrib.id   = t.atribuido_para
    LEFT JOIN projetos     p         ON p.id         = t.projeto_id
    LEFT JOIN setores      s         ON s.id         = t.setor_id
    WHERE t.deletado_em IS NULL
      AND (
        ? = 'admin'
        OR t.criado_por = ?
        OR t.atribuido_para = ?
        OR u_criador.perfil IN (??)
        OR EXISTS (SELECT 1 FROM tarefas_interessados ti WHERE ti.tarefa_id = t.id AND ti.usuario_id = ?)
        OR EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = t.projeto_id AND pi.usuario_id = ?)
      )
    ORDER BY t.ordem ASC
  `,
  description: 'Tarefas do Kanban — acesso filtrado por permissões do usuário',
  params: ['perfil_is_admin', 'user_id', 'user_id', 'user_id', 'perfis_accessiveis', 'user_id', 'user_id'],
  use: 'operacional',
  returns: '{ id, titulo, status, prioridade, prazo, projeto_id, projeto_nome, projeto_cor, setor_id, setor_nome, criado_por, criado_por_nome, atribuido_para, atribuido_para_nome, total_comentarios, ... }[]',
};

export const KANBAN_LOOKUP_USUARIOS: QueryDef = {
  sql: `SELECT id AS value, nome AS label FROM usuarios WHERE ativo = 1 ORDER BY nome`,
  description: 'Usuários ativos para selects de atribuição',
  params: [],
  use: 'operacional',
  returns: '{ value, label }[]',
};

export const KANBAN_LOOKUP_FORMS: QueryDef = {
  sql: `SELECT form_id AS value, titulo AS label FROM registro_formularios WHERE ativo = 1 ORDER BY titulo`,
  description: 'Formulários ativos para selects de vínculo',
  params: [],
  use: 'operacional',
  returns: '{ value, label }[]',
};

export const KANBAN_LOOKUP_PROJETOS: QueryDef = {
  sql: `SELECT id AS value, nome AS label FROM projetos WHERE arquivado_em IS NULL ORDER BY nome`,
  description: 'Projetos não-arquivados para selects de vínculo',
  params: [],
  use: 'operacional',
  returns: '{ value, label }[]',
};

export const KANBAN_PROJETOS: QueryDef = {
  sql: `
    SELECT p.*,
           u.nome                              AS criado_por_nome,
           COALESCE(
               (SELECT json_group_array(json_object('usuario_id', usuario_id, 'permissao', permissao, 'contexto', 'projeto'))
                FROM projetos_interessados
                WHERE projeto_id = p.id),
               '[]'
           )                                   AS interessados_json,
           CASE
               WHEN p.criado_por = ?               THEN 'dono'
               WHEN EXISTS (
                   SELECT 1 FROM projetos_interessados pi
                   WHERE pi.projeto_id = p.id AND pi.usuario_id = ? AND pi.permissao = 'edicao'
               )                                   THEN 'edicao'
               ELSE 'leitura'
           END                                  AS meu_nivel_acesso
    FROM projetos p
    LEFT JOIN usuarios u ON u.id = p.criado_por
    WHERE p.arquivado_em IS NULL
      AND (
        ? = 'admin'
        OR p.criado_por = ?
        OR EXISTS (
            SELECT 1 FROM projetos_interessados pi
            WHERE pi.projeto_id = p.id AND pi.usuario_id = ?
        )
      )
    ORDER BY p.criado_em DESC
  `,
  description: 'Projetos do Kanban — acesso filtrado por ownership e permissões',
  params: ['perfil_is_admin', 'user_id', 'perfil_is_admin', 'user_id', 'user_id'],
  use: 'operacional',
  returns: '{ id, nome, status, cor, criado_por, criado_por_nome, interessados_json, meu_nivel_acesso, ... }[]',
};