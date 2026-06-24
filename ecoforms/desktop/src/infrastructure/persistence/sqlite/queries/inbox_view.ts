/**
 * Catálogo de queries: Inbox (view normalizada)
 *
 * Query template para o view `vw_inbox_normalizada`. O accessFilter
 * vem de `buildInboxAccessFilter` (camada access) e a searchClause
 * é opcional (FTS MATCH). Os placeholders `{{ACCESS_CLAUSE}}` e
 * `{{SEARCH_CLAUSE}}` são substituídos em runtime pelo hook — o
 * SQL final é montado em `fetchInboxNormalizada` (lookups.ts).
 */
import type { QueryDef } from './_types';

export const INBOX_NORMALIZADA_VIEW: QueryDef = {
  sql: `SELECT
  v.id,
  v.user_id,
  v.criado_em,
  v.form_type AS tipo_form,
  v.titulo,
  v.usuario_nome_completo,
  v.localizacao,
  v.status AS sync_status,
  v.lifecycle_status,
  v.dados_completos AS dados_json,
  v.usuario_perfil
FROM vw_inbox_normalizada v
WHERE {{ACCESS_CLAUSE}}
  AND v.tipo_form != 'solicitacao'
  AND COALESCE(json_extract(v.dados_completos, '$.campos.tipo_submissao'), '') != 'SOLICITACAO'
  AND COALESCE(json_extract(v.dados_completos, '$.form_data.tipo_submissao'), '') != 'SOLICITACAO'
  AND COALESCE(json_extract(v.dados_completos, '$.payload.tipo_submissao'), '') != 'SOLICITACAO'
  AND COALESCE(json_extract(v.dados_completos, '$.payload.campos.tipo_submissao'), '') != 'SOLICITACAO'
{{SEARCH_CLAUSE}}`,
  description:
    'View normalizada do inbox. Templates: {{ACCESS_CLAUSE}} (substituir pelo accessFilter.clause ' +
    'de buildInboxAccessFilter) e {{SEARCH_CLAUSE}} (substituir por FTS MATCH clause ou ORDER BY). ' +
    'NOTA: a string searchTerm eh interpolada como `"${searchTerm}"*` para prefix match do FTS5 — ' +
    'preserva o comportamento original mas eh vetor teorico de injection se searchTerm vier de fonte ' +
    'nao-confiavel. Corrigir com escape de aspas duplas em batch futuro.',
  params: [],
  use: 'operacional',
  returns: 'InboxViewRow[]',
};
