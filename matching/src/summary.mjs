import { haversineMeters } from './geo.mjs';

const THRESHOLD_M = 30;

export function buildSummary(trajeto, segmentos, pontos_casados) {
  const n = pontos_casados.length;
  let distM = 0;
  for (let i = 1; i < n; i++) {
    const a = pontos_casados[i - 1], b = pontos_casados[i];
    distM += haversineMeters(a.lon, a.lat, b.lon, b.lat);
  }
  const acima = pontos_casados.filter((p) => p.dist_m > THRESHOLD_M).length;
  const ts = pontos_casados.map((p) => p.ts);
  return {
    arquivo: trajeto.arquivo,
    placa: trajeto.placa,
    dia: trajeto.dia,
    inicio: n ? new Date(Math.min(...ts)) : null,
    fim: n ? new Date(Math.max(...ts)) : null,
    n_ruas: segmentos.length,
    n_pontos: n,
    dist_total_km: Math.round((distM / 1000) * 10) / 10,
    pct_dist_acima_30m: n ? Math.round((acima / n) * 1000) / 10 : 0,
  };
}
