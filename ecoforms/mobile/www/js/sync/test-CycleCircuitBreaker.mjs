import assert from 'assert';
import { CycleCircuitBreaker, BreakerState } from './CycleCircuitBreaker.js';

let failures = 0;

try {
  // ===== Estado inicial =====
  const cb = new CycleCircuitBreaker({ failureThreshold: 3, baseCooldownMs: 1000, maxCooldownMs: 8000, resetSuccessCount: 2 });
  assert.strictEqual(cb.state, BreakerState.NORMAL);
  assert.strictEqual(cb.failureCount, 0);
  assert.ok(cb.canSync());
  console.log('✔ Initial state: NORMAL, canSync=true');

  // ===== Falhas consecutivas atingem threshold → COOLDOWN =====
  cb.recordFailure();
  assert.strictEqual(cb.state, BreakerState.NORMAL); // 1/3
  cb.recordFailure();
  assert.strictEqual(cb.state, BreakerState.NORMAL); // 2/3
  cb.recordFailure();
  assert.strictEqual(cb.state, BreakerState.COOLDOWN); // 3/3 → cooldown
  assert.ok(!cb.canSync());
  console.log('✔ 3 failures → COOLDOWN, canSync=false');

  // ===== Cooldown expira → PROBE =====
  // Simular expiração do cooldown
  const cb2 = new CycleCircuitBreaker({ failureThreshold: 2, baseCooldownMs: 100, resetSuccessCount: 2 });
  cb2.recordFailure();
  cb2.recordFailure();
  assert.strictEqual(cb2.state, BreakerState.COOLDOWN);
  assert.ok(!cb2.canSync());

  // Wait for cooldown
  await new Promise(r => setTimeout(r, 150));
  assert.ok(cb2.canSync()); // cooldown expirou → probe
  assert.strictEqual(cb2.state, BreakerState.PROBE);
  console.log('✔ Cooldown expired → PROBE, canSync=true');

  // ===== Probe OK → reset após N sucessos =====
  cb2.recordSuccess(); // streak = 1
  assert.strictEqual(cb2.state, BreakerState.PROBE);
  cb2.recordSuccess(); // streak = 2 → reset
  assert.strictEqual(cb2.state, BreakerState.NORMAL);
  console.log('✔ PROBE + 2 successes → NORMAL');

  // ===== Probe FAILS → cooldown doubled =====
  const cb3 = new CycleCircuitBreaker({ failureThreshold: 2, baseCooldownMs: 100, maxCooldownMs: 8000, resetSuccessCount: 2 });
  cb3.recordFailure();
  cb3.recordFailure(); // cooldown
  await new Promise(r => setTimeout(r, 150));
  cb3.canSync(); // probe
  assert.strictEqual(cb3.state, BreakerState.PROBE);
  cb3.recordFailure(); // probe falhou → cooldown doubled
  assert.strictEqual(cb3.state, BreakerState.COOLDOWN);
  assert.strictEqual(cb3.cooldownMs, 200); // 100 * 2 = 200
  assert.ok(!cb3.canSync());
  console.log('✔ PROBE failure → cooldown doubled (200ms)');

  // ===== Max cooldown cap =====
  const cb4 = new CycleCircuitBreaker({ failureThreshold: 1, baseCooldownMs: 100, maxCooldownMs: 500, resetSuccessCount: 2 });
  // Force max cooldown through recursive probe failures
  cb4.recordFailure(); // cooldown 100
  await new Promise(r => setTimeout(r, 150));
  cb4.canSync(); // probe
  cb4.recordFailure(); // cooldown 200
  await new Promise(r => setTimeout(r, 250));
  cb4.canSync(); // probe
  cb4.recordFailure(); // cooldown 400
  await new Promise(r => setTimeout(r, 450));
  cb4.canSync(); // probe
  cb4.recordFailure(); // cooldown 500 (cap)
  assert.ok(cb4.cooldownMs <= 500);
  console.log('✔ Cooldown capped at maxCooldownMs (500ms)');

  // ===== forceReset =====
  const cb5 = new CycleCircuitBreaker({ failureThreshold: 2, baseCooldownMs: 10000 });
  cb5.recordFailure();
  cb5.recordFailure();
  assert.strictEqual(cb5.state, BreakerState.COOLDOWN);
  cb5.forceReset();
  assert.strictEqual(cb5.state, BreakerState.NORMAL);
  assert.strictEqual(cb5.failureCount, 0);
  console.log('✔ forceReset → NORMAL, failures=0');

  // ===== Success resets failure count =====
  const cb6 = new CycleCircuitBreaker({ failureThreshold: 5 });
  cb6.recordFailure();
  cb6.recordFailure();
  assert.strictEqual(cb6.failureCount, 2);
  cb6.recordSuccess();
  assert.strictEqual(cb6.failureCount, 0);
  assert.strictEqual(cb6.state, BreakerState.NORMAL);
  console.log('✔ recordSuccess → resets failureCount to 0');

  // ===== remainingCooldownMs =====
  const cb7 = new CycleCircuitBreaker({ failureThreshold: 1, baseCooldownMs: 5000 });
  cb7.recordFailure();
  assert.strictEqual(cb7.state, BreakerState.COOLDOWN);
  const remaining = cb7.remainingCooldownMs();
  assert.ok(remaining > 0 && remaining <= 5000, `Expected remaining > 0 && <= 5000, got ${remaining}`);
  cb7.forceReset();
  assert.strictEqual(cb7.remainingCooldownMs(), 0); // NORMAL state returns 0
  console.log('✔ remainingCooldownMs > 0 during cooldown, 0 after reset');

  console.log('\nAll CycleCircuitBreaker tests passed');
} catch (err) {
  failures++;
  console.error('Test failed:', err && err.message ? err.message : err);
}

if (failures > 0) process.exit(1);
