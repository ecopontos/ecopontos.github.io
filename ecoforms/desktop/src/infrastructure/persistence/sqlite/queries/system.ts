import type { QueryDef } from './_types';

export const SQLITE_TABLE_INFO: QueryDef = {
  sql: `SELECT * FROM pragma_table_info(?)`,
  description: 'Metadados das colunas de uma tabela SQLite',
  params: ['table_name'],
  use: 'operacional',
  returns: '{ cid, name, type, notnull, dflt_value, pk }[]',
};

export const SQLITE_DATABASE_LIST: QueryDef = {
  sql: `PRAGMA database_list`,
  description: 'Lista bancos anexados na conexao SQLite',
  params: [],
  use: 'operacional',
  returns: '{ seq, name, file }[]',
};

export const SISTEMA_CONFIG_SAVE: QueryDef = {
  sql: `INSERT INTO tbl_configuracoes_sistema (chave, valor, atualizado_em)
 VALUES (?, ?, datetime('now'))
 ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
  description: 'Salva ou atualiza uma configuração do sistema',
  params: ['chave', 'valor'],
  use: 'operacional',
  returns: 'void',
};

export const APP_CONFIG_SAVE: QueryDef = {
  sql: `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  description: 'Salva ou atualiza uma configuração do app',
  params: ['key', 'value'],
  use: 'operacional',
  returns: 'void',
};

export const APP_CONFIG_GET: QueryDef = {
  sql: `SELECT value FROM app_config WHERE key = ?`,
  description: 'Obtém o valor de uma configuração do app',
  params: ['key'],
  use: 'operacional',
  returns: '{ value }',
};

export const AUDIT_LOG_EXPORT: QueryDef = {
  sql: `SELECT id, id_acao AS acao, tipo_alvo AS entidade, id_alvo AS id_entidade, criado_em FROM log_acoes WHERE id_usuario = ? ORDER BY criado_em DESC LIMIT 500`,
  description: 'Log de ações de um usuário para exportação GDPR',
  params: ['id_usuario'],
  use: 'operacional',
  returns: '{ id, acao, entidade, id_entidade, criado_em }[]',
};

export const SISTEMA_CONFIG_GET: QueryDef = {
  sql: `SELECT valor FROM tbl_configuracoes_sistema WHERE chave = ?`,
  description: 'Obtém o valor de uma configuração do sistema por chave',
  params: ['chave'],
  use: 'operacional',
  returns: '{ valor }',
};
