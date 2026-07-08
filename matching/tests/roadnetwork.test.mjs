import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadsFromGeoJSON, buildNetwork, bboxOfCoords } from '../src/roadnetwork.mjs';

const fc = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Rua A', highway: 'residential' },
      geometry: { type: 'LineString', coordinates: [[0, 0], [0, 1]] } },
    { type: 'Feature', properties: { name: '', highway: 'service' },
      geometry: { type: 'LineString', coordinates: [[5, 5], [5, 6]] } },
  ],
};

test('roadsFromGeoJSON extrai campos e name vazio vira null', () => {
  const roads = roadsFromGeoJSON(fc);
  assert.equal(roads.length, 2);
  assert.equal(roads[0].name, 'Rua A');
  assert.equal(roads[1].name, null);
});

test('buildNetwork indexa e agrupa por nome', () => {
  const net = buildNetwork(roadsFromGeoJSON(fc));
  const hits = net.index.search(-0.1, -0.1, 0.1, 1.1);
  assert.ok(hits.includes(0));
  assert.deepEqual(net.byName.get('Rua A'), [0]);
});

test('bboxOfCoords', () => {
  assert.deepEqual(bboxOfCoords([[0, 1], [2, -1]]), [0, -1, 2, 1]);
});

test('roadsFromGeoJSON atribui id pela posicao no array de saida, nao pelo indice original', () => {
  const fcWithNonLineStringFirst = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: 'Praca' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [0, 0]]] } },
      { type: 'Feature', properties: { name: 'Rua B', highway: 'residential' },
        geometry: { type: 'LineString', coordinates: [[2, 2], [2, 3]] } },
    ],
  };
  const roads = roadsFromGeoJSON(fcWithNonLineStringFirst);
  assert.equal(roads.length, 1);
  assert.equal(roads[0].name, 'Rua B');
  assert.equal(roads[0].id, 0);

  const net = buildNetwork(roads);
  const hits = net.index.search(1.9, 1.9, 2.1, 3.1);
  const byNameIds = net.byName.get('Rua B');
  assert.deepEqual(byNameIds, [0]);
  assert.ok(hits.includes(byNameIds[0]));
});
