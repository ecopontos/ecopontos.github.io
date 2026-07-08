import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRoutesGeoJSON, toPointsGeoJSON, toRoutesCSV, toBatchCSV } from '../src/outputs.mjs';

const segs = [{
  ordem: 1, rua: 'A', tipo_via: 'residential',
  entrada: new Date('2026-06-05T09:00:00'), saida: new Date('2026-06-05T09:05:00'),
  duracao_s: 300, n_pontos: 3, dist_media_m: 2.1, vel_max_kmh: 40,
  geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] },
}];

test('toRoutesGeoJSON gera FeatureCollection válida', () => {
  const fc = toRoutesGeoJSON(segs);
  assert.equal(fc.type, 'FeatureCollection');
  assert.equal(fc.features[0].properties.rua, 'A');
  assert.equal(fc.features[0].geometry.type, 'LineString');
});

test('toRoutesCSV tem cabeçalho e linha', () => {
  const csv = toRoutesCSV(segs);
  const lines = csv.trim().split('\n');
  assert.match(lines[0], /rua/);
  assert.match(lines[1], /A/);
});

test('toPointsGeoJSON e toBatchCSV', () => {
  const pts = [{ seq: 1, ts: new Date('2026-06-05T09:00:00'), lat: 0, lon: 0, speed: 10, ignicao: 'Ligado', rua: 'A', tipo_via: 'residential', dist_m: 2, ordem_segmento: 1 }];
  assert.equal(toPointsGeoJSON(pts).features[0].geometry.coordinates[0], 0);
  const csv = toBatchCSV([{ arquivo: 't.csv', placa: 'X', dia: '2026-06-05', inicio: new Date(), fim: new Date(), n_ruas: 1, n_pontos: 1, dist_total_km: 0, pct_dist_acima_30m: 0 }]);
  assert.match(csv, /placa/);
});
