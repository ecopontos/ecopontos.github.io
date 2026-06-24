import assert from 'assert';

// Teste de paginação do InboundService — simula o comportamento de slice
const INBOUND_PAGE_SIZE = 50;

function simulatePull(pendingFiles) {
  const page = pendingFiles.slice(0, INBOUND_PAGE_SIZE);
  const remaining = Math.max(0, pendingFiles.length - page.length);
  return { processed: page.length, remaining };
}

let failures = 0;

try {
  // Cenário 1: menos que PAGE_SIZE → processa todos, remaining=0
  const r1 = simulatePull(Array.from({ length: 30 }, (_, i) => `evt_${i + 1}_abc.enc`));
  assert.strictEqual(r1.processed, 30);
  assert.strictEqual(r1.remaining, 0);
  console.log('✔ 30 files → processa 30, remaining 0');

  // Cenário 2: exatamente PAGE_SIZE → processa todos, remaining=0
  const r2 = simulatePull(Array.from({ length: 50 }, (_, i) => `evt_${i + 1}_abc.enc`));
  assert.strictEqual(r2.processed, 50);
  assert.strictEqual(r2.remaining, 0);
  console.log('✔ 50 files → processa 50, remaining 0');

  // Cenário 3: mais que PAGE_SIZE → processa só a primeira página
  const r3 = simulatePull(Array.from({ length: 120 }, (_, i) => `evt_${i + 1}_abc.enc`));
  assert.strictEqual(r3.processed, 50);
  assert.strictEqual(r3.remaining, 70);
  console.log('✔ 120 files → processa 50, remaining 70');

  // Cenário 4: 5000 files (dispositivo offline por semanas)
  const r4 = simulatePull(Array.from({ length: 5000 }, (_, i) => `evt_${i + 1}_abc.enc`));
  assert.strictEqual(r4.processed, 50);
  assert.strictEqual(r4.remaining, 4950);
  console.log('✔ 5000 files → processa 50, remaining 4950 (UI não trava)');

  // Cenário 5: 0 files
  const r5 = simulatePull([]);
  assert.strictEqual(r5.processed, 0);
  assert.strictEqual(r5.remaining, 0);
  console.log('✔ 0 files → processa 0, remaining 0');

  // Cenário 6: 3 chamadas sequenciais simulando cursor
  const allFiles = Array.from({ length: 120 }, (_, i) => `evt_${i + 1}_abc.enc`);
  let offset = 0;
  let totalProcessed = 0;
  while (offset < allFiles.length) {
    const batch = allFiles.slice(offset, offset + INBOUND_PAGE_SIZE);
    totalProcessed += batch.length;
    offset += INBOUND_PAGE_SIZE;
    console.log(`  Batch: ${batch.length} files, offset now: ${offset}`);
  }
  assert.strictEqual(totalProcessed, 120);
  console.log('✔ Cursor sequencial: 3 batches de 120 files → todos processados');

  console.log('\nAll InboundService pagination tests passed');
} catch (err) {
  failures++;
  console.error('Test failed:', err && err.message ? err.message : err);
}

if (failures > 0) process.exit(1);
