import assert from 'assert';
import { resolveConflict, profileForEventType, ConflictProfile } from './ConflictResolver.js';

let failures = 0;

try {
  // ===== Profile A: Operational Records (LWW + hash) =====

  // A1: No remote record → local wins
  const a1 = resolveConflict(ConflictProfile.A, { id: '1', updated_at: '2026-05-01' }, null);
  assert.strictEqual(a1.hasConflict, false);
  assert.strictEqual(a1.winner, 'local');
  assert.strictEqual(a1.strategy, 'no_remote');
  console.log('✔ A1: no remote → local wins');

  // A2: LWW — remote newer
  const a2 = resolveConflict(ConflictProfile.A,
    { id: '1', updated_at: '2026-05-01T10:00:00Z' },
    { id: '1', updated_at: '2026-05-02T10:00:00Z' }
  );
  assert.strictEqual(a2.hasConflict, true);
  assert.strictEqual(a2.winner, 'remote');
  assert.strictEqual(a2.strategy, 'last_write_wins');
  console.log('✔ A2: remote newer → remote wins');

  // A3: LWW — local newer
  const a3 = resolveConflict(ConflictProfile.A,
    { id: '1', updated_at: '2026-05-02T10:00:00Z' },
    { id: '1', updated_at: '2026-05-01T10:00:00Z' }
  );
  assert.strictEqual(a3.hasConflict, true);
  assert.strictEqual(a3.winner, 'local');
  assert.strictEqual(a3.strategy, 'last_write_wins');
  console.log('✔ A3: local newer → local wins');

  // A4: Hash tiebreak — identical content (within tolerance)
  const a4 = resolveConflict(ConflictProfile.A,
    { id: '1', updated_at: '2026-05-01T10:00:01Z', dados: { valor: 100 } },
    { id: '1', updated_at: '2026-05-01T10:00:02Z', dados: { valor: 100 } }
  );
  assert.strictEqual(a4.hasConflict, false);
  assert.strictEqual(a4.strategy, 'identical_content');
  console.log('✔ A4: identical content → no conflict');

  // A5: Hash tiebreak — different content within tolerance → local wins
  const a5 = resolveConflict(ConflictProfile.A,
    { id: '1', updated_at: '2026-05-01T10:00:01Z', dados: { valor: 100 } },
    { id: '1', updated_at: '2026-05-01T10:00:02Z', dados: { valor: 200 } }
  );
  assert.strictEqual(a5.hasConflict, true);
  assert.strictEqual(a5.winner, 'local');
  assert.strictEqual(a5.strategy, 'content_hash_tiebreak');
  console.log('✔ A5: different content within tolerance → local wins');

  // A6: Both timestamps null → local wins
  const a6 = resolveConflict(ConflictProfile.A,
    { id: '1' },
    { id: '1' }
  );
  assert.strictEqual(a6.hasConflict, true);
  assert.strictEqual(a6.winner, 'local');
  console.log('✔ A6: no timestamps → local wins');

  // ===== Profile B: Granular per-key (Ecoponto) =====

  // B1: No conflicts → returned as-is
  const b1 = resolveConflict(ConflictProfile.B,
    { caixa1: '50', caixa2: '75' },
    { caixa1: '50', caixa2: '75' }
  );
  assert.strictEqual(b1.hasConflicts, false);
  assert.deepStrictEqual(b1.resolved, { caixa1: '50', caixa2: '75' });
  console.log('✔ B1: identical values → no conflicts');

  // B2: Remote has newer value
  const b2 = resolveConflict(ConflictProfile.B,
    { caixa1: '50', caixa2: '75' },
    { caixa1: '80', caixa2: '75' }
  );
  assert.strictEqual(b2.hasConflicts, true);
  assert.deepStrictEqual(b2.resolved, { caixa1: '80', caixa2: '75' });
  assert.deepStrictEqual(b2.serverWins, ['caixa1']);
  console.log('✔ B2: remote has newer key → server wins that key');

  // B3: Local only key
  const b3 = resolveConflict(ConflictProfile.B,
    { caixa1: '50', caixa3: '30' },
    { caixa1: '50' }
  );
  assert.strictEqual(b3.hasConflicts, true);
  assert.deepStrictEqual(b3.resolved, { caixa1: '50', caixa3: '30' });
  assert.deepStrictEqual(b3.localWins, ['caixa3']);
  console.log('✔ B3: local-only key → local wins');

  // ===== Profile C: Server-wins =====

  // C1: Remote exists → remote wins
  const c1 = resolveConflict(ConflictProfile.C,
    { id: '1', nome: 'Local' },
    { id: '1', nome: 'Server' }
  );
  assert.strictEqual(c1.hasConflict, true);
  assert.strictEqual(c1.winner, 'remote');
  assert.strictEqual(c1.strategy, 'server_wins');
  console.log('✔ C1: server-wins → remote wins');

  // C2: No remote → local wins
  const c2 = resolveConflict(ConflictProfile.C,
    { id: '1', nome: 'Local' },
    null
  );
  assert.strictEqual(c2.hasConflict, false);
  assert.strictEqual(c2.winner, 'local');
  console.log('✔ C2: no remote → local wins');

  // ===== profileForEventType mapping =====

  assert.strictEqual(profileForEventType('suite.submission.created'), ConflictProfile.A);
  assert.strictEqual(profileForEventType('task.moved'), ConflictProfile.A);
  assert.strictEqual(profileForEventType('demanda.submitted'), ConflictProfile.A);
  assert.strictEqual(profileForEventType('ecoponto.caixas.updated'), ConflictProfile.B);
  assert.strictEqual(profileForEventType('caixas.updated'), ConflictProfile.B);
  assert.strictEqual(profileForEventType('data-registry.changed'), ConflictProfile.C);
  assert.strictEqual(profileForEventType('user.updated'), ConflictProfile.C);
  assert.strictEqual(profileForEventType('form.config.updated'), ConflictProfile.C);
  assert.strictEqual(profileForEventType(null), ConflictProfile.A); // fallback
  assert.strictEqual(profileForEventType('unknown.type'), ConflictProfile.A); // fallback
  console.log('✔ profileForEventType: all mappings correct');

  console.log('\nAll ConflictResolver tests passed');
} catch (err) {
  failures++;
  console.error('Test failed:', err && err.message ? err.message : err);
}

if (failures > 0) process.exit(1);
