import type { QueryDef } from './_types';

export const PACOTES_ANALISE: QueryDef = {
  sql: `
    SELECT
        id,
        dados,
        criado_em,
        resumo_usuario AS usuario,
        resumo_status  AS status
    FROM pacotes
    WHERE tipo_form = ?
      AND (? = '' OR dados LIKE ? OR resumo_usuario LIKE ?)
      AND (? = 'all' OR resumo_status = ?)
    ORDER BY criado_em DESC
    LIMIT ?
  `,
  description: 'Registros de pacotes para análise — busca textual, filtro por status, limite configurável',
  params: ['tipo_form', 'search_term', 'search_term_like', 'search_term_like', 'status', 'status', 'limit'],
  use: 'operacional',
  returns: '{ id, dados, criado_em, usuario, status }[]',
};