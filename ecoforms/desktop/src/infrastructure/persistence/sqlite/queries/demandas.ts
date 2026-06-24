/**
 * Catálogo de queries: Demandas
 *
 * Lista filtrada com join em setores/usuarios para resolver nomes
 * sem N+1. O filtro de status é opcional via COALESCE (passe null
 * para listar todas). Sem construção dinâmica de SQL no repository.
 */
import type { QueryDef } from './_types';

export const DEMANDAS_LIST_WITH_DETAILS: QueryDef = {
  sql: `
    SELECT
        d.*,
        s.nome AS setor_nome,
        u.nome AS solicitante_nome
    FROM demandas d
    LEFT JOIN setores   s ON d.destinatario_id = s.id
    LEFT JOIN usuarios  u ON d.solicitante_id  = u.id
    WHERE d.status = COALESCE(?, d.status)
    ORDER BY d.criado_em DESC
    LIMIT 200
  `,
  description:
    'Lista demandas (até 200) com join em setores/usuarios (resolve nomes sem N+1). ' +
    'Filtro de status via `d.status = COALESCE(?, d.status)` — passe null para listar todas.',
  params: ['status?'],
  use: 'operacional',
  returns: '{ id, origem_tipo, origem_id, solicitante_id, destinatario_id, tipo_acao, ' +
    'descricao, status, politica_conclusao, criado_em, setor_nome, solicitante_nome }[]',
};
