// Verificacao independente (fora do node --test, requer o binario `duckdb`
// no PATH) da logica SQL de src/engine-duckdb.mjs: extrai as queries
// EXATAS do arquivo fonte (nao retranscritas a mao) e roda contra:
//
//   (A) dados reais do projeto (malha_OSM.geojson + HistoricoPosicao.csv na
//       raiz do repo) -- confirma 67 segmentos, 0 geometrias nulas, e a
//       MESMA sequencia de ruas do motor JS (runMatchingJS) para todos os
//       segmentos (nao so os dois primeiros).
//
//   (B) um caso de borda de rede esparsa (identico ao cenario coberto por
//       "runMatchingJS inclui o trecho casado via fallback de rede esparsa"
//       em tests/engine-js.test.mjs): uma unica via cujo bbox cai FORA da
//       area bufferizada dos pontos do grupo. Sem a uniao com os trechos
//       efetivamente casados por street_id, o filtro por bbox sozinho
//       retorna zero linhas -> ST_Union_Agg(vazio) = NULL ->
//       ST_AsGeoJSON(NULL) -> geometry:null SEM lancar excecao (ou seja,
//       sem acionar o fallback automatico para o motor JS). Este script
//       roda tanto a versao ATUAL (extraida do arquivo fonte) quanto a
//       fragmento ANTIGO (pre-fix, mantido aqui apenas como documentacao
//       do bug) para mostrar a diferenca de comportamento lado a lado.
//
// Uso: node app/tools/verify-duckdb-sql.mjs
// Sai com codigo != 0 se qualquer verificacao falhar.

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // app/tools
const appDir = join(here, '..'); // app/
const projRoot = join(appDir, '..'); // raiz do repo (contem malha_OSM.geojson, HistoricoPosicao.csv)

