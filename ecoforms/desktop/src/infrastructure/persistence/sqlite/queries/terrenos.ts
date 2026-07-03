/**
 * Catálogo de queries: Terrenos (e relacionados: clientes geo, roteiro_clientes, rtree)
 *
 * Lookups espaciais para o mapa (useMapData e ADR-039 camadas).
 */
import type { QueryDef } from './_types';

export const CLIENTES_GEO: QueryDef = {
  sql: `SELECT c.id, c.nome,
              COALESCE(po.latitude, t.centroid_lat, c.latitude)  AS latitude,
              COALESCE(po.longitude, t.centroid_lng, c.longitude) AS longitude,
              c.tipo, c.categoria, c.endereco,
              cv.imovel_id AS terreno_id, t.nome AS terreno_nome
       FROM clientes c
       LEFT JOIN cliente_imovel_vinculos cv ON cv.cliente_id = c.id AND cv.principal = 1
       LEFT JOIN terrenos t ON t.id = cv.imovel_id
       LEFT JOIN imovel_pontos_operacionais po ON po.imovel_id = cv.imovel_id
         AND NOT EXISTS (
           SELECT 1 FROM imovel_pontos_operacionais po2
           WHERE po2.imovel_id = po.imovel_id
             AND (po2.principal > po.principal
                  OR (po2.principal = po.principal AND po2.criado_em < po.criado_em)))
       WHERE (po.latitude IS NOT NULL OR t.centroid_lat IS NOT NULL OR c.latitude IS NOT NULL)
         AND (po.longitude IS NOT NULL OR t.centroid_lng IS NOT NULL OR c.longitude IS NOT NULL)
         AND c.ativo = 1
       ORDER BY c.nome`,
  description: 'Clientes com posição resolvida via vínculo principal (ponto operacional > terreno centroid > cliente lat/lng) — useClientesGeo',
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
              COALESCE(po.latitude, t.centroid_lat, c.latitude)  AS latitude,
              COALESCE(po.longitude, t.centroid_lng, c.longitude) AS longitude,
              c.tipo, c.categoria, c.endereco,
              cv.imovel_id AS terreno_id, t.nome AS terreno_nome
       FROM clientes c
       LEFT JOIN cliente_imovel_vinculos cv ON cv.cliente_id = c.id AND cv.principal = 1
       LEFT JOIN terrenos t ON t.id = cv.imovel_id
       LEFT JOIN imovel_pontos_operacionais po ON po.imovel_id = cv.imovel_id
         AND NOT EXISTS (
           SELECT 1 FROM imovel_pontos_operacionais po2
           WHERE po2.imovel_id = po.imovel_id
             AND (po2.principal > po.principal
                  OR (po2.principal = po.principal AND po2.criado_em < po.criado_em)))
       WHERE (po.latitude IS NOT NULL OR t.centroid_lat IS NOT NULL OR c.latitude IS NOT NULL)
         AND (po.longitude IS NOT NULL OR t.centroid_lng IS NOT NULL OR c.longitude IS NOT NULL)
         AND c.ativo = 1
         AND COALESCE(po.longitude, t.centroid_lng, c.longitude) >= ?
         AND COALESCE(po.longitude, t.centroid_lng, c.longitude) <= ?
         AND COALESCE(po.latitude, t.centroid_lat, c.latitude)  >= ?
         AND COALESCE(po.latitude, t.centroid_lat, c.latitude)  <= ?
       ORDER BY c.nome`,
  description: 'Clientes no viewport via bbox filter (vínculo principal) — useClientesGeoInViewport',
  params: ['min_lng', 'max_lng', 'min_lat', 'max_lat'],
  use: 'operacional',
  returns: 'ClienteGeo[]',
};

export const CLIENTES_GEO_COUNT: QueryDef = {
  sql: `SELECT COUNT(*) AS count FROM clientes WHERE ativo = 1
        AND (
          latitude IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM cliente_imovel_vinculos cv
            JOIN terrenos t ON t.id = cv.imovel_id
            LEFT JOIN imovel_pontos_operacionais po ON po.imovel_id = cv.imovel_id
              AND NOT EXISTS (
                SELECT 1 FROM imovel_pontos_operacionais po2
                WHERE po2.imovel_id = po.imovel_id
                  AND (po2.principal > po.principal
                       OR (po2.principal = po.principal AND po2.criado_em < po.criado_em)))
            WHERE cv.cliente_id = clientes.id AND cv.principal = 1
              AND (t.centroid_lat IS NOT NULL OR po.latitude IS NOT NULL)
          )
        )`,
  description: 'Contagem de clientes com posição (lat/lng ou vínculo principal com centroide/ponto operacional) — decide viewport loading',
  params: [],
  use: 'medida',
  returns: '{ count: number }',
};

/**
 * Ordem de fallback usada para resolver a posição (latitude/longitude) de cada parada do
 * itinerário — documentada aqui e em `deriveCoordOrigem`/`deriveMotivoSemLocalizacao`
 * (`desktop/lib/itinerary.ts`):
 *   0. `roteiro_clientes.ponto_operacional_id` — override explícito de ponto nesta parada (Fase 3 logística)
 *   1. `roteiro_clientes.imovel_id` → ponto operacional principal desse imóvel (Fase 3 logística)
 *   2. `roteiro_clientes.imovel_id` → centroide desse imóvel, se não tiver ponto principal (Fase 3 logística)
 *   3. `imovel_pontos_operacionais`   — ponto operacional principal do imóvel vinculado (Fase 4 georref)
 *   4. `cliente_imovel_vinculos`      — vínculo principal do cliente resolve o imóvel (Fase 3 georref)
 *   5. `clientes.latitude/longitude`  — coordenada do próprio cliente, usada se não houver vínculo/centroide
 * Se nada disso resolver, a parada fica sem localização (latitude/longitude nulos no resultado).
 *
 * Histórico: até a migração da Fase 3 (follow-up) do georreferenciamento, a resolução passava por
 * `clientes.terreno_id` (FK 1:1, ADR-038) e por um override `roteiro_clientes.terreno_id` (per-stop)
 * que nunca foi escrito pelo app — ambos removidos da resolução. Os níveis 0-2 acima são o override
 * por parada dedicado, reintroduzido como feature real na Fase 3 do plano de logística.
 *
 * As colunas `terreno_centroid_lat/lng`, `ponto_operacional_lat/lng`, `parada_*` abaixo são expostas
 * apenas para a UI derivar, no client, a origem da coordenada usada — não introduzem colunas novas no
 * banco, apenas reexpõem valores já lidos por este JOIN.
 */
export const ROTEIRO_CLIENTES_ITINERARIO: QueryDef = {
  sql: `SELECT rc.ordem,
              c.id  AS cliente_id,
              c.nome,
              COALESCE(po_parada.latitude, po_imovel_parada.latitude, t_parada.centroid_lat, po.latitude, t.centroid_lat, c.latitude)  AS latitude,
              COALESCE(po_parada.longitude, po_imovel_parada.longitude, t_parada.centroid_lng, po.longitude, t.centroid_lng, c.longitude) AS longitude,
              COALESCE(rc.imovel_id, cv.imovel_id) AS terreno_id,
              COALESCE(t_parada.nome, t.nome)      AS terreno_nome,
              COALESCE(t_parada.codigo_cadastral, t.codigo_cadastral) AS codigo_cadastral,
              t.centroid_lat    AS terreno_centroid_lat,
              t.centroid_lng    AS terreno_centroid_lng,
              po.latitude       AS ponto_operacional_lat,
              po.longitude      AS ponto_operacional_lng,
              rc.ponto_operacional_id AS parada_ponto_operacional_id,
              po_parada.latitude AS parada_ponto_operacional_lat,
              po_parada.longitude AS parada_ponto_operacional_lng,
              rc.imovel_id      AS parada_imovel_id,
              po_imovel_parada.latitude AS parada_imovel_ponto_operacional_lat,
              po_imovel_parada.longitude AS parada_imovel_ponto_operacional_lng,
              t_parada.centroid_lat AS parada_imovel_centroid_lat,
              t_parada.centroid_lng AS parada_imovel_centroid_lng
       FROM roteiro_clientes rc
       JOIN clientes c ON c.id = rc.cliente_id
       LEFT JOIN cliente_imovel_vinculos cv ON cv.cliente_id = c.id AND cv.principal = 1
       LEFT JOIN terrenos t ON t.id = cv.imovel_id
       LEFT JOIN imovel_pontos_operacionais po ON po.imovel_id = cv.imovel_id
         AND NOT EXISTS (
           SELECT 1 FROM imovel_pontos_operacionais po2
           WHERE po2.imovel_id = po.imovel_id
             AND (po2.principal > po.principal
                  OR (po2.principal = po.principal AND po2.criado_em < po.criado_em)))
       LEFT JOIN imovel_pontos_operacionais po_parada ON po_parada.id = rc.ponto_operacional_id
       LEFT JOIN terrenos t_parada ON t_parada.id = rc.imovel_id
       LEFT JOIN imovel_pontos_operacionais po_imovel_parada ON po_imovel_parada.imovel_id = rc.imovel_id
         AND NOT EXISTS (
           SELECT 1 FROM imovel_pontos_operacionais po_imovel_parada2
           WHERE po_imovel_parada2.imovel_id = po_imovel_parada.imovel_id
             AND (po_imovel_parada2.principal > po_imovel_parada.principal
                  OR (po_imovel_parada2.principal = po_imovel_parada.principal AND po_imovel_parada2.criado_em < po_imovel_parada.criado_em)))
       WHERE rc.roteiro_id = ? AND rc.ativo = 1 AND c.ativo = 1
       ORDER BY rc.ordem`,
  description: 'Paradas de um roteiro com nome, posição e origem da coordenada (override de parada > vínculo principal > cliente lat/lng; raw p/ diagnóstico na UI) — useItinerario',
  params: ['roteiro_id'],
  use: 'operacional',
  returns: 'ItinerarioStop[]',
};

// ── Fase 4: pontos operacionais do imóvel (terreno) ──

export const TERRENO_BY_ID: QueryDef = {
  sql: `SELECT id, nome, codigo_cadastral, tipo, geojson,
               centroid_lat, centroid_lng, area_m2, bairro, logradouro, numero, cidade, estado,
               observacoes, ativo
        FROM terrenos WHERE id = ?`,
  description: 'Um terreno por id (todos os campos) — página de detalhe do terreno',
  params: ['id'],
  use: 'operacional',
  returns: 'TerrenoGeo & { logradouro, numero, observacoes }',
};

export const PONTO_OP_BY_IMOVEL: QueryDef = {
  sql: `SELECT id, imovel_id, tipo, latitude, longitude, principal, origem, observacao,
               criado_em, atualizado_em
        FROM imovel_pontos_operacionais
        WHERE imovel_id = ?
        ORDER BY principal DESC, criado_em ASC`,
  description: 'Pontos operacionais de um imóvel (terreno) — usePontosOperacionais',
  params: ['imovel_id'],
  use: 'operacional',
  returns: 'PontoOperacional[]',
};

export const PONTO_OP_INSERT: QueryDef = {
  sql: `INSERT INTO imovel_pontos_operacionais
        (id, imovel_id, tipo, latitude, longitude, principal, origem, observacao, criado_em, atualizado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  description: 'Insere um ponto operacional — insertPontoOperacional',
  params: ['id', 'imovel_id', 'tipo', 'latitude', 'longitude', 'principal', 'origem', 'observacao'],
  use: 'operacional',
  returns: 'void',
};

