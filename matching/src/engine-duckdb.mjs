// Carrega DuckDB-WASM sob demanda (requer internet). Em qualquer falha, lança
// erro para o composer cair no motor JS.
let dbPromise = null;

async function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const duckdb = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm');
    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const conn = await db.connect();
    await conn.query("INSTALL spatial; LOAD spatial; SET geometry_always_xy = true;");
    return { db, conn };
  })();
  return dbPromise;
}

function roadsToValues(network) {
  // WKT LINESTRING por via, com id/name/highway
  return network.roads.map((r) => {
    const wkt = 'LINESTRING(' + r.coords.map(([x, y]) => `${x} ${y}`).join(',') + ')';
    const name = r.name == null ? 'NULL' : `'${r.name.replace(/'/g, "''")}'`;
    return `(${r.id}, ${name}, '${r.highway.replace(/'/g, "''")}', '${wkt}')`;
  }).join(',');
}

function pointsToValues(trajeto) {
  return trajeto.pontos.map((p) =>
    `(${p.seq}, '${p.ts.toISOString()}', ${p.lon}, ${p.lat}, ${p.speed}, '${String(p.ignicao).replace(/'/g, "''")}')`
  ).join(',');
}

export async function runMatchingDuckDB(trajeto, network) {
  const { conn } = await getDB();
  await conn.query('DROP TABLE IF EXISTS malha; DROP TABLE IF EXISTS pontos;');
  await conn.query(`CREATE TABLE malha AS SELECT * FROM (VALUES ${roadsToValues(network)}) AS t(street_id, name, highway, wkt);`);
  await conn.query('ALTER TABLE malha ADD COLUMN geom GEOMETRY; UPDATE malha SET geom = ST_GeomFromText(wkt);');
  await conn.query(`CREATE TABLE pontos AS SELECT * FROM (VALUES ${pointsToValues(trajeto)}) AS t(seq, ts, lon, lat, speed, ignicao);`);
  // ts chega como VARCHAR (literal de string na VALUES); sem este cast,
  // date_diff() na query de segmentos falha com Binder Error (VARCHAR nao
  // tem overload de date_diff), mesmo o texto sendo ISO-8601 valido.
  await conn.query('ALTER TABLE pontos ALTER COLUMN ts TYPE TIMESTAMP;');
  await conn.query('ALTER TABLE pontos ADD COLUMN geom GEOMETRY; UPDATE pontos SET geom = ST_Point(lon, lat);');

  // SQL portado de _matching2.sql (snap + agrupamento + gap-fill), retornando GeoJSON
  const segRes = await conn.query(`
    WITH snapped AS (
      SELECT p.seq, p.ts, p.speed, p.lon, p.lat, p.geom AS geom,
        nn.street_id, nn.name AS rua, nn.highway AS tipo_via,
        ST_Distance_Spheroid(
          ST_Point(ST_X(ST_ClosestPoint(nn.geom,p.geom)), ST_Y(ST_ClosestPoint(nn.geom,p.geom)))::POINT_2D,
          ST_Point(p.lon,p.lat)::POINT_2D) AS dist_m
      FROM pontos p, LATERAL (
        SELECT m.street_id, m.name, m.highway, m.geom, ST_Distance(m.geom,p.geom) AS d
        FROM malha m ORDER BY d LIMIT 1) AS nn
    ),
    keyed AS (SELECT *, COALESCE(rua,'sem_nome:'||street_id) AS k FROM snapped),
    lagged AS (SELECT *, LAG(k) OVER (ORDER BY ts) AS pk FROM keyed),
    grouped AS (SELECT *, SUM(CASE WHEN k IS DISTINCT FROM pk THEN 1 ELSE 0 END) OVER (ORDER BY ts) AS grp FROM lagged),
    segbbox AS (
      SELECT grp, MIN(rua) AS rua, MIN(tipo_via) AS tipo_via,
        MIN(ts) AS entrada, MAX(ts) AS saida,
        date_diff('second',MIN(ts),MAX(ts)) AS duracao_s, COUNT(*) AS n_pontos,
        ROUND(AVG(dist_m),1) AS dist_media_m, MAX(speed) AS vel_max_kmh,
        -- 0.0025 deve ficar em sincronia com GAP_BUFFER_DEG em engine-js.mjs
        -- (os dois motores precisam usar o mesmo buffer de gap-fill para
        -- produzir resultados equivalentes).
        ST_Buffer(ST_Envelope(ST_Collect(list(geom))),0.0025) AS area
      FROM grouped GROUP BY grp)
    SELECT b.grp AS ordem, b.rua, b.tipo_via, b.entrada, b.saida, b.duracao_s,
      b.n_pontos, b.dist_media_m, b.vel_max_kmh,
      ST_AsGeoJSON(CASE WHEN b.rua IS NOT NULL THEN
        -- une os trechos da mesma via dentro da area bufferizada COM os
        -- trechos efetivamente casados ponto a ponto neste grupo (UNION ALL,
        -- nao UNION: geometrias nao tem operador de igualdade generico no
        -- spatial do DuckDB, e duplicatas sao inofensivas para ST_Union_Agg).
        -- Sem isso, se snapPoint tiver casado um ponto via fallback de rede
        -- esparsa com uma via cujo bbox cai fora da area buferizada, o
        -- filtro por bbox sozinho retorna zero linhas -> ST_Union_Agg(vazio)
        -- = NULL -> ST_AsGeoJSON(NULL) -> geometry:null sem lancar erro
        -- (nao aciona o fallback para o motor JS). Espelha a correcao ja
        -- feita em engine-js.mjs (segmentGeometry / matchedIds).
        (SELECT ST_LineMerge(ST_Union_Agg(geom)) FROM (
           SELECT m.geom FROM malha m WHERE m.name=b.rua AND ST_Intersects(m.geom,b.area)
           UNION ALL
           SELECT m.geom FROM grouped g JOIN malha m ON g.street_id=m.street_id WHERE g.grp=b.grp
         ) AS pieces)
        ELSE (SELECT ST_LineMerge(ST_Union_Agg(m.geom)) FROM grouped g JOIN malha m ON g.street_id=m.street_id WHERE g.grp=b.grp) END) AS geojson
    FROM segbbox b ORDER BY b.grp;
  `);
  const ptRes = await conn.query(`
    WITH snapped AS (
      SELECT p.seq, p.ts, p.lon, p.lat, p.speed, p.ignicao,
        nn.street_id, nn.name AS rua, nn.highway AS tipo_via,
        ST_Distance_Spheroid(
          ST_Point(ST_X(ST_ClosestPoint(nn.geom,p.geom)), ST_Y(ST_ClosestPoint(nn.geom,p.geom)))::POINT_2D,
          ST_Point(p.lon,p.lat)::POINT_2D) AS dist_m
      FROM pontos p, LATERAL (
        SELECT m.street_id, m.name, m.highway, m.geom, ST_Distance(m.geom,p.geom) AS d
        FROM malha m ORDER BY d LIMIT 1) AS nn
    ),
    keyed AS (SELECT *, COALESCE(rua,'sem_nome:'||street_id) AS k FROM snapped),
    lagged AS (SELECT *, LAG(k) OVER (ORDER BY ts) AS pk FROM keyed),
    grouped AS (SELECT *, SUM(CASE WHEN k IS DISTINCT FROM pk THEN 1 ELSE 0 END) OVER (ORDER BY ts) AS grp FROM lagged)
    SELECT seq, ts, lon, lat, speed, ignicao, street_id, rua, tipo_via, dist_m, grp AS ordem_segmento
    FROM grouped ORDER BY seq;
  `);

  const segmentos = segRes.toArray().map((r) => {
    const o = r.toJSON();
    return {
      ordem: Number(o.ordem), rua: o.rua, tipo_via: o.tipo_via,
      entrada: new Date(o.entrada), saida: new Date(o.saida),
      duracao_s: Number(o.duracao_s), n_pontos: Number(o.n_pontos),
      dist_media_m: Number(o.dist_media_m), vel_max_kmh: Number(o.vel_max_kmh),
      geometry: JSON.parse(o.geojson),
    };
  });
  const pontos_casados = ptRes.toArray().map((r) => {
    const o = r.toJSON();
    return {
      seq: Number(o.seq), ts: new Date(o.ts), lon: o.lon, lat: o.lat,
      speed: Number(o.speed), ignicao: o.ignicao, street_id: Number(o.street_id),
      rua: o.rua, tipo_via: o.tipo_via, dist_m: Number(o.dist_m),
      ordem_segmento: Number(o.ordem_segmento),
    };
  });
  return { segmentos, pontos_casados };
}
