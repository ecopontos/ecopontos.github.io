import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseTimestamp, parseFile, splitTrajetos } from '../src/parse.mjs';

test('parseTimestamp lê string e Date', () => {
  const d = parseTimestamp('2026-06-05 10:04:56');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 5);
  assert.equal(d.getDate(), 5);
  const d2 = new Date('2026-06-05T10:04:56');
  assert.equal(parseTimestamp(d2).getTime(), d2.getTime());
});

test('parseTimestamp interpreta DD/MM/YYYY (dia primeiro, sem ambiguidade)', () => {
  // "05/06/2026" é 5 de junho, não 6 de maio — o bug original (SheetJS
  // adivinhando MM/DD/YYYY) trocaria dia e mês para ambiguidades como esta.
  const d = parseTimestamp('05/06/2026 10:04:56');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 5); // junho (0-indexed)
  assert.equal(d.getDate(), 5);
  assert.equal(d.getHours(), 10);
  assert.equal(d.getMinutes(), 4);
  assert.equal(d.getSeconds(), 56);
});

test('parseTimestamp rejeita dia e mês fora do intervalo (32/13) em vez de estourar silenciosamente', () => {
  // new Date(y, m, d, ...) nunca dá NaN para valores fora do range — ele
  // "estoura" para outra data válida. Sem checagem explícita isso reintroduz
  // corrupção silenciosa de datas para linhas corrompidas/deslocadas.
  assert.throws(() => parseTimestamp('32/13/2026 10:00:00'), /Timestamp inválido/);
});

test('parseTimestamp rejeita mês fora do intervalo mesmo com dia válido (05/13)', () => {
  assert.throws(() => parseTimestamp('05/13/2026 10:00:00'), /Timestamp inválido/);
});

test('parseTimestamp aceita dia/mês nos limites válidos (31/12)', () => {
  const d = parseTimestamp('31/12/2026 23:59:59');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 11); // dezembro
  assert.equal(d.getDate(), 31);
  assert.equal(d.getHours(), 23);
  assert.equal(d.getMinutes(), 59);
  assert.equal(d.getSeconds(), 59);
});

test('parseFile lê CSV com cabeçalho e descarta linha sem coordenada', () => {
  const csv =
    ',Placa,Data do evento,Velocidade,Latitude,Longitude,Ignição\n' +
    ',ABC1234,2026-06-05 10:00:00,10,-27.44,-48.40,Ligado\n' +
    ',ABC1234,2026-06-05 10:00:30,,,,Ligado\n' +
    ',ABC1234,2026-06-05 10:01:00,12,-27.45,-48.41,Ligado\n';
  const recs = parseFile(new TextEncoder().encode(csv), 'x.csv');
  assert.equal(recs.length, 2);
  assert.equal(recs[0].placa, 'ABC1234');
  assert.equal(recs[0].lat, -27.44);
  assert.equal(recs[0].lon, -48.40);
});

test('parseFile lê CSV com data em formato brasileiro DD/MM/YYYY sem trocar dia/mês', () => {
  const csv =
    ',Placa,Data do evento,Velocidade,Latitude,Longitude,Ignição\n' +
    ',ABC1234,05/06/2026 10:00:00,10,-27.44,-48.40,Ligado\n' +
    ',ABC1234,05/06/2026 10:01:00,12,-27.45,-48.41,Ligado\n';
  const recs = parseFile(new TextEncoder().encode(csv), 'x.csv');
  assert.equal(recs.length, 2);
  assert.equal(recs[0].ts.getFullYear(), 2026);
  assert.equal(recs[0].ts.getMonth(), 5); // junho, não maio
  assert.equal(recs[0].ts.getDate(), 5);
});

test('parseFile lê XLSX binário via caminho type:array', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['', 'Placa', 'Data do evento', 'Velocidade', 'Latitude', 'Longitude', 'Ignição'],
    ['', 'XYZ9876', '2026-06-05 08:00:00', 15, -27.44, -48.40, 'Ligado'],
    ['', 'XYZ9876', '2026-06-05 08:01:00', 20, -27.45, -48.41, 'Ligado'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const recs = parseFile(new Uint8Array(buf), 'x.xlsx');
  assert.equal(recs.length, 2);
  assert.equal(recs[0].placa, 'XYZ9876');
  assert.equal(recs[0].lat, -27.44);
  assert.equal(recs[0].lon, -48.40);
  assert.equal(recs[1].lat, -27.45);
});

test('splitTrajetos separa por placa+dia e reindexa seq', () => {
  const base = { speed: 0, ignicao: 'Ligado' };
  const recs = [
    { ...base, placa: 'A', lat: 1, lon: 1, ts: new Date('2026-06-05T09:00:00') },
    { ...base, placa: 'A', lat: 1, lon: 1, ts: new Date('2026-06-06T09:00:00') },
    { ...base, placa: 'B', lat: 1, lon: 1, ts: new Date('2026-06-05T09:00:00') },
  ];
  const traj = splitTrajetos(recs, 'x.csv');
  assert.equal(traj.length, 3);
  assert.ok(traj.every((t) => t.pontos[0].seq === 1));
  assert.deepEqual([...new Set(traj.map((t) => t.dia))].sort(), ['2026-06-05', '2026-06-06']);
});