function runDuckDB(dbFile, sql, { json = false } = {}) {
  const args = json ? ['-json', dbFile] : [dbFile];
  return execFileSync('duckdb', args, { input: sql, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
}

function freshDbPath(name) {
  const p = join(tmpdir(), `verify-duckdb-sql-${name}-${process.pid}.db`);
  if (existsSync(p)) rmSync(p);
  return p;
}

// --- extrai as duas queries (segRes/ptRes) EXATAMENTE como estao no fonte ---
const engineSrc = readFileSync(join(appDir, 'src', 'engine-duckdb.mjs'), 'utf8');
const queryMatches = [...engineSrc.matchAll(/conn\.query\(`([\s\S]*?)`\)/g)].map((m) => m[1]);
const segQuery = queryMatches.find((q) => q.includes('ST_AsGeoJSON'));
const ptQuery = queryMatches.find((q) => q.includes('ordem_segmento') && !q.includes('ST_AsGeoJSON'));
if (!segQuery || !ptQuery) throw new Error('nao foi possivel extrair as queries de engine-duckdb.mjs');

// --- mesma logica de roadsToValues/pointsToValues de engine-duckdb.mjs ---
function roadsToValues(roads) {
  return roads.map((r) => {
    const wkt = 'LINESTRING(' + r.coords.map(([x, y]) => `${x} ${y}`).join(',') + ')';
    const name = r.name == null ? 'NULL' : `'${r.name.replace(/'/g, "''")}'`;
    return `(${r.id}, ${name}, '${r.highway.replace(/'/g, "''")}', '${wkt}')`;
  }).join(',');
}
function pointsToValues(pontos) {
  return pontos.map((p) =>
    `(${p.seq}, '${p.ts.toISOString()}', ${p.lon}, ${p.lat}, ${p.speed}, '${String(p.ignicao).replace(/'/g, "''")}')`
  ).join(',');
}

function setupSql(roads, pontos) {
  return `
INSTALL spatial; LOAD spatial; SET geometry_always_xy = true;
CREATE TABLE malha AS SELECT * FROM (VALUES ${roadsToValues(roads)}) AS t(street_id, name, highway, wkt);
ALTER TABLE malha ADD COLUMN geom GEOMETRY; UPDATE malha SET geom = ST_GeomFromText(wkt);
CREATE TABLE pontos AS SELECT * FROM (VALUES ${pointsToValues(pontos)}) AS t(seq, ts, lon, lat, speed, ignicao);
ALTER TABLE pontos ALTER COLUMN ts TYPE TIMESTAMP;
ALTER TABLE pontos ADD COLUMN geom GEOMETRY; UPDATE pontos SET geom = ST_Point(lon, lat);
CREATE TABLE seg_result AS ${segQuery};
CREATE TABLE pt_result AS ${ptQuery};
`;
}

let failures = 0;
function check(label, cond, extra = '') {
  if (cond) {
    console.log(`OK   - ${label}`);
  } else {
    failures++;
    console.log(`FAIL - ${label}${extra ? '  (' + extra + ')' : ''}`);
  }
}

// =====================================================================
// (A) dados reais do projeto: 67 segmentos, 0 geometrias nulas, paridade
//     total com o motor JS (runMatchingJS) para a sequencia de ruas.
// =====================================================================
async function verifyRealData() {
  console.log('\n=== (A) dados reais (malha_OSM.geojson + HistoricoPosicao.csv) ===');
  const { roadsFromGeoJSON, buildNetwork } = await import(pathToFileURL(join(appDir, 'src', 'roadnetwork.mjs')).href);
  const { parseFile, splitTrajetos } = await import(pathToFileURL(join(appDir, 'src', 'parse.mjs')).href);
  const { runMatchingJS } = await import(pathToFileURL(join(appDir, 'src', 'engine-js.mjs')).href);

  const fc = JSON.parse(readFileSync(join(projRoot, 'malha_OSM.geojson'), 'utf8'));
  const net = buildNetwork(roadsFromGeoJSON(fc));
  const csv = readFileSync(join(projRoot, 'HistoricoPosicao.csv'));
  const trajetos = splitTrajetos(parseFile(csv, 'HistoricoPosicao.csv'), 'HistoricoPosicao.csv');
  console.log(`trajetos encontrados: ${trajetos.length} (${trajetos.map((t) => `${t.id}: ${t.pontos.length} pts`).join(', ')})`);
  const trajeto = trajetos[0];

  const dbFile = freshDbPath('real');
  runDuckDB(dbFile, setupSql(net.roads, trajeto.pontos));

  const totalRows = JSON.parse(runDuckDB(dbFile, 'SELECT COUNT(*) AS n FROM seg_result;', { json: true }));
  const nullRows = JSON.parse(runDuckDB(dbFile, 'SELECT COUNT(*) AS n FROM seg_result WHERE geojson IS NULL;', { json: true }));
  const seqRows = JSON.parse(runDuckDB(dbFile, 'SELECT ordem, rua FROM seg_result ORDER BY ordem;', { json: true }));

  const total = totalRows[0].n;
  const nulos = nullRows[0].n;
  check('total de segmentos == 67', total === 67, `got ${total}`);
  check('0 geometrias nulas', nulos === 0, `got ${nulos}`);

  const { segmentos } = runMatchingJS(trajeto, net);
  check('mesma quantidade de segmentos que o motor JS', segmentos.length === seqRows.length,
    `JS=${segmentos.length} DuckDB=${seqRows.length}`);
  let mismatches = 0;
  for (let i = 0; i < Math.max(segmentos.length, seqRows.length); i++) {
    const jsRua = segmentos[i] ? (segmentos[i].rua ?? null) : '<faltando>';
    const dkRua = seqRows[i] ? (seqRows[i].rua ?? null) : '<faltando>';
    if (jsRua !== dkRua) {
      mismatches++;
      console.log(`  MISMATCH ordem ${i + 1}: JS="${jsRua}" DuckDB="${dkRua}"`);
    }
  }
  check('sequencia de ruas identica ao motor JS (todos os 67 segmentos)', mismatches === 0, `${mismatches} mismatches`);
  check('primeira rua == Estrada Intendente Antônio Damasco', seqRows[0]?.rua === 'Estrada Intendente Antônio Damasco');
  check('segunda rua == Servidão Daniel José Homem', seqRows[1]?.rua === 'Servidão Daniel José Homem');

  rmSync(dbFile);
}

// =====================================================================
// (B) caso de borda de rede esparsa: replica o cenario de
//     tests/engine-js.test.mjs ("...fallback de rede esparsa..."). Uma
//     unica via 'C' longe do cluster de pontos -> bbox nao intersecta a
//     area bufferizada do grupo. A query ATUAL (com UNION ALL) deve
//     retornar geometria nao-nula; o fragmento ANTIGO (pre-fix, somente
//     filtro por bbox) deve retornar NULL para o mesmo cenario.
// =====================================================================
function verifySparseNetworkEdgeCase() {
  console.log('\n=== (B) caso de borda: rede esparsa (via fora da area bufferizada) ===');
  const roads = [{ id: 0, name: 'C', highway: 'residential', coords: [[10, 10], [11, 10]] }];
  const pontos = [
    { seq: 1, ts: new Date('2026-06-05T09:00:00Z'), lon: 0.0, lat: 0.0, speed: 10, ignicao: 'Ligado' },
    { seq: 2, ts: new Date('2026-06-05T09:01:00Z'), lon: 0.01, lat: 0.01, speed: 10, ignicao: 'Ligado' },
  ];

  const dbFile = freshDbPath('sparse');
  runDuckDB(dbFile, setupSql(roads, pontos));

  const rows = JSON.parse(runDuckDB(dbFile, 'SELECT ordem, rua, geojson FROM seg_result ORDER BY ordem;', { json: true }));
  check('1 segmento no cenario esparso', rows.length === 1, `got ${rows.length}`);
  check('rua do segmento == C', rows[0]?.rua === 'C', `got ${rows[0]?.rua}`);
  check('geometria NAO nula (query atual, com UNION ALL)', rows[0]?.geojson != null);
  if (rows[0]?.geojson != null) {
    // duckdb -json ja retorna a coluna JSON (ST_AsGeoJSON) como objeto
    // aninhado, nao como string -- nao precisa de JSON.parse aqui.
    const geom = rows[0].geojson;
    check('geometria == LineString da via C', geom.type === 'LineString' &&
      JSON.stringify(geom.coordinates) === JSON.stringify(roads[0].coords),
      JSON.stringify(geom));
  }

  // --- demonstracao lado a lado: fragmento ANTIGO (pre-fix), mantido aqui
  // apenas como documentacao do bug que a UNION ALL corrige. NAO e mais
  // usado por engine-duckdb.mjs.
  const oldGeoJsonExpr = `
    LOAD spatial; SET geometry_always_xy = true;
    SELECT ST_AsGeoJSON(
      (SELECT ST_LineMerge(ST_Union_Agg(m.geom)) FROM malha m WHERE m.name='C' AND ST_Intersects(m.geom, b.area))
    ) AS geojson_old
    FROM (SELECT ST_Buffer(ST_Envelope(ST_Collect(list(geom))), 0.0025) AS area FROM pontos) b;
  `;
  const oldRows = JSON.parse(runDuckDB(dbFile, oldGeoJsonExpr, { json: true }));
  check('fragmento ANTIGO (pre-fix) reproduz o bug: geometria NULA para o mesmo cenario',
    oldRows[0]?.geojson_old == null, `got ${oldRows[0]?.geojson_old}`);

  rmSync(dbFile);
}

await verifyRealData();
verifySparseNetworkEdgeCase();

console.log(`\n${failures === 0 ? 'TODAS AS VERIFICACOES PASSARAM' : `${failures} VERIFICACAO(OES) FALHARAM`}`);
process.exit(failures === 0 ? 0 : 1);
