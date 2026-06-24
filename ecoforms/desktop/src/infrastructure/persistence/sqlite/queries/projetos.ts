/**
 * Catálogo de queries: Projetos
 *
 * Lookups do detalhe de projeto (useProjectDetail) — corrigem
 * interpolação de string (`'${sId}'`, `'${projectId}'`) por `?`
 * parametrizado, eliminando o vetor de SQL injection pré-existente.
 */
import type { QueryDef } from './_types';

export const PROJETO_DETAIL: QueryDef = {
  sql: `SELECT
    p.*,
    u.nome AS criado_por_nome,
    resp.nome AS responsavel_nome,
    COALESCE((
        SELECT json_group_array(json_object('usuario_id', pi.usuario_id, 'permissao', pi.permissao, 'contexto', 'projeto', 'nome', COALESCE(ui.nome, pi.usuario_id)))
        FROM projetos_interessados pi
        LEFT JOIN usuarios ui ON ui.id = pi.usuario_id
        WHERE pi.projeto_id = p.id
    ), '[]') AS interessados_json,
    CASE
        WHEN p.criado_por = ? THEN 'dono'
        WHEN EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = p.id AND pi.usuario_id = ? AND pi.permissao = 'edicao') THEN 'edicao'
        ELSE 'leitura'
    END AS meu_nivel_acesso,
    COALESCE(SUM(CASE WHEN t.status = 'a_fazer'      AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_a_fazer,
    COALESCE(SUM(CASE WHEN t.status = 'em_progresso' AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_em_progresso,
    COALESCE(SUM(CASE WHEN t.status = 'concluido'    AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_concluido,
    COALESCE(COUNT(CASE WHEN t.arquivado = 0 THEN 1 END), 0) AS total_tarefas,
    COALESCE(SUM(CASE WHEN t.prioridade = 'baixa' AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_baixa,
    COALESCE(SUM(CASE WHEN t.prioridade = 'media' AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_media,
    COALESCE(SUM(CASE WHEN t.prioridade = 'alta'  AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_alta
FROM projetos p
LEFT JOIN usuarios u     ON u.id     = p.criado_por
LEFT JOIN usuarios resp ON resp.id  = p.responsavel_id
LEFT JOIN tarefas t     ON t.projeto_id = p.id
WHERE p.id = ? AND p.arquivado = 0
GROUP BY p.id
LIMIT 1`,
  description:
    'Detalhe de projeto com joins, contagens por status/prioridade, e nível ' +
    'de acesso do usuário atual. Params: [user_id, user_id, projeto_id]. ' +
    'Substitui o template interpolation pré-existente (`${sId}`, `${projectId}`) ' +
    'por `?` parametrizado.',
  params: ['user_id', 'user_id', 'projeto_id'],
  use: 'operacional',
  returns: 'ProjetoDetail',
};

export const PROJETO_TAREFAS: QueryDef = {
  sql: `SELECT t.*, u.nome AS atribuido_nome
 FROM tarefas t
 LEFT JOIN usuarios u ON u.id = t.atribuido_para
 WHERE t.projeto_id = ? AND t.arquivado = 0
 ORDER BY t.updated_at DESC
 LIMIT 20`,
  description: 'Tarefas ativas de um projeto (top 20) com nome do atribuido',
  params: ['projeto_id'],
  use: 'operacional',
  returns: 'TarefaComAtribuido[]',
};

export const PROJETO_EVENTOS: QueryDef = {
  sql: `SELECT e.*, t.titulo AS tarefa_titulo, u.nome AS usuario_nome
 FROM tarefas_eventos e
 JOIN tarefas t ON t.id = e.tarefa_id
 LEFT JOIN usuarios u ON u.id = e.usuario_id
 WHERE t.projeto_id = ?
 ORDER BY e.created_at DESC
 LIMIT 20`,
  description: 'Eventos recentes das tarefas de um projeto (top 20) com título da tarefa e nome do usuário',
  params: ['projeto_id'],
  use: 'operacional',
  returns: 'TarefaEventoDetalhado[]',
};
