import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeader, findColumns } from '../src/columns.mjs';

test('normalizeHeader remove acento/caixa/espacos', () => {
  assert.equal(normalizeHeader('Data do evento'), 'datadoevento');
  assert.equal(normalizeHeader('Ignição'), 'ignicao');
  assert.equal(normalizeHeader('  Latitude '), 'latitude');
});

test('findColumns acha indices ignorando coluna vazia inicial', () => {
  const headers = ['', 'Unidade rastreada', 'Motorista', 'Data do GPS',
    'Data do evento', 'Data da atualização', 'Endereço',
    'Distância para área geográfica', 'Evento', 'Velocidade',
    'Latitude', 'Longitude', 'Ignição', 'Placa'];
  const idx = findColumns(headers);
  assert.equal(idx.ts, 4);
  assert.equal(idx.speed, 9);
  assert.equal(idx.lat, 10);
  assert.equal(idx.lon, 11);
  assert.equal(idx.ignicao, 12);
  assert.equal(idx.placa, 13);
});

test('findColumns lança erro citando coluna faltante', () => {
  assert.throws(() => findColumns(['Latitude', 'Longitude']), /Placa|Data do evento/);
});
