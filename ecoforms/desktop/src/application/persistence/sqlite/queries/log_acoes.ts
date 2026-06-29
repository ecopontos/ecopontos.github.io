/**
 * Catálogo de queries: Log de Ações
 *
 * INSERT/SELECT/DELETE sobre `log_acoes` (rastro operacional).
 * Schema: id, id_acao, tipo_alvo, id_alvo, id_usuario, resultado, erro, criado_em.
 */
import type { QueryDef } from './_types';

export const LOG_ACAO_INSERT: QueryDef = {
  sql: `INSERT INTO log_acoes
 (id, id_acao, tipo_alvo, id_alvo, id_usuario, resultado, criado_em)
 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  description: 'Insere um log de acao com resultado JSON (demanda.actions, encaminhamento.actions)',
  params: ['id', 'id_acao', 'tipo_alvo', 'id_alvo', 'id_usuario', 'resultado'],
  use: 'operacional',
  returns: 'void',
};

export const LOG_ACAO_INSERT_ERRO: QueryDef = {
  sql: `INSERT INTO log_acoes
 (id, id_acao, tipo_alvo, id_alvo, id_usuario, erro, criado_em)
 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
  description: 'Insere um log de acao com erro (encaminhamento.actions catch path)',
  params: ['id', 'id_acao', 'tipo_alvo', 'id_alvo', 'id_usuario', 'erro'],
  use: 'operacional',
  returns: 'void',
};

export const LOG_ACOES_BY_USER: QueryDef = {
  sql: `SELECT id, id_acao, tipo_alvo, id_alvo, id_usuario, resultado, erro, criado_em
 FROM log_acoes
 WHERE id_usuario = ?
 ORDER BY criado_em DESC
 LIMIT 500`,
  description: 'Logs de um usuario (exportacao GDPR — ExportacaoDadosTitularUseCase)',
  params: ['id_usuario'],
  use: 'operacional',
  returns: '{ id, id_acao, tipo_alvo, id_alvo, id_usuario, resultado, erro, criado_em }[]',
};

export const LOG_ACOES_DELETE_BY_USER: QueryDef = {
  sql: `DELETE FROM log_acoes WHERE id_usuario = ?`,
  description: 'Deleta todos os logs de um usuario (EliminacaoTitularUseCase)',
  params: ['id_usuario'],
  use: 'operacional',
  returns: 'void',
};
