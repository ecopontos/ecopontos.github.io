import type { QueryDef } from './_types';

export const CLASSIFICACAO_SUBASSUNTOS: QueryDef = {
  sql: `SELECT id, nome FROM subassuntos WHERE assunto_id = ? AND ativo = 1 ORDER BY nome`,
  description: 'Subassuntos ativos de um assunto pai',
  params: ['assunto_id'],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const CLASSIFICACAO_SUBUNIDADES: QueryDef = {
  sql: `SELECT id, nome FROM subunidades WHERE setor_id = ? AND ativo = 1 ORDER BY nome`,
  description: 'Subunidades ativas de um setor',
  params: ['setor_id'],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const CLASSIFICACAO_PROGRAMAS_ORCAMENTARIOS: QueryDef = {
  sql: `SELECT id, (codigo || ' — ' || nome) AS nome FROM programas_orcamentarios WHERE ativo = 1 ORDER BY exercicio DESC, codigo`,
  description: 'Programas orçamentários ativos para selects (formato: código — nome)',
  params: [],
  use: 'operacional',
  returns: '{ id, nome }[]',
};
