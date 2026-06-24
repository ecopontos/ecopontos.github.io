import type { QueryDef } from './_types';

export const INBOX_SEARCH: QueryDef = {
  sql: `
    SELECT
        v.id,
        v.user_id,
        v.criado_em,
        v.form_type     AS tipo_form,
        v.titulo,
        v.usuario_nome_completo,
        v.localizacao,
        v.status        AS sync_status,
        v.lifecycle_status,
        v.dados_completos AS dados_json,
        v.usuario_perfil
    FROM vw_inbox_normalizada v
    WHERE v.id IN (
        SELECT suite_id FROM suite_fts WHERE texto_busca MATCH ?
    )
      AND v.tipo_form != 'solicitacao'
      AND COALESCE(json_extract(v.dados_completos, '$.campos.tipo_submissao'), '') != 'SOLICITACAO'
      AND COALESCE(json_extract(v.dados_completos, '$.form_data.tipo_submissao'), '') != 'SOLICITACAO'
      AND COALESCE(json_extract(v.dados_completos, '$.payload.tipo_submissao'), '') != 'SOLICITACAO'
      AND COALESCE(json_extract(v.dados_completos, '$.payload.campos.tipo_submissao'), '') != 'SOLICITACAO'
    ORDER BY v.criado_em DESC
  `,
  description: 'Inbox com busca full-text via FTS — acesso filtrado por perfil',
  params: ['fts_query'],
  use: 'operacional',
  returns: '{ id, user_id, criado_em, tipo_form, titulo, usuario_nome_completo, localizacao, sync_status, lifecycle_status, dados_json, usuario_perfil }[]',
};

export const INBOX_LIST: QueryDef = {
  sql: `
    SELECT
        v.id,
        v.user_id,
        v.criado_em,
        v.form_type     AS tipo_form,
        v.titulo,
        v.usuario_nome_completo,
        v.localizacao,
        v.status        AS sync_status,
        v.lifecycle_status,
        v.dados_completos AS dados_json,
        v.usuario_perfil
    FROM vw_inbox_normalizada v
    WHERE v.tipo_form != 'solicitacao'
      AND COALESCE(json_extract(v.dados_completos, '$.campos.tipo_submissao'), '') != 'SOLICITACAO'
      AND COALESCE(json_extract(v.dados_completos, '$.form_data.tipo_submissao'), '') != 'SOLICITACAO'
      AND COALESCE(json_extract(v.dados_completos, '$.payload.tipo_submissao'), '') != 'SOLICITACAO'
      AND COALESCE(json_extract(v.dados_completos, '$.payload.campos.tipo_submissao'), '') != 'SOLICITACAO'
    ORDER BY v.criado_em DESC
  `,
  description: 'Inbox completo — sem busca FTS, acesso filtrado por perfil',
  params: [],
  use: 'operacional',
  returns: '{ id, user_id, criado_em, tipo_form, titulo, usuario_nome_completo, localizacao, sync_status, lifecycle_status, dados_json, usuario_perfil }[]',
};