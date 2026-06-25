/**
 * Catálogo de queries: Manifestações (Ouvidoria)
 *
 * Métricas de manifestações por status, tipo, setor, responsável,
 * tendência mensal e SLA/prazo.
 */
import type { QueryDef } from './_types';

export const MANIFESTACOES_RESUMO: QueryDef = {
  sql: `
    SELECT
        COUNT(*)                                                           AS total,
        SUM(CASE WHEN m.status = 'aberta'      THEN 1 ELSE 0 END)         AS abertas,
        SUM(CASE WHEN m.status = 'em_analise'  THEN 1 ELSE 0 END)         AS em_analise,
        SUM(CASE WHEN m.status = 'respondida'  THEN 1 ELSE 0 END)         AS respondidas,
        SUM(CASE WHEN m.status = 'encerrada'   THEN 1 ELSE 0 END)         AS encerradas,
        SUM(CASE WHEN m.prazo_resposta IS NOT NULL
                  AND date(m.prazo_resposta) < date('now')
                  AND m.status NOT IN ('respondida','encerrada')
            THEN 1 ELSE 0 END)                                             AS prazo_vencido
    FROM manifestacoes m
  `,
  description: 'Resumo de manifestações por status com count de prazos vencidos',
  params: [],
  use: 'dashboard',
  returns: '{ total, abertas, em_analise, respondidas, encerradas, prazo_vencido }',
};

export const MANIFESTACOES_POR_TIPO: QueryDef = {
  sql: `
    SELECT
        COALESCE(tm.nome, 'Não classificado')   AS tipo,
        COUNT(*)                                AS total,
        SUM(CASE WHEN m.status NOT IN ('respondida','encerrada') THEN 1 ELSE 0 END) AS abertas
    FROM manifestacoes m
    LEFT JOIN tipos_manifestacao tm ON tm.id = m.tipo_id
    GROUP BY m.tipo_id
    ORDER BY total DESC
  `,
  description: 'Distribuição de manifestações por tipo com total e abertas',
  params: [],
  use: 'dashboard',
  returns: '{ tipo, total, abertas }[]',
};

export const MANIFESTACOES_POR_SETOR: QueryDef = {
  sql: `
    SELECT
        COALESCE(se.nome, 'Sem setor')          AS setor,
        COUNT(*)                                AS total,
        SUM(CASE WHEN m.status NOT IN ('respondida','encerrada') THEN 1 ELSE 0 END) AS abertas,
        SUM(CASE WHEN m.prazo_resposta IS NOT NULL
                  AND date(m.prazo_resposta) < date('now')
                  AND m.status NOT IN ('respondida','encerrada')
            THEN 1 ELSE 0 END)                  AS atrasadas
    FROM manifestacoes m
    LEFT JOIN setores se ON se.id = m.setor_id
    GROUP BY m.setor_id
    ORDER BY total DESC
  `,
  description: 'Manifestações por setor responsável com abertas e atrasadas',
  params: [],
  use: 'dashboard',
  returns: '{ setor, total, abertas, atrasadas }[]',
};

export const MANIFESTACOES_POR_RESPONSAVEL: QueryDef = {
  sql: `
    SELECT
        COALESCE(u.nome, 'Sem responsável')     AS responsavel,
        COUNT(*)                                AS total,
        SUM(CASE WHEN m.status NOT IN ('respondida','encerrada') THEN 1 ELSE 0 END) AS abertas
    FROM manifestacoes m
    LEFT JOIN usuarios u ON u.id = m.responsavel_id
    GROUP BY m.responsavel_id
    ORDER BY abertas DESC
    LIMIT 20
  `,
  description: 'Carga de manifestações abertas por responsável',
  params: [],
  use: 'dashboard',
  returns: '{ responsavel, total, abertas }[]',
};

export const MANIFESTACOES_TENDENCIA_MENSAL: QueryDef = {
  sql: `
    SELECT
        strftime('%Y-%m', m.criado_em)          AS mes,
        COUNT(*)                                AS registradas,
        SUM(CASE WHEN m.status IN ('respondida','encerrada') THEN 1 ELSE 0 END) AS resolvidas
    FROM manifestacoes m
    WHERE m.criado_em >= date('now', ? || ' months')
    GROUP BY mes
    ORDER BY mes ASC
  `,
  description: 'Tendência mensal de manifestações registradas vs. resolvidas nos últimos N meses',
  params: ['meses_atras'],
  use: 'dashboard',
  returns: '{ mes, registradas, resolvidas }[]',
};

export const MANIFESTACOES_PRAZO_VENCIDO: QueryDef = {
  sql: `
    SELECT
        m.id, m.protocolo, m.assunto,
        m.prazo_resposta,
        CAST(julianday('now') - julianday(m.prazo_resposta) AS INTEGER) AS dias_atraso,
        s.nome  AS situacao,
        u.nome  AS responsavel,
        se.nome AS setor
    FROM manifestacoes m
    LEFT JOIN situacoes s  ON s.id  = m.situacao_id
    LEFT JOIN usuarios  u  ON u.id  = m.responsavel_id
    LEFT JOIN setores   se ON se.id = m.setor_id
    WHERE m.prazo_resposta IS NOT NULL
      AND date(m.prazo_resposta) < date('now')
      AND m.status NOT IN ('respondida', 'encerrada')
    ORDER BY dias_atraso DESC
  `,
  description: 'Lista de manifestações com prazo de resposta vencido, com dias de atraso',
  params: [],
  use: 'operacional',
  returns: '{ id, protocolo, assunto, prazo_resposta, dias_atraso, situacao, responsavel, setor }[]',
};

