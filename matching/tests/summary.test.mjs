import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary } from '../src/summary.mjs';

test('buildSummary calcula metricas', () => {
  const trajeto = { arquivo: 't.csv', placa: 'X', dia: '2026-06-05', pontos: [] };
  const pontos = [
    { lon: 0, lat: 0, ts: new Date('2026-06-05T09:00:00'), dist_m: 2 },
    { lon: 0, lat: 1, ts: new Date('2026-06-05T09:10:00'), dist_m: 40 },
  ];
  const segs = [{ rua: 'A' }, { rua: 'B' }];
  const s = buildSummary(trajeto, segs, pontos);
  assert.equal(s.n_ruas, 2);
  assert.equal(s.n_pontos, 2);
  assert.ok(Math.abs(s.dist_total_km - 111.2) < 1, `got ${s.dist_total_km}`);
  assert.equal(s.pct_dist_acima_30m, 50);
});
