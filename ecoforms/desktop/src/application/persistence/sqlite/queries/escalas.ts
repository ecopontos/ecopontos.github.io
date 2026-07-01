/**
 * Catálogo de queries: Escalas
 *
 * Lookups simples (lista, by id) para o editor de usuários e para
 * o hook useEscalas.
 */
import type { QueryDef } from './_types';

export const ESCALAS_LIST: QueryDef = {
  sql: `SELECT id, nome FROM escalas ORDER BY nome`,
  description: 'Lista de escalas (id + nome) ordenadas por nome',
  params: [],
  use: 'operacional',
  returns: '{ id, nome }[]',
};

export const ESCALAS_LIST_FULL: QueryDef = {
  sql: `SELECT id, nome, tipo, referencia_inicio, duracao_minutos,
              tolerancia_minutos, ciclo_horas, criado_em, atualizado_em
       FROM escalas ORDER BY nome`,
  description: 'Lista completa de escalas (todos os campos) — useEscalas refetch',
  params: [],
  use: 'operacional',
  returns: 'Escala[]',
};

export const ESCALA_INSERT: QueryDef = {
  sql: `INSERT INTO escalas
 (id, nome, tipo, referencia_inicio, duracao_minutos, tolerancia_minutos, ciclo_horas, criado_em, atualizado_em)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  description: 'Insere uma nova escala',
  params: [
    'id', 'nome', 'tipo', 'referencia_inicio', 'duracao_minutos',
    'tolerancia_minutos', 'ciclo_horas', 'criado_em', 'atualizado_em',
  ],
  use: 'operacional',
  returns: 'void',
};

export const ESCALA_UPDATE: QueryDef = {
  sql: `UPDATE escalas SET nome=?, tipo=?, referencia_inicio=?, duracao_minutos=?,
                          tolerancia_minutos=?, ciclo_horas=?, atualizado_em=?
        WHERE id=?`,
  description: 'Atualiza uma escala existente',
  params: [
    'nome', 'tipo', 'referencia_inicio', 'duracao_minutos',
    'tolerancia_minutos', 'ciclo_horas', 'atualizado_em', 'id',
  ],
  use: 'operacional',
  returns: 'void',
};

export const ESCALA_DELETE: QueryDef = {
  sql: `DELETE FROM escalas WHERE id=?`,
  description: 'Deleta uma escala por id',
  params: ['id'],
  use: 'operacional',
  returns: 'void',
};
