import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineMeters, nearestOnPolyline, distToPolylineMeters } from '../src/geo.mjs';

test('haversineMeters ~111km por grau de latitude', () => {
  const m = haversineMeters(0, 0, 0, 1);
  assert.ok(Math.abs(m - 111195) < 500, `got ${m}`);
});

test('nearestOnPolyline projeta no segmento', () => {
  const { nlon, nlat } = nearestOnPolyline(0.5, 0.5, [[0, 0], [1, 0]]);
  assert.ok(Math.abs(nlon - 0.5) < 1e-9);
  assert.ok(Math.abs(nlat - 0) < 1e-9);
});

test('distToPolylineMeters ~0 sobre a linha', () => {
  assert.ok(distToPolylineMeters(0.5, 0, [[0, 0], [1, 0]]) < 1);
});
