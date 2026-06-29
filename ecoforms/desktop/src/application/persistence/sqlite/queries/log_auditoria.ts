/**
 * Catálogo de queries: Log de Auditoria
 *
 * Lookups e mutações sobre `log_auditoria` (rastro de auditoria
 * separado do log_acoes operacional).
 */
import type { QueryDef } from './_types';

export const LOG_AUDITORIA_DELETE_BY_USER: QueryDef = {
  sql: `DELETE FROM log_auditoria WHERE id_ator = ?`,
  description: 'Deleta logs de auditoria de um usuario (eliminacao titular)',
  params: ['id_ator'],
  use: 'operacional',
  returns: 'void',
};
