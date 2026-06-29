/**
 * Catálogo de queries: Tarefas
 *
 * Cobre métricas de tarefas, atrasos, carga por usuário,
 * tendências diárias e distribuição por prioridade/projeto.
 *
 * Origem: migrado e expandido a partir de task-metrics-queries.ts (arquivo órfão).
 */
import type { QueryDef } from './_types';

// --- Medidas escalares (dashboard / medidas implícitas) ---

export const TAREFAS_RESUMO: QueryDef = {
  sql: `
    SELECT
        COUNT(*)                                                                       AS total,
        SUM(CASE WHEN status = 'concluido'    THEN 1 ELSE 0 END)                      AS concluidas,
        SUM(CASE WHEN status = 'em_progresso' THEN 1 ELSE 0 END)                      AS em_progresso,
        SUM(CASE WHEN status = 'a_fazer'      THEN 1 ELSE 0 END)                      AS a_fazer,
        SUM(CASE WHEN status != 'concluido'
                  AND prazo IS NOT NULL
                  AND date(prazo) < date('now') THEN 1 ELSE 0 END)                    AS atrasadas,
        SUM(CASE WHEN status = 'concluido'
                  AND date(atualizado_em) = date('now') THEN 1 ELSE 0 END)               AS concluidas_hoje,
        SUM(CASE WHEN status = 'concluido'
                  AND date(atualizado_em) >= date('now', '-7 days') THEN 1 ELSE 0 END)   AS concluidas_semana,
        SUM(CASE WHEN status = 'concluido'
                  AND date(atualizado_em) >= date('now', '-30 days') THEN 1 ELSE 0 END)  AS concluidas_mes
    FROM tarefas
    WHERE arquivado != 1 OR arquivado IS NULL
  `,
  description: 'Resumo geral de tarefas: totais por status, atrasos e velocidade de conclusão',
  params: [],
  use: 'dashboard',
  returns: '{ total, concluidas, em_progresso, a_fazer, atrasadas, concluidas_hoje, concluidas_semana, concluidas_mes }',
};

export const TAREFAS_POR_USUARIO: QueryDef = {
  sql: `
    SELECT
        t.atribuido_para                                          AS user_id,
        COALESCE(u.nome, t.atribuido_para)                       AS usuario,
        SUM(CASE WHEN t.status = 'concluido'    THEN 1 ELSE 0 END) AS concluidas,
        SUM(CASE WHEN t.status = 'em_progresso' THEN 1 ELSE 0 END) AS em_progresso,
        SUM(CASE WHEN t.status = 'a_fazer'      THEN 1 ELSE 0 END) AS a_fazer
    FROM tarefas t
    LEFT JOIN usuarios u ON t.atribuido_para = u.id
    WHERE (t.arquivado != 1 OR t.arquivado IS NULL)
      AND t.atribuido_para IS NOT NULL
    GROUP BY t.atribuido_para
    ORDER BY concluidas DESC
    LIMIT 20
  `,
  description: 'Carga de trabalho por usuário: tarefas abertas e concluídas',
  params: [],
  use: 'dashboard',
  returns: '{ user_id, usuario, concluidas, em_progresso, a_fazer }[]',
};

export const TAREFAS_POR_PRIORIDADE: QueryDef = {
  sql: `
    SELECT
        COALESCE(prioridade, 'sem_prioridade')                         AS prioridade,
        COUNT(*)                                                        AS total,
        SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END)          AS concluidas
    FROM tarefas
    WHERE arquivado != 1 OR arquivado IS NULL
    GROUP BY prioridade
    ORDER BY
        CASE prioridade
            WHEN 'alta'   THEN 1
            WHEN 'media'  THEN 2
            WHEN 'baixa'  THEN 3
            ELSE 4
        END
  `,
  description: 'Distribuição de tarefas por prioridade com taxa de conclusão',
  params: [],
  use: 'dashboard',
  returns: '{ prioridade, total, concluidas }[]',
};

export const TAREFAS_TENDENCIA_DIARIA: QueryDef = {
  sql: `
    SELECT
        date(atualizado_em)                                               AS data,
        SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END)          AS concluidas
    FROM tarefas
    WHERE date(atualizado_em) >= date('now', ? || ' days')
    GROUP BY date(atualizado_em)
    ORDER BY data ASC
  `,
  description: 'Tendência diária de tarefas concluídas nos últimos N dias (param: "-30")',
  params: ['dias_atras'],
  use: 'dashboard',
  returns: '{ data, concluidas }[]',
};

export const TAREFA_BY_ID: QueryDef = {
  sql: `SELECT id, projeto_id, titulo, status, prioridade, atribuido_para, criado_em, prazo, setor_id, demanda_id
 FROM tarefas WHERE id = ? LIMIT 1`,
  description: 'Tarefa completa por ID (TaskDetailPage)',
  params: ['id'],
  use: 'operacional',
  returns: 'TarefaRow',
};

export const TAREFA_SET_DEMANDA: QueryDef = {
  sql: `UPDATE tarefas SET demanda_id = ?, atualizado_em = datetime('now') WHERE id = ?`,
  description: 'Vincula uma tarefa a uma demanda (encaminhamento.actions — step 2)',
  params: ['demanda_id', 'id'],
  use: 'operacional',
  returns: 'void',
};

export const TAREFAS_BY_USER: QueryDef = {
  sql: `SELECT id, titulo, status, prioridade, prazo, criado_em, atualizado_em
 FROM tarefas
 WHERE criado_por = ? OR atribuido_para = ?
 ORDER BY criado_em DESC`,
  description: 'Tarefas criadas por ou atribuídas a um usuário (exportacao GDPR)',
  params: ['user_id_a', 'user_id_b'],
  use: 'operacional',
  returns: '{ id, titulo, status, prioridade, prazo, criado_em, atualizado_em }[]',
};

