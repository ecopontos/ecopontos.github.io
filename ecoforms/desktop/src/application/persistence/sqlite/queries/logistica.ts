/**
 * Catálogo de queries: Logística
 *
 * Métricas de roteiros, execuções de campo, intercorrências
 * e eficiência operacional de coleta.
 */
import type { QueryDef } from './_types';

export const ROTEIROS_POR_STATUS: QueryDef = {
  sql: `
    SELECT
        COALESCE(r.status, 'indefinido') AS status,
        COUNT(*)                          AS total
    FROM roteiros r
    GROUP BY r.status
    ORDER BY total DESC
  `,
  description: 'Distribuição de roteiros por status',
  params: [],
  use: 'dashboard',
  returns: '{ status, total }[]',
};

export const EXECUCOES_RESUMO: QueryDef = {
  sql: `
    SELECT
        COUNT(*)                                                           AS total,
        SUM(CASE WHEN e.status = 'concluida'    THEN 1 ELSE 0 END)        AS concluidas,
        SUM(CASE WHEN e.status = 'em_andamento' THEN 1 ELSE 0 END)        AS em_andamento,
        SUM(CASE WHEN e.status = 'pendente'     THEN 1 ELSE 0 END)        AS pendentes,
        SUM(CASE WHEN e.status = 'cancelada'    THEN 1 ELSE 0 END)        AS canceladas
    FROM execucoes e
  `,
  description: 'Resumo de execuções de roteiro por status',
  params: [],
  use: 'dashboard',
  returns: '{ total, concluidas, em_andamento, pendentes, canceladas }',
};

export const EXECUCOES_POR_ROTEIRO: QueryDef = {
  sql: `
    SELECT
        r.id                                                              AS roteiro_id,
        r.nome                                                            AS roteiro,
        COUNT(e.id)                                                       AS total_execucoes,
        SUM(CASE WHEN e.status = 'concluida' THEN 1 ELSE 0 END)          AS concluidas,
        MAX(e.data_execucao)                                              AS ultima_execucao
    FROM roteiros r
    LEFT JOIN execucoes e ON e.roteiro_id = r.id
    GROUP BY r.id
    ORDER BY ultima_execucao DESC NULLS LAST
  `,
  description: 'Execuções agrupadas por roteiro com data da última execução',
  params: [],
  use: 'dashboard',
  returns: '{ roteiro_id, roteiro, total_execucoes, concluidas, ultima_execucao }[]',
};

export const INTERCORRENCIAS_POR_TIPO: QueryDef = {
  sql: `
    SELECT
        COALESCE(i.tipo, 'Não classificada') AS tipo,
        COUNT(*)                              AS total
    FROM intercorrencias i
    GROUP BY i.tipo
    ORDER BY total DESC
  `,
  description: 'Frequência de intercorrências de campo por tipo — indicador de problemas recorrentes',
  params: [],
  use: 'medida',
  returns: '{ tipo, total }[]',
};

export const ROTEIROS_LIST_FILTERED: QueryDef = {
  sql: `SELECT id, codigo, nome, descricao, periodicidade, turno, base, situacao, criado_em, atualizado_em
 FROM roteiros
 WHERE codigo IS NOT NULL
   AND (? IS NULL OR situacao = ?)
   AND (? IS NULL OR base = ?)
   AND (? IS NULL OR turno = ?)
 ORDER BY atualizado_em DESC
 LIMIT ?`,
  description: 'Lista de roteiros com filtros opcionais (situacao, base, turno via `? IS NULL OR X = ?`) — useLegacySyncData',
  params: ['situacao?', 'situacao?', 'base?', 'base?', 'turno?', 'turno?', 'limit'],
  use: 'operacional',
  returns: 'RoteiroRow[]',
};

export const ROTEIROS_DISTINCT_BASES: QueryDef = {
  sql: `SELECT DISTINCT base FROM roteiros
 WHERE base IS NOT NULL AND codigo IS NOT NULL
 ORDER BY base`,
  description: 'Bases distintas de roteiros (filtro legacy sync) — useLegacySyncData',
  params: [],
  use: 'operacional',
  returns: '{ base }[]',
};

export const ROTEIROS_DISTINCT_TURNOS: QueryDef = {
  sql: `SELECT DISTINCT turno FROM roteiros
 WHERE turno IS NOT NULL AND codigo IS NOT NULL
 ORDER BY turno`,
  description: 'Turnos distintos de roteiros (filtro legacy sync) — useLegacySyncData',
  params: [],
  use: 'operacional',
  returns: '{ turno }[]',
};

export const EXECUCAO_PESAGENS_LIST_FILTERED: QueryDef = {
  sql: `SELECT id, id_balanca, id_despacho, codigo_despacho, data_pesagem, veiculo, residuo, origem, destino, tipo_coleta, peso_liquido, status_despacho
 FROM execucao_pesagens
 WHERE (? IS NULL OR residuo = ?)
   AND (? IS NULL OR destino = ?)
   AND (? IS NULL OR date(data_pesagem) >= date(?))
   AND (? IS NULL OR date(data_pesagem) <= date(?))
 ORDER BY data_pesagem DESC
 LIMIT ?`,
  description: 'Lista de pesagens com filtros opcionais (residuo, destino, dataInicio, dataFim) — useLegacySyncData',
  params: ['residuo?', 'residuo?', 'destino?', 'destino?', 'dataInicio?', 'dataInicio?', 'dataFim?', 'dataFim?', 'limit'],
  use: 'operacional',
  returns: 'PesagemRow[]',
};

export const EXECUCAO_PESAGENS_DISTINCT_RESIDUOS: QueryDef = {
  sql: `SELECT DISTINCT residuo FROM execucao_pesagens
 WHERE residuo IS NOT NULL
 ORDER BY residuo`,
  description: 'Residuos distintos de pesagens (filtro legacy sync) — useLegacySyncData',
  params: [],
  use: 'operacional',
  returns: '{ residuo }[]',
};

export const EXECUCAO_PESAGENS_DISTINCT_DESTINOS: QueryDef = {
  sql: `SELECT DISTINCT destino FROM execucao_pesagens
 WHERE destino IS NOT NULL
 ORDER BY destino`,
  description: 'Destinos distintos de pesagens (filtro legacy sync) — useLegacySyncData',
  params: [],
  use: 'operacional',
  returns: '{ destino }[]',
};

export const EXECUCOES_TENDENCIA_MENSAL: QueryDef = {
  sql: `
    SELECT
        strftime('%Y-%m', e.data_execucao) AS mes,
        COUNT(*)                            AS total,
        SUM(CASE WHEN e.status = 'concluida' THEN 1 ELSE 0 END) AS concluidas
    FROM execucoes e
    WHERE e.data_execucao >= date('now', ? || ' months')
    GROUP BY mes
    ORDER BY mes ASC
  `,
  description: 'Tendência mensal de execuções de campo nos últimos N meses',
  params: ['meses_atras'],
  use: 'dashboard',
  returns: '{ mes, total, concluidas }[]',
};