export const PONTO_OP_UPDATE: QueryDef = {
  sql: `UPDATE imovel_pontos_operacionais
        SET tipo = ?, latitude = ?, longitude = ?, observacao = ?, atualizado_em = datetime('now')
        WHERE id = ?`,
  description: 'Atualiza tipo/coordenada/observação de um ponto operacional — updatePontoOperacional',
  params: ['tipo', 'latitude', 'longitude', 'observacao', 'id'],
  use: 'operacional',
  returns: 'void',
};

export const PONTO_OP_DELETE: QueryDef = {
  sql: `DELETE FROM imovel_pontos_operacionais WHERE id = ?`,
  description: 'Remove um ponto operacional — deletePontoOperacional',
  params: ['id'],
  use: 'operacional',
  returns: 'void',
};

/** Desmarca todos os principais do imóvel antes de promover um novo (garante unicidade). */
export const PONTO_OP_CLEAR_PRINCIPAL: QueryDef = {
  sql: `UPDATE imovel_pontos_operacionais SET principal = 0 WHERE imovel_id = ?`,
  description: 'Desmarca principais do imóvel — setPontoOperacionalPrincipal step 1',
  params: ['imovel_id'],
  use: 'operacional',
  returns: 'void',
};

export const PONTO_OP_SET_PRINCIPAL: QueryDef = {
  sql: `UPDATE imovel_pontos_operacionais SET principal = 1, atualizado_em = datetime('now') WHERE id = ?`,
  description: 'Promove um ponto operacional a principal — setPontoOperacionalPrincipal step 2',
  params: ['id'],
  use: 'operacional',
  returns: 'void',
};

