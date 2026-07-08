import { nearestOnPolyline, distToPolylineMeters } from './geo.mjs';
import { bboxOfCoords } from './roadnetwork.mjs';

const GAP_BUFFER_DEG = 0.0025;

export function snapPoint(lon, lat, network) {
  let radius = 0.0009; // ~100 m
  let cand = [];
  for (let tries = 0; tries < 8 && cand.length === 0; tries++) {
    cand = network.index.search(lon - radius, lat - radius, lon + radius, lat + radius);
    radius *= 2;
  }
  if (cand.length === 0) cand = network.roads.map((r) => r.id);
  let best = null;
  for (const id of cand) {
    const r = network.roads[id];
    const { d2 } = nearestOnPolyline(lon, lat, r.coords);
    if (!best || d2 < best.d2) best = { d2, road: r };
  }
  const road = best.road;
  return {
    street_id: road.id,
    rua: road.name,
    tipo_via: road.highway,
    dist_m: distToPolylineMeters(lon, lat, road.coords),
  };
}

// Nota: seleção de candidatos de gap-fill por bbox (aqui) vs. geometria real
// (ST_Intersects em engine-duckdb.mjs) são testes diferentes — bbox-vs-bbox é
// mais permissivo nos cantos que geometria-vs-polígono-de-buffer. Os dois
// motores podem legitimamente incluir trechos de via ligeiramente diferentes
// nas bordas, mesmo com contagem/sequência de segmentos idênticas. Esperado,
// não é bug.
function bboxesIntersect(a, b) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function segmentGeometry(network, group) {
  const rua = group.rua;
  let idsToUse;
  if (rua && network.byName.has(rua)) {
    // area de busca = bbox dos pontos do grupo, com folga
    let sb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of group.pontos) {
      sb = [Math.min(sb[0], p.lon), Math.min(sb[1], p.lat),
            Math.max(sb[2], p.lon), Math.max(sb[3], p.lat)];
    }
    const area = [sb[0] - GAP_BUFFER_DEG, sb[1] - GAP_BUFFER_DEG,
                  sb[2] + GAP_BUFFER_DEG, sb[3] + GAP_BUFFER_DEG];
    const bboxIds = network.byName.get(rua).filter((id) =>
      bboxesIntersect(bboxOfCoords(network.roads[id].coords), area));
    // garante que os trechos efetivamente casados entrem mesmo se o
    // fallback de rede esparsa em snapPoint tiver escolhido um road cujo
    // bbox caia fora da area bufferizada (evita geometria vazia)
    const matchedIds = group.pontos.map((p) => p.street_id);
    idsToUse = [...new Set([...bboxIds, ...matchedIds])];
  } else {
    idsToUse = [...new Set(group.pontos.map((p) => p.street_id))];
  }
  const lines = idsToUse.map((id) => network.roads[id].coords);
  return lines.length === 1
    ? { type: 'LineString', coordinates: lines[0] }
    : { type: 'MultiLineString', coordinates: lines };
}

export function runMatchingJS(trajeto, network) {
  const snapped = trajeto.pontos.map((p) => {
    const s = snapPoint(p.lon, p.lat, network);
    return { ...p, ...s, ordem_segmento: 0 };
  });
  // agrupar consecutivos
  const groups = [];
  let cur = null;
  for (const s of snapped) {
    const key = s.rua ?? `sem_nome:${s.street_id}`;
    if (!cur || cur.key !== key) {
      cur = { key, rua: s.rua, tipo_via: s.tipo_via, pontos: [] };
      groups.push(cur);
    }
    cur.pontos.push(s);
  }
  const segmentos = groups.map((g, i) => {
    const ordem = i + 1;
    g.pontos.forEach((p) => { p.ordem_segmento = ordem; });
    const ts = g.pontos.map((p) => p.ts);
    const entrada = new Date(Math.min(...ts));
    const saida = new Date(Math.max(...ts));
    return {
      ordem,
      rua: g.rua,
      tipo_via: g.tipo_via,
      entrada, saida,
      duracao_s: Math.round((saida - entrada) / 1000),
      n_pontos: g.pontos.length,
      dist_media_m: Math.round((g.pontos.reduce((a, p) => a + p.dist_m, 0) / g.pontos.length) * 10) / 10,
      vel_max_kmh: Math.max(...g.pontos.map((p) => p.speed)),
      geometry: segmentGeometry(network, g),
    };
  });
  return { segmentos, pontos_casados: snapped };
}
