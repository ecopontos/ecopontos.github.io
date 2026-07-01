# Mobile SQLite Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile inbound sync handlers use the local Capacitor SQLite contract instead of legacy IndexedDB stores.

**Architecture:** Keep `EventBus` dispatching handlers with `sqliteAdapter`. Make `CapacitorSqliteAdapter.transaction` match `SqlitePort`, and rewrite `mobile/www/js/sync/HandlerRegistry.js` to execute SQL against tables created by `MobileSchemaBootstrap`. Unsupported legacy entity stores are persisted as typed rows in `registro_dados`.

**Tech Stack:** JavaScript ES modules, Vitest, Capacitor SQLite adapter, local SQLite schema from `MobileSchemaBootstrap`.

---

### Task 1: Adapter Transaction Contract

**Files:**
- Test: `ecoforms/mobile/www/test/mobile-sqlite-sync.test.js`
- Modify: `ecoforms/mobile/www/js/adapters/CapacitorSqliteAdapter.js`

- [ ] **Step 1: Write the failing test**

```js
import { describe, expect, it } from 'vitest';
import { CapacitorSqliteAdapter } from '../js/adapters/CapacitorSqliteAdapter.js';

it('passes a SqlitePort-compatible tx to transaction callbacks', async () => {
  const adapter = new CapacitorSqliteAdapter();
  const calls = [];
  globalThis.Capacitor = {
    Plugins: {
      CapacitorSQLite: {
        createConnection: async () => calls.push('createConnection'),
        open: async () => calls.push('open'),
        beginTransaction: async () => calls.push('begin'),
        commitTransaction: async () => calls.push('commit'),
        rollbackTransaction: async () => calls.push('rollback'),
      },
    },
  };

  let txSeen;
  await adapter.transaction(async (tx) => {
    txSeen = tx;
  });

  expect(txSeen).toBe(adapter);
  expect(calls).toEqual(['createConnection', 'open', 'begin', 'commit']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run www/test/mobile-sqlite-sync.test.js`
Expected: FAIL because `txSeen` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

Change `CapacitorSqliteAdapter.transaction` so it calls `callback(this)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run www/test/mobile-sqlite-sync.test.js`
Expected: PASS.

### Task 2: SQLite Inbound Handler

**Files:**
- Test: `ecoforms/mobile/www/test/mobile-sqlite-sync.test.js`
- Modify: `ecoforms/mobile/www/js/sync/HandlerRegistry.js`

- [ ] **Step 1: Write the failing test**

```js
import { registerHandlers } from '../js/sync/HandlerRegistry.js';

it('registers demanda.criada as SQLite writes to demandas', async () => {
  const handlers = new Map();
  registerHandlers({ onInbound: (type, handler) => handlers.set(type, handler) });
  const db = makeFakeSqlite();

  await handlers.get('demanda.criada')({
    type: 'demanda.criada',
    time: '2026-07-01T12:00:00.000Z',
    aggregate: { id: 'dem-1' },
    data: { solicitante_id: 's1', destinatario_id: 'd1', origem_tipo: 'form' },
  }, db);

  expect(db.executed[0].sql).toContain('INSERT INTO demandas');
  expect(db.executed[0].params[0]).toBe('dem-1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run www/test/mobile-sqlite-sync.test.js`
Expected: FAIL because the current handler calls `db.transaction('tbl_demandas', 'readwrite')`.

- [ ] **Step 3: Write minimal implementation**

Rewrite handlers to use `db.execute` and `db.query`; for legacy stores without mobile tables, insert or update rows in `registro_dados`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run www/test/mobile-sqlite-sync.test.js`
Expected: PASS.

### Task 3: Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused tests**

Run: `npx vitest run www/test/mobile-sqlite-sync.test.js`
Expected: PASS.

- [ ] **Step 2: Run mobile test suite**

Run: `npx vitest run`
Expected: PASS or report unrelated pre-existing failures with exact output.

- [ ] **Step 3: Run desktop typecheck if shared types changed**

Run: `npm run typecheck` in `ecoforms/desktop`
Expected: PASS.