// ── Fase 5 (parte Desktop): evidência GPS de campo ──
// A comparação (dentro/fora da poligonal, distância até a referência) é feita client-side
// via `compareGpsEvidence` (src/lib/gpsEvidence.ts), reaproveitando pointInPolygon/haversineMeters
// já usados na Fase 3 — por isso GPS_EVIDENCIA_BY_IMOVEL traz o geojson/centroide do terreno junto.

export const GPS_EVIDENCIA_INSERT: QueryDef = {
  sql: `INSERT INTO imovel_gps_evidencias
        (id, imovel_id, cliente_id, latitude, longitude, accuracy, provider, altitude, heading, capturado_em, origem, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  description: 'Insere um registro de evidência GPS de campo — insertGpsEvidencia',
  params: ['id', 'imovel_id', 'cliente_id', 'latitude', 'longitude', 'accuracy', 'provider', 'altitude', 'heading', 'capturado_em', 'origem'],
  use: 'operacional',
  returns: 'void',
};

export const GPS_EVIDENCIA_BY_IMOVEL: QueryDef = {
  sql: `SELECT ge.id, ge.imovel_id, ge.cliente_id, ge.latitude, ge.longitude, ge.accuracy,
               ge.provider, ge.altitude, ge.heading, ge.capturado_em, ge.origem, ge.criado_em,
               t.geojson AS terreno_geojson, t.centroid_lat AS terreno_centroid_lat, t.centroid_lng AS terreno_centroid_lng
        FROM imovel_gps_evidencias ge
        LEFT JOIN terrenos t ON t.id = ge.imovel_id
        WHERE ge.imovel_id = ?
        ORDER BY ge.criado_em DESC`,
  description: 'Evidências GPS de um imóvel, com geojson/centroide do terreno para comparação client-side via compareGpsEvidence',
  params: ['imovel_id'],
  use: 'operacional',
  returns: 'GpsEvidenciaRow[]',
};