export const MANIFESTACOES_COBRANCAS: QueryDef = {
  sql: `
    SELECT n.id, n.mensagem, n.criado_em, u.nome AS usuario_nome
    FROM notificacoes n
    LEFT JOIN usuarios u ON n.usuario_id = u.id
    WHERE n.manifestacao_id = ? AND n.prazo_id IS NOT NULL
    ORDER BY n.criado_em DESC
  `,
  description: 'Cobranças (notificações com prazo) de uma manifestação',
  params: ['manifestacao_id'],
  use: 'operacional',
  returns: '{ id, mensagem, criado_em, usuario_nome }[]',
};

export const MANIFESTACOES_CATALOGOS_TIPOS: QueryDef = {
  sql: `SELECT id, nome FROM tipos_manifestacao ORDER BY nome`,
  description: 'Lookup: tipos de manifestação',
  params: [],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const MANIFESTACOES_CATALOGOS_ORIGENS: QueryDef = {
  sql: `SELECT id, nome FROM origens ORDER BY nome`,
  description: 'Lookup: origens de manifestação',
  params: [],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const MANIFESTACOES_CATALOGOS_CLASSIFICACOES: QueryDef = {
  sql: `SELECT id, nome FROM classificacoes ORDER BY nome`,
  description: 'Lookup: classificações de manifestação',
  params: [],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const MANIFESTACOES_CATALOGOS_SITUACOES: QueryDef = {
  sql: `SELECT id, nome FROM situacoes ORDER BY nome`,
  description: 'Lookup: situações de manifestação',
  params: [],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const PRAZOS_VENCIDOS_NAO_COBRADOS: QueryDef = {
  sql: `
    SELECT p.id, p.manifestacao_id, p.tipo_prazo, p.data_limite
    FROM prazos p
    JOIN manifestacoes m ON p.manifestacao_id = m.id
    WHERE p.status = 'pendente'
      AND datetime(p.data_limite) < datetime('now')
      AND p.cobranca_enviada = 0
      AND m.status NOT IN (?, ?, ?)
  `,
  description: 'Prazos vencidos não cobrados, excluindo manifestações encerradas/canceladas/encaminhadas',
  params: ['status_encerrada', 'status_cancelada', 'status_encaminhado_sema'],
  use: 'operacional',
  returns: '{ id, manifestacao_id, tipo_prazo, data_limite }[]',
};

export const MANIFESTACOES_POR_USUARIO_EXPORT: QueryDef = {
  sql: `SELECT id, protocolo, tipo_id, situacao_id, solicitante_nome, criado_em FROM manifestacoes WHERE cliente_id = ? ORDER BY criado_em DESC`,
  description: 'Manifestações de um usuário para exportação GDPR',
  params: ['cliente_id'],
  use: 'operacional',
  returns: '{ id, protocolo, tipo_id, situacao_id, solicitante_nome, criado_em }[]',
};

export const MANIFESTACOES_TEMPO_MEDIO_RESPOSTA: QueryDef = {
  sql: `
    SELECT
        COALESCE(tm.nome, 'Não classificado')   AS tipo,
        ROUND(AVG(
            julianday(m.data_resposta) - julianday(m.criado_em)
        ), 1)                                   AS dias_medio_resposta,
        COUNT(*)                                AS total_respondidas
    FROM manifestacoes m
    LEFT JOIN tipos_manifestacao tm ON tm.id = m.tipo_id
    WHERE m.data_resposta IS NOT NULL
    GROUP BY m.tipo_id
    ORDER BY dias_medio_resposta ASC
  `,
  description: 'Tempo mǸdio de resposta (em dias) por tipo de manifestação - medida de SLA',
  params: [],
  use: 'medida',
  returns: '{ tipo, dias_medio_resposta, total_respondidas }[]',
};

export const TIPO_MANIFESTACAO_UPSERT: QueryDef = {
  sql: `INSERT OR IGNORE INTO tipos_manifestacao
 (id, nome, descricao, prazo_dias_corridos, prazo_urgente_dias)
 VALUES (?, ?, ?, ?, ?)`,
  description: 'Insere um tipo de manifestacao (idempotente) - SeedManifestacaoCatalogUseCase',
  params: ['id', 'nome', 'descricao', 'prazo_dias_corridos', 'prazo_urgente_dias'],
  use: 'operacional',
  returns: 'void',
};

export const MANIFESTACOES_BY_CLIENTE: QueryDef = {
  sql: `SELECT id, protocolo, tipo_id, situacao_id, solicitante_nome, criado_em
 FROM manifestacoes
 WHERE cliente_id = ?
 ORDER BY criado_em DESC`,
  description: 'Manifestações de um cliente (exportacao GDPR)',
  params: ['cliente_id'],
  use: 'operacional',
  returns: '{ id, protocolo, tipo_id, situacao_id, solicitante_nome, criado_em }[]',
};

export const MANIFESTACOES_DELETE_BY_CLIENTE: QueryDef = {
  sql: `DELETE FROM manifestacoes WHERE cliente_id = ?`,
  description: 'Deleta manifestacoes de um cliente (eliminacao titular)',
  params: ['cliente_id'],
  use: 'operacional',
  returns: 'void',
};
