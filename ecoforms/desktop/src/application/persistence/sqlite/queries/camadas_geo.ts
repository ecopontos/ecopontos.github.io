/**
 * Catalogo de queries: Camadas Geo
 *
 * Lookups + mutacoes de camadas_geo (camadas genericas de overlay no mapa).
 */
import type { QueryDef } from './_types';

export const GEO_LAYERS_LIST: QueryDef = {
  sql: `SELECT id, nome, tipo, categoria, geojson, cor, visivel
 FROM camadas_geo ORDER BY criado_em DESC`,
  description: 'Lista de camadas geo (mais recentes primeiro) — useGeoLayers',
  params: [],
  use: 'operacional',
  returns: 'GeoLayer[]',
};

export const GEO_LAYER_UPSERT: QueryDef = {
  sql: `INSERT INTO camadas_geo
 (id, nome, tipo, categoria, geojson, cor, visivel, criado_por, criado_em, atualizado_em)
 VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
 ON CONFLICT(id) DO UPDATE SET
   nome=excluded.nome, geojson=excluded.geojson, cor=excluded.cor,
   atualizado_em=excluded.atualizado_em`,
  description: 'Insere/atualiza uma camada geo — saveGeoLayer',
  params: [
    'id', 'nome', 'tipo', 'categoria', 'geojson', 'cor',
    'criado_por', 'criado_em', 'atualizado_em',
  ],
  use: 'operacional',
  returns: 'void',
};

export const GEO_LAYER_TOGGLE_VISIVEL: QueryDef = {
  sql: `UPDATE camadas_geo SET visivel = ? WHERE id = ?`,
  description: 'Toggle de visibilidade de uma camada geo — toggleGeoLayerVisivel',
  params: ['visivel', 'id'],
  use: 'operacional',
  returns: 'void',
};

export const GEO_LAYER_DELETE: QueryDef = {
  sql: `DELETE FROM camadas_geo WHERE id = ?`,
  description: 'Deleta uma camada geo — deleteGeoLayer',
  params: ['id'],
  use: 'operacional',
  returns: 'void',
};
