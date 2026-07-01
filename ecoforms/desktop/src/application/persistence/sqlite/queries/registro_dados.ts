/**
 * Catálogo de queries: Registro de Dados
 *
 * Lookups sobre `registro_dados` (form data genérico, ancorado por
 * `tipo` + `json_extract(conteudo, '$.ecoponto')`).
 */
import type { QueryDef } from './_types';

export const REGISTRO_DADOS_BY_TIPO_ECOPONTO: QueryDef = {
  sql: `SELECT conteudo, criado_em FROM registro_dados
 WHERE tipo = ?
   AND json_extract(conteudo, '$.ecoponto') = ?
 ORDER BY criado_em ASC`,
  description: 'Registros de dados filtrados por tipo + ecoponto (useRemocaoAnalytics — historico de caixas)',
  params: ['tipo', 'ecoponto_id'],
  use: 'operacional',
  returns: '{ conteudo, criado_em }[]',
};
