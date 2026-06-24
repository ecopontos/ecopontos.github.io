/**
 * Catálogo de queries: Geo Layers
 *
 * Lookups + mutações de geo_layers (camadas genéricas de overlay no mapa).
 */
import type { QueryDef } from './_types';

export const GEO_LAYERS_LIST: QueryDef = {
  sql: `SELECT id, nome, tipo, categoria, geojson, cor, visivel
 FROM geo_layers ORDER BY criado_em DESC`,
  description: 'Lista de geo layers (mais recentes primeiro) — useGeoLayers',
  params: [],
  use: 'operacional',
  returns: 'GeoLayer[]',
};

export const GEO_LAYER_UPSERT: QueryDef = {
  sql: `INSERT INTO geo_layers
 (id, nome, tipo, categoria, geojson, cor, visivel, criado_por, criado_em, atualizado_em)
 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
 ON CONFLICT(id) DO UPDATE SET
   nome=excluded.nome, geojson=excluded.geojson, cor=excluded.cor,
   atualizado_em=excluded.atualizado_em`,
  description: 'Insere/atualiza uma geo layer — saveGeoLayer',
  params: [
    'id', 'nome', 'tipo', 'categoria', 'geojson', 'cor',
    'criado_por', 'criado_em', 'atualizado_em',
  ],
  use: 'operacional',
  returns: 'void',
};

export const GEO_LAYER_TOGGLE_VISIVEL: QueryDef = {
  sql: `UPDATE geo_layers SET visivel = ? WHERE id = ?`,
  description: 'Toggle de visibilidade de uma geo layer — toggleGeoLayerVisivel',
  params: ['visivel', 'id'],
  use: 'operacional',
  returns: 'void',
};

export const GEO_LAYER_DELETE: QueryDef = {
  sql: `DELETE FROM geo_layers WHERE id = ?`,
  description: 'Deleta uma geo layer — deleteGeoLayer',
  params: ['id'],
  use: 'operacional',
  returns: 'void',
};
