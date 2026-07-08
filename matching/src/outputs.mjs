const iso = (d) => (d ? new Date(d).toISOString() : '');

function csvRow(vals) {
  return vals.map((v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

export function toRoutesGeoJSON(segmentos) {
  return {
    type: 'FeatureCollection',
    features: segmentos.map((s) => ({
      type: 'Feature',
      properties: {
        ordem: s.ordem, rua: s.rua, tipo_via: s.tipo_via,
        entrada: iso(s.entrada), saida: iso(s.saida),
        duracao_s: s.duracao_s, n_pontos: s.n_pontos,
        dist_media_m: s.dist_media_m, vel_max_kmh: s.vel_max_kmh,
      },
      geometry: s.geometry,
    })),
  };
}

export function toPointsGeoJSON(pontos) {
  return {
    type: 'FeatureCollection',
    features: pontos.map((p) => ({
      type: 'Feature',
      properties: {
        seq: p.seq, ts: iso(p.ts), rua: p.rua, tipo_via: p.tipo_via,
        dist_m: Math.round(p.dist_m * 10) / 10, velocidade: p.speed,
        ignicao: p.ignicao, ordem_segmento: p.ordem_segmento,
      },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  };
}

export function toRoutesCSV(segmentos) {
  const head = ['ordem', 'rua', 'tipo_via', 'entrada', 'saida', 'duracao_s', 'n_pontos', 'dist_media_m', 'vel_max_kmh'];
  const rows = segmentos.map((s) => csvRow([s.ordem, s.rua, s.tipo_via, iso(s.entrada), iso(s.saida), s.duracao_s, s.n_pontos, s.dist_media_m, s.vel_max_kmh]));
  return [csvRow(head), ...rows].join('\n');
}

export function toBatchCSV(summaries) {
  const head = ['arquivo', 'placa', 'dia', 'inicio', 'fim', 'n_ruas', 'n_pontos', 'dist_total_km', 'pct_dist_acima_30m'];
  const rows = summaries.map((s) => csvRow([s.arquivo, s.placa, s.dia, iso(s.inicio), iso(s.fim), s.n_ruas, s.n_pontos, s.dist_total_km, s.pct_dist_acima_30m]));
  return [csvRow(head), ...rows].join('\n');
}
