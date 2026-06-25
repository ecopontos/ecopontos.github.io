import type { QueryDef } from './_types';

export const PACOTES_ANALISE: QueryDef = {
  sql: `
    SELECT
        COALESCE(id_pacote, CAST(id AS TEXT)) AS id,
        COALESCE(carga_json, dados)           AS dados,
        criado_em,
        id_proprietario                       AS usuario,
        status
    FROM pacotes
    WHERE COALESCE(tipo_modulo, tipo_form) = ?
      AND (? = '' OR COALESCE(carga_json, dados) LIKE ? OR id_proprietario LIKE ?)
      AND (? = 'all' OR status = ?)
    ORDER BY criado_em DESC
    LIMIT ?
  `,
  description: 'Registros de pacotes para análise — busca textual, filtro por status, limite configurável',
  params: ['tipo_form', 'search_term', 'search_term_like', 'search_term_like', 'status', 'status', 'limit'],
  use: 'operacional',
  returns: '{ id, dados, criado_em, usuario, status }[]',
};