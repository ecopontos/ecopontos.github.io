/**
 * Catálogo de queries: Terrenos (e relacionados: clientes geo, roteiro_clientes, rtree)
 *
 * Lookups espaciais para o mapa (useMapData e ADR-039 camadas).
 */
import type { QueryDef } from './_types';

export const CLIENTES_GEO: QueryDef = {
  sql: `SELECT c.id, c.nome,
              COALESCE(t.centroid_lat, c.latitude)  AS latitude,
              COALESCE(t.centroid_lng, c.longitude) AS longitude,
              c.tipo, c.categoria, c.endereco,
              c.terreno_id, t.nome AS terreno_nome
       FROM clientes c
       LEFT JOIN terrenos t ON t.id = c.terreno_id
       WHERE (t.centroid_lat IS NOT NULL OR c.latitude IS NOT NULL)
         AND (t.centroid_lng IS NOT NULL OR c.longitude IS NOT NULL)
         AND c.ativo = 1
       ORDER BY c.nome`,
  description: 'Clientes com posição resolvida (terreno centroid ou cliente lat/lng) — useClientesGeo',
  params: [],
  use: 'operacional',
  returns: 'ClienteGeo[]',
};

export const TERRENOS_ATIVOS: QueryDef = {
  sql: `SELECT id, nome, codigo_cadastral, tipo, geojson,
              centroid_lat, centroid_lng, area_m2, bairro, ativo
       FROM terrenos WHERE ativo = 1 ORDER BY nome`,
  description: 'Lista de terrenos ativos (todos os campos espaciais) — useTerrenos',
  params: [],
  use: 'operacional',
  returns: 'TerrenoGeo[]',
};

export const TERRENOS_IN_VIEWPORT_RTREE: QueryDef = {
  sql: `SELECT t.id, t.nome, t.codigo_cadastral, t.tipo, t.geojson,
              t.centroid_lat, t.centroid_lng, t.area_m2, t.bairro, t.ativo
       FROM terrenos t
       INNER JOIN terrenos_rtree r ON r.id = t.rowid
       WHERE t.ativo = 1
         AND r.max_lng >= ? AND r.min_lng <= ?
         AND r.max_lat >= ? AND r.min_lat <= ?
       ORDER BY t.nome`,
  description: 'Terrenos no viewport via R-Tree bbox intersection (zoom >= 12) — useTerrenosInViewport',
  params: ['min_lng', 'max_lng', 'min_lat', 'max_lat'],
  use: 'operacional',
  returns: 'TerrenoGeo[]',
};

export const TERRENOS_IN_VIEWPORT_CENTROID: QueryDef = {
  sql: `SELECT id, nome, codigo_cadastral, tipo, geojson,
              centroid_lat, centroid_lng, area_m2, bairro, ativo
       FROM terrenos
       WHERE ativo = 1
         AND centroid_lng >= ? AND centroid_lng <= ?
         AND centroid_lat >= ? AND centroid_lat <= ?
       ORDER BY nome`,
  description: 'Terrenos no viewport via centroid bbox filter (zoom < 12) — useTerrenosInViewport',
  params: ['min_lng', 'max_lng', 'min_lat', 'max_lat'],
  use: 'operacional',
  returns: 'TerrenoGeo[]',
};

export const TERRENOS_EXTENT: QueryDef = {
  sql: `SELECT MIN(bbox_min_lng) AS min_lng, MIN(bbox_min_lat) AS min_lat,
              MAX(bbox_max_lng) AS max_lng, MAX(bbox_max_lat) AS max_lat
       FROM terrenos WHERE ativo = 1`,
  description: 'Extent agregado de todos os terrenos ativos (fit-to-bounds do mapa) — useTerrenosExtent',
  params: [],
  use: 'medida',
  returns: '{ min_lng, min_lat, max_lng, max_lat }',
};

export const TERRENO_INSERT_OR_IGNORE: QueryDef = {
  sql: `INSERT OR IGNORE INTO terrenos
   (id, nome, codigo_cadastral, tipo, geojson, centroid_lat, centroid_lng,
    area_m2, bairro, logradouro, numero, cidade, estado, criado_por, criado_em, atualizado_em,
    bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  description: 'Insere um terreno (ignora se já existe) — saveTerrenosBatch',
  params: [
    'id', 'nome', 'codigo_cadastral', 'tipo', 'geojson',
    'centroid_lat', 'centroid_lng', 'area_m2',
    'bairro', 'logradouro', 'numero', 'cidade', 'estado',
    'criado_por', 'criado_em', 'atualizado_em',
    'bbox_min_lng', 'bbox_min_lat', 'bbox_max_lng', 'bbox_max_lat',
  ],
  use: 'operacional',
  returns: 'void',
};

export const TERRENOS_RTREE_UPSERT: QueryDef = {
  sql: `INSERT OR REPLACE INTO terrenos_rtree (id, min_lng, max_lng, min_lat, max_lat)
   SELECT rowid, ?, ?, ?, ? FROM terrenos WHERE id = ?`,
  description: 'Upsert do bbox R-Tree para um terreno — saveTerrenosBatch',
  params: ['min_lng', 'max_lng', 'min_lat', 'max_lat', 'terreno_id'],
  use: 'operacional',
  returns: 'void',
};

export const TERRENOS_CLEAR_TERRENO_ID_CLIENTES: QueryDef = {
  sql: `UPDATE clientes SET terreno_id = NULL WHERE terreno_id = ?`,
  description: 'Desvincula clientes de um terreno antes de deletar — deleteTerrenoById step 1',
  params: ['terreno_id'],
  use: 'operacional',
  returns: 'void',
};

export const TERRENOS_CLEAR_TERRENO_ID_ROTEIRO_CLIENTES: QueryDef = {
  sql: `UPDATE roteiro_clientes SET terreno_id = NULL WHERE terreno_id = ?`,
  description: 'Desvincula roteiro_clientes de um terreno antes de deletar — deleteTerrenoById step 2',
  params: ['terreno_id'],
  use: 'operacional',
  returns: 'void',
};

export const TERRENO_SOFT_DELETE: QueryDef = {
  sql: `UPDATE terrenos SET ativo = 0 WHERE id = ?`,
  description: 'Soft-delete de um terreno — deleteTerrenoById step 3',
  params: ['id'],
  use: 'operacional',
  returns: 'void',
};

export const CLIENTES_GEO_IN_VIEWPORT: QueryDef = {
  sql: `SELECT c.id, c.nome,
              COALESCE(t.centroid_lat, c.latitude)  AS latitude,
              COALESCE(t.centroid_lng, c.longitude) AS longitude,
              c.tipo, c.categoria, c.endereco,
              c.terreno_id, t.nome AS terreno_nome
       FROM clientes c
       LEFT JOIN terrenos t ON t.id = c.terreno_id
       WHERE (t.centroid_lat IS NOT NULL OR c.latitude IS NOT NULL)
         AND (t.centroid_lng IS NOT NULL OR c.longitude IS NOT NULL)
         AND c.ativo = 1
         AND COALESCE(t.centroid_lng, c.longitude) >= ?
         AND COALESCE(t.centroid_lng, c.longitude) <= ?
         AND COALESCE(t.centroid_lat, c.latitude)  >= ?
         AND COALESCE(t.centroid_lat, c.latitude)  <= ?
       ORDER BY c.nome`,
  description: 'Clientes no viewport via bbox filter — useClientesGeoInViewport',
  params: ['min_lng', 'max_lng', 'min_lat', 'max_lat'],
  use: 'operacional',
  returns: 'ClienteGeo[]',
};

export const CLIENTES_GEO_COUNT: QueryDef = {
  sql: `SELECT COUNT(*) AS count FROM clientes WHERE ativo = 1
        AND (latitude IS NOT NULL OR terreno_id IN (SELECT id FROM terrenos WHERE centroid_lat IS NOT NULL))`,
  description: 'Contagem de clientes com posição — decide se usa viewport loading',
  params: [],
  use: 'medida',
  returns: '{ count: number }',
};

export const ROTEIRO_CLIENTES_ITINERARIO: QueryDef = {
  sql: `SELECT rc.ordem,
              c.id  AS cliente_id,
              c.nome,
              COALESCE(t.centroid_lat, c.latitude)  AS latitude,
              COALESCE(t.centroid_lng, c.longitude) AS longitude,
              COALESCE(rc.terreno_id, c.terreno_id)  AS terreno_id,
              t.nome              AS terreno_nome,
              t.codigo_cadastral
       FROM roteiro_clientes rc
       JOIN clientes c ON c.id = rc.cliente_id
       LEFT JOIN terrenos t ON t.id = COALESCE(rc.terreno_id, c.terreno_id)
       WHERE rc.roteiro_id = ? AND rc.ativo = 1 AND c.ativo = 1
       ORDER BY rc.ordem`,
  description: 'Paradas de um roteiro com nome e posição — useItinerario',
  params: ['roteiro_id'],
  use: 'operacional',
  returns: 'ItinerarioStop[]',
};
