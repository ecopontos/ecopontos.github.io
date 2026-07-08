import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork } from '../src/roadnetwork.mjs';
import { runMatching } from '../src/engine.mjs';

const net = buildNetwork([{ id: 0, name: 'A', highway: 'residential', coords: [[0, 0], [1, 0]] }]);
const trajeto = { id: 'X|d', placa: 'X', dia: 'd', arquivo: 't.csv',
  pontos: [{ seq: 1, ts: new Date('2026-06-05T09:00:00'), lat: 0, lon: 0.5, speed: 10, ignicao: 'L', placa: 'X' }] };

test('runMatching JS retorna MatchResult com resumo', async () => {
  const r = await runMatching(trajeto, net, { engine: 'js' });
  assert.equal(r.segmentos.length, 1);
  assert.equal(r.resumo.n_ruas, 1);
});

test('runMatching cai para JS quando duckdb falha', async () => {
  let fell = false;
  const r = await runMatching(trajeto, net, {
    engine: 'duckdb',
    duckdbFn: async () => { throw new Error('sem internet'); },
    onFallback: () => { fell = true; },
  });
  assert.equal(fell, true);
  assert.equal(r.segmentos.length, 1);
});

test('runMatching ainda cai para JS quando onFallback lanca erro', async () => {
  const r = await runMatching(trajeto, net, {
    engine: 'duckdb',
    duckdbFn: async () => { throw new Error('sem internet'); },
    onFallback: () => { throw new Error('onFallback quebrado'); },
  });
  assert.equal(r.segmentos.length, 1);
  assert.equal(r.resumo.n_ruas, 1);
});
