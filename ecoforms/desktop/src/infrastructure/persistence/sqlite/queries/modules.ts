import type { QueryDef } from './_types';

export const MODULO_POR_SLUG: QueryDef = {
  sql: `SELECT id, slug, nome, tipo_entidade, configuracao FROM registro_modulos WHERE slug = ? AND status = 'published' LIMIT 1`,
  description: 'Módulo publicado por slug',
  params: ['slug'],
  use: 'operacional',
  returns: '{ id, slug, nome, tipo_entidade, configuracao }',
};

export const DASHBOARD_WIDGETS: QueryDef = {
  sql: `SELECT widgets FROM view_registry WHERE id = ? LIMIT 1`,
  description: 'Widgets de um dashboard por ID',
  params: ['id'],
  use: 'operacional',
  returns: '{ widgets }',
};
