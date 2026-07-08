import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MALHA_GZ_B64 } from '../data/malha.gz.b64.js';
import { decodeNetworkNode } from '../src/decode-node.mjs';
import { roadsFromGeoJSON, buildNetwork } from '../src/roadnetwork.mjs';

test('blob decodifica e monta rede com ~14576 linhas', () => {
  const fc = decodeNetworkNode(MALHA_GZ_B64);
  const net = buildNetwork(roadsFromGeoJSON(fc));
  assert.ok(net.roads.length > 14000, `got ${net.roads.length}`);
});
