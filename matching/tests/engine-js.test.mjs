import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNetwork } from '../src/roadnetwork.mjs';
import { snapPoint, runMatchingJS } from '../src/engine-js.mjs';

// duas ruas paralelas: A em y=0, B em y=1; A tem dois trechos (gap no meio)
const roads = [
  { id: 0, name: 'A', highway: 'residential', coords: [[0, 0], [1, 0]] },
  { id: 1, name: 'A', highway: 'residential', coords: [[2, 0], [3, 0]] },
  { id: 2, name: 'B', highway: 'residential', coords: [[0, 1], [3, 1]] },
];
const net = buildNetwork(roads);

test('snapPoint escolhe a rua mais próxima', () => {
  const s = snapPoint(0.5, 0.02, net);
  assert.equal(s.rua, 'A');
  assert.ok(s.dist_m > 0);
});

test('runMatchingJS agrupa consecutivos e preenche gap da rua A', () => {
  const mk = (lon, lat, t) => ({ seq: 0, ts: new Date(t), lat, lon, speed: 10, ignicao: 'Ligado', placa: 'X' });
  const trajeto = {
    id: 'X|2026-06-05', placa: 'X', dia: '2026-06-05', arquivo: 't.csv',
    pontos: [
      mk(0.1, 0.0, '2026-06-05T09:00:00'),  // A trecho 1
      mk(2.9, 0.0, '2026-06-05T09:01:00'),  // A trecho 2 (mesmo grupo: rua A)
      mk(1.5, 1.0, '2026-06-05T09:02:00'),  // B
    ].map((p, i) => ({ ...p, seq: i + 1 })),
  };
  const { segmentos, pontos_casados } = runMatchingJS(trajeto, net);
  assert.equal(segmentos.length, 2);          // A, depois B
  assert.equal(segmentos[0].rua, 'A');
  // gap preenchido: os DOIS trechos de A entram -> MultiLineString
  assert.equal(segmentos[0].geometry.type, 'MultiLineString');
  assert.equal(segmentos[0].geometry.coordinates.length, 2);
  assert.equal(segmentos[1].rua, 'B');
  assert.equal(pontos_casados.length, 3);
  assert.equal(pontos_casados[0].ordem_segmento, segmentos[0].ordem);
});

// rede esparsa: unico road 'C' fica longe do cluster de pontos GPS, entao
// snapPoint so o encontra via fallback (cand.length === 0 -> todos os roads).
// O bbox de 'C' cai totalmente fora da area bufferizada (0.0025 graus) do
// grupo -> sem a correcao, idsToUse ficaria vazio e a geometria sumiria.
const roadsEsparsos = [
  { id: 0, name: 'C', highway: 'residential', coords: [[10, 10], [11, 10]] },
];
const netEsparso = buildNetwork(roadsEsparsos);

test('runMatchingJS inclui o trecho casado via fallback de rede esparsa mesmo fora do buffer de gap-fill', () => {
  const mk = (lon, lat, t) => ({ seq: 0, ts: new Date(t), lat, lon, speed: 10, ignicao: 'Ligado', placa: 'X' });
  const trajeto = {
    id: 'X|2026-06-05', placa: 'X', dia: '2026-06-05', arquivo: 't.csv',
    pontos: [
      mk(0.0, 0.0, '2026-06-05T09:00:00'),
      mk(0.01, 0.01, '2026-06-05T09:01:00'),
    ].map((p, i) => ({ ...p, seq: i + 1 })),
  };
  const { segmentos } = runMatchingJS(trajeto, netEsparso);
  assert.equal(segmentos.length, 1);
  assert.equal(segmentos[0].rua, 'C');
  // geometria nao pode ficar vazia: o trecho casado deve entrar mesmo
  // com bbox fora da area bufferizada dos pontos do grupo
  assert.equal(segmentos[0].geometry.type, 'LineString');
  assert.deepEqual(segmentos[0].geometry.coordinates, roadsEsparsos[0].coords);
});
