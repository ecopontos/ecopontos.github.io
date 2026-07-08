import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseFile, splitTrajetos } from '../src/parse.mjs';
import { roadsFromGeoJSON, buildNetwork } from '../src/roadnetwork.mjs';
import { runMatchingJS } from '../src/engine-js.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)); // pasta do projeto
const historicoPath = root + 'HistoricoPosicao.csv';
const malhaPath = root + 'malha_OSM.geojson';
const hasParityFixtures = existsSync(historicoPath) && existsSync(malhaPath);

test('paridade com o pipeline DuckDB: 67 segmentos', { skip: !hasParityFixtures && 'fixtures locais ausentes' }, () => {
  const csv = readFileSync(historicoPath);
  const fc = JSON.parse(readFileSync(malhaPath, 'utf8'));
  const net = buildNetwork(roadsFromGeoJSON(fc));
  const trajetos = splitTrajetos(parseFile(csv, 'HistoricoPosicao.csv'), 'HistoricoPosicao.csv');
  const total = trajetos.reduce((acc, t) => {
    const { segmentos } = runMatchingJS(t, net);
    return acc.concat(segmentos);
  }, []);
  assert.equal(total.length, 67);
  assert.equal(total[0].rua, 'Estrada Intendente Ant\u00f4nio Damasco');
  assert.equal(total[1].rua, 'Servid\u00e3o Daniel Jos\u00e9 Homem');
});