export const TAREFAS_ATRIBUIDAS_NOTIFICACAO: QueryDef = {
  sql: `SELECT
    t.id, t.titulo, t.status, t.prioridade, t.prazo,
    COALESCE(p.nome, 'Projeto Geral') AS projeto_nome,
    COUNT(*) OVER() AS abertas_count,
    SUM(CASE WHEN t.status = 'a_fazer' THEN 1 ELSE 0 END) OVER() AS a_fazer_count,
    SUM(CASE WHEN t.status = 'em_progresso' THEN 1 ELSE 0 END) OVER() AS em_progresso_count,
    SUM(CASE WHEN t.prazo IS NOT NULL AND date(t.prazo) < date('now') THEN 1 ELSE 0 END) OVER() AS atrasadas_count
 FROM tarefas t
 LEFT JOIN projetos p ON p.id = t.projeto_id
 WHERE t.arquivado = 0 AND t.atribuido_para = ? AND t.status != 'concluido'
 ORDER BY
   CASE WHEN t.prazo IS NOT NULL AND date(t.prazo) < date('now') THEN 0
        WHEN t.prazo IS NOT NULL AND date(t.prazo) <= date('now', '+2 days') THEN 1 ELSE 2 END,
   CASE WHEN t.prazo IS NULL THEN 1 ELSE 0 END, date(t.prazo) ASC, t.atualizado_em DESC
 LIMIT 6`,
  description: 'Tarefas abertas atribuidas ao usuario para notificacao/resumo da pagina inicial',
  params: ['atribuido_para'],
  use: 'operacional',
  returns: '{ id, titulo, status, prioridade, prazo, projeto_nome, abertas_count, a_fazer_count, em_progresso_count, atrasadas_count }[]',
};

export const TAREFAS_DELETE_BY_USER: QueryDef = {
  sql: `DELETE FROM tarefas WHERE criado_por = ? OR atribuido_para = ?`,
  description: 'Deleta tarefas criadas por ou atribuídas a um usuário (eliminacao titular)',
  params: ['user_id_a', 'user_id_b'],
  use: 'operacional',
  returns: 'void',
};

export const TAREFA_INSERT_FROM_SOLICITACAO: QueryDef = {
  sql: `INSERT INTO tarefas
 (id, titulo, descricao, status, prioridade, criado_por,
  id_formulario, carga, origem, criado_em, atualizado_em)
 VALUES (?, ?, ?, 'aguardando_aprovacao', ?, ?, ?, ?, 'solicitacao', datetime('now'), datetime('now'))`,
  description: 'Insere uma tarefa a partir de uma solicitação (FormRenderer — auto_aprovacao branch)',
  params: [
    'id', 'titulo', 'descricao', 'prioridade',
    'criado_por', 'id_formulario', 'carga',
  ],
  use: 'operacional',
  returns: 'void',
};

export const TAREFAS_POR_PROJETO: QueryDef = {
  sql: `
    SELECT
        p.id                                                           AS projeto_id,
        p.nome                                                         AS projeto,
        COUNT(t.id)                                                    AS total,
        SUM(CASE WHEN t.status = 'concluido'    THEN 1 ELSE 0 END)    AS concluidas,
        SUM(CASE WHEN t.status = 'em_progresso' THEN 1 ELSE 0 END)    AS em_progresso,
        SUM(CASE WHEN t.status = 'a_fazer'      THEN 1 ELSE 0 END)    AS a_fazer
    FROM projetos p
    LEFT JOIN tarefas t ON t.projeto_id = p.id
                       AND (t.arquivado != 1 OR t.arquivado IS NULL)
    WHERE p.arquivado_em IS NULL
    GROUP BY p.id
    ORDER BY total DESC
  `,
  description: 'Contagem de tarefas por projeto com breakdown de status',
  params: [],
  use: 'medida',
  returns: '{ projeto_id, projeto, total, concluidas, em_progresso, a_fazer }[]',
};

// --- Queries operacionais ---

export const TAREFAS_ATRASADAS: QueryDef = {
  sql: `
    SELECT
        t.id, t.titulo, t.status, t.prioridade,
        COALESCE(t.prazo, t.prazo_fim)  AS prazo,
        u.nome                          AS atribuido_para,
        p.nome                          AS projeto
    FROM tarefas t
    LEFT JOIN usuarios u ON u.id = t.atribuido_para
    LEFT JOIN projetos p ON p.id = t.projeto_id
    WHERE t.status != 'concluido'
      AND (t.arquivado != 1 OR t.arquivado IS NULL)
      AND (
          (t.tipo_prazo = 'periodo'  AND t.prazo_fim IS NOT NULL AND date(t.prazo_fim) < date('now'))
          OR
          ((t.tipo_prazo IS NULL OR t.tipo_prazo = 'unico') AND t.prazo IS NOT NULL AND date(t.prazo) < date('now'))
      )
    ORDER BY prazo ASC
  `,
  description: 'Lista de tarefas com prazo vencido e ainda não concluídas',
  params: [],
  use: 'operacional',
  returns: '{ id, titulo, status, prioridade, prazo, atribuido_para, projeto }[]',
};

export const TAREFAS_POR_USUARIO_EXPORT: QueryDef = {
  sql: `SELECT id, titulo, status, prioridade, prazo, criado_em, atualizado_em FROM tarefas WHERE criado_por = ? OR atribuido_para = ? ORDER BY criado_em DESC`,
  description: 'Tarefas de um usuário para exportação GDPR',
  params: ['criado_por', 'atribuido_para'],
  use: 'operacional',
  returns: '{ id, titulo, status, prioridade, prazo, criado_em, atualizado_em }[]',
};
