/**
 * Catálogo de queries: Execução de Clientes (e ADR-039 camadas: checklist, intercorrências)
 *
 * Lookups espaciais para as camadas de execução do mapa.
 */
import type { QueryDef } from './_types';

export const EXECUCAO_CLIENTES_GEO: QueryDef = {
  sql: `SELECT ec.id, ec.execucao_id, ec.cliente_id,
              c.nome AS cliente_nome, c.endereco,
              ec.coleta_realizada, ec.horario_visita,
              ec.latitude, ec.longitude
       FROM execucao_clientes ec
       JOIN clientes c ON c.id = ec.cliente_id
       WHERE ec.execucao_id = ?
         AND ec.latitude IS NOT NULL`,
  description: 'Pontos de execução de clientes (geocoded) — useExecucaoGeo',
  params: ['execucao_id'],
  use: 'operacional',
  returns: 'ExecucaoClienteGeo[]',
};

export const INTERCORRENCIAS_GEO: QueryDef = {
  sql: `SELECT ic.id, ic.execucao_id,
              ti.nome AS tipo_nome, COALESCE(ti.cor, '#6B7280') AS tipo_cor,
              ic.descricao, ic.resolvido, ic.registrado_em,
              ic.latitude, ic.longitude
       FROM intercorrencias_coleta ic
       JOIN tipos_intercorrencia ti ON ti.id = ic.tipo_ocorrencia_id
       WHERE ic.execucao_id = ?
         AND ic.latitude IS NOT NULL`,
  description: 'Intercorrências de uma execução (geocoded) — useIntercorrenciasGeo',
  params: ['execucao_id'],
  use: 'operacional',
  returns: 'IntercorrenciaGeo[]',
};

export const CHECKLIST_GEO: QueryDef = {
  sql: `SELECT id, execucao_id, item, concluido, evidencia_url, latitude, longitude
 FROM checklist_execucao
 WHERE execucao_id = ?
   AND latitude IS NOT NULL`,
  description: 'Itens de checklist de uma execução (geocoded) — useChecklistGeo',
  params: ['execucao_id'],
  use: 'operacional',
  returns: 'ChecklistGeo[]',
};
