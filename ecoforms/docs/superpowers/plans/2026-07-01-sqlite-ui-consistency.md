# SQLite × UI Consistency — Desktop Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the confirmed live SQLite↔UI inconsistencies in the desktop workspace and add a regression guard so query definitions cannot silently reference non-existent columns again.

**Architecture:** Three concrete fixes plus a systemic guard. (1) Introduce a real in-memory SQLite test helper backed by the existing `sqlite3` devDependency. (2) Use it to write a failing test that proves the `KANBAN_LOOKUP_FORMS` bug, then fix the query. (3) Extend the regression coverage to all Kanban/form lookup queries — this also uncovered and fixes a second, identical live bug in `KANBAN_LOOKUP_PROJETOS` (references a dropped `projetos.arquivado` column; see Task 3). (4) Reconcile the stale `local_db_schema.json` (mark legacy + ship a generator script). The mobile persistence-layer split is explicitly OUT OF SCOPE — it needs its own brainstorm + plan.

**Tech Stack:** TypeScript, Next.js, Tauri v2, rusqlite (runtime), `sqlite3` npm (in-memory tests), Vitest, ESLint.

## Global Constraints

- All commands run from `desktop/` unless noted otherwise.
- Test runner: `npm test` (= `vitest run`). Typecheck: `npm run typecheck`. Lint: `npm run lint`.
- Schema source of truth is `desktop/scripts/ensure-columns.ts` — NOT `local_db_schema.json`.
- `registro_formularios` primary key is `form_id` (ensure-columns.ts:950). It has NO `id_formulario` column. (`id_formulario` exists only on `tarefas` / `tarefa_formularios`.)
- `projetos` has NO `arquivado` column. ADR-012 (ensure-columns.ts:1171-1198) dropped it in favor of `arquivado_em TEXT` / `arquivado_por TEXT` (NULL = not archived). Any query filtering on `projetos.arquivado` is referencing a column that does not exist on a fresh schema.
- Never write to or delete the legacy project files outside this plan's explicit file list. The Reversa rule (`.reversa/` only) does not apply here because these are surgical fixes to existing desktop source — but do not touch legacy tables.
- No comments added to code unless requested (repo convention).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `desktop/src/test/sqliteMemory.ts` | Reusable in-memory SQLite (sqlite3 :memory:) helper exposing `query`/`execute`/`close`. | Create |
| `desktop/src/test/__tests__/sqliteMemory.test.ts` | Self-test for the helper. | Create |
| `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts` | Regression tests for `KANBAN_LOOKUP_*` query definitions against canonical DDL. | Create |
| `desktop/src/infrastructure/persistence/sqlite/queries/kanban.ts` | Defines `KANBAN_LOOKUP_FORMS` (Task 2) and `KANBAN_LOOKUP_PROJETOS` (Task 3) — both reference dropped/non-existent columns. | Modify (2 lines, across Task 2 and Task 3) |
| `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/forms.test.ts` | Regression tests for `forms.ts` SELECT lookups. | Create |
| `scripts/dump-local-schema.js` | Node CLI that regenerates `local_db_schema.json` from a live `.db` file via `PRAGMA table_info`. | Create |
| `local_db_schema.json` | Stale legacy snapshot — mark with `__meta` note. | Modify (header only) |

Rationale: the root cause of the `KANBAN_LOOKUP_FORMS` and `KANBAN_LOOKUP_PROJETOS` bugs is that query definitions are plain SQL strings with no compile/runtime check against the real schema. A real-DB test helper is the minimal, durable guard. Keeping the helper generic lets every repository query gain the same protection incrementally.

---

## Task 1: In-memory SQLite test helper

**Files:**
- Create: `desktop/src/test/sqliteMemory.ts`
- Test: `desktop/src/test/__tests__/sqliteMemory.test.ts`

**Interfaces:**
- Consumes: `sqlite3` npm package (already a devDependency in `desktop/package.json`).
- Produces: `createMemoryDb(ddlStatements?: string[]): Promise<MemoryDb>` where `MemoryDb = { query<T>(sql, params?): Promise<T[]>; execute(sql, params?): Promise<void>; close(): Promise<void> }`.

- [ ] **Step 1: Ensure `@types/sqlite3` is present**

Run from `desktop/`:
```bash
npm install -D @types/sqlite3
```
Expected: package added to `devDependencies`. (If `sqlite3` itself is missing for any reason, `npm install -D sqlite3` too — it is listed in `desktop/package.json:81` already.)

- [ ] **Step 2: Write the failing test**

Create `desktop/src/test/__tests__/sqliteMemory.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryDb, type MemoryDb } from '../sqliteMemory';

describe('createMemoryDb', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('cria tabelas via DDL e retorna linhas em query()', async () => {
        db = await createMemoryDb([
            'CREATE TABLE t (id TEXT PRIMARY KEY, nome TEXT, ativo INTEGER)',
        ]);
        await db.execute("INSERT INTO t (id, nome, ativo) VALUES ('1', 'a', 1)");
        await db.execute("INSERT INTO t (id, nome, ativo) VALUES ('2', 'b', 0)");

        const rows = await db.query<{ id: string }>('SELECT id FROM t WHERE ativo = 1');

        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe('1');
    });

    it('aceita zero statements (db vazio)', async () => {
        db = await createMemoryDb();
        const rows = await db.query<{ x: number }>('SELECT 1 AS x');
        expect(rows[0].x).toBe(1);
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run from `desktop/`:
```bash
npm test -- src/test/__tests__/sqliteMemory.test.ts
```
Expected: FAIL — `Failed to resolve import "../sqliteMemory"` (module does not exist yet).

- [ ] **Step 4: Implement the helper**

Create `desktop/src/test/sqliteMemory.ts`:
```ts
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

export interface MemoryDb {
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<void>;
    close(): Promise<void>;
}

export async function createMemoryDb(ddlStatements: string[] = []): Promise<MemoryDb> {
    const db = new sqlite3.Database(':memory:');
    const all = promisify(db.all.bind(db)) as unknown as
        (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
    const run = promisify(db.run.bind(db)) as unknown as
        (sql: string, params?: unknown[]) => Promise<sqlite3.RunResult>;
    const close = promisify(db.close.bind(db)) as unknown as () => Promise<void>;

    for (const ddl of ddlStatements) {
        await run(ddl);
    }

    return {
        query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
            return (await all(sql, params)) as T[];
        },
        execute: async (sql: string, params: unknown[] = []) => {
            await run(sql, params);
        },
        close: async () => {
            await close();
        },
    };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run from `desktop/`:
```bash
npm test -- src/test/__tests__/sqliteMemory.test.ts
```
Expected: PASS — 2 tests passed.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/test/sqliteMemory.ts desktop/src/test/__tests__/sqliteMemory.test.ts desktop/package.json desktop/package-lock.json
git commit -m "test: adiciona helper sqlite3 :memory: para testes de query"
```

---

## Task 2: Fix the `KANBAN_LOOKUP_FORMS` live bug

**Files:**
- Test: `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts`
- Modify: `desktop/src/infrastructure/persistence/sqlite/queries/kanban.ts:42-47`

**Interfaces:**
- Consumes: `createMemoryDb` from `desktop/src/test/sqliteMemory.ts` (Task 1).
- Produces: a corrected `KANBAN_LOOKUP_FORMS.sql` that selects `form_id AS value` from `registro_formularios`.

**Context:** `registro_formularios` canonical DDL (`ensure-columns.ts:949-964`) is:
```sql
CREATE TABLE IF NOT EXISTS registro_formularios (
    form_id        TEXT PRIMARY KEY,
    titulo         TEXT,
    slug           TEXT,
    conteudo       TEXT,
    versao         TEXT,
    ativo          INTEGER DEFAULT 1,
    auto_aprovacao INTEGER DEFAULT 0,
    autor          TEXT,
    tipo_form      TEXT,
    data_id        TEXT,
    situacao       TEXT DEFAULT 'draft',
    ad_hoc         INTEGER DEFAULT 0,
    criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
)
```
The current query `SELECT id_formulario AS value, titulo AS label FROM registro_formularios WHERE ativo = 1` references a column that does not exist → runtime `SQLITE_ERROR: no such column: id_formulario` in `useKanban.ts:99`.

- [ ] **Step 1: Write the failing test**

Create `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryDb, type MemoryDb } from '../../../../../test/sqliteMemory';
import { KANBAN_LOOKUP_FORMS } from '../kanban';

const DDL_REGISTRO_FORMULARIOS = `
    CREATE TABLE registro_formularios (
        form_id TEXT PRIMARY KEY,
        titulo  TEXT,
        ativo   INTEGER DEFAULT 1
    )`;

describe('KANBAN_LOOKUP_FORMS', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('retorna apenas formulários ativos como {value, label}', async () => {
        db = await createMemoryDb([DDL_REGISTRO_FORMULARIOS]);
        await db.execute("INSERT INTO registro_formularios (form_id, titulo, ativo) VALUES ('f1', 'Form Um', 1)");
        await db.execute("INSERT INTO registro_formularios (form_id, titulo, ativo) VALUES ('f2', 'Form Dois', 0)");

        const rows = await db.query<{ value: string; label: string }>(KANBAN_LOOKUP_FORMS.sql);

        expect(rows).toEqual([{ value: 'f1', label: 'Form Um' }]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `desktop/`:
```bash
npm test -- src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts
```
Expected: FAIL — error `SQLITE_ERROR: no such column: id_formulario` thrown from `db.query(KANBAN_LOOKUP_FORMS.sql)`.

- [ ] **Step 3: Apply the one-line fix**

In `desktop/src/infrastructure/persistence/sqlite/queries/kanban.ts`, change the `KANBAN_LOOKUP_FORMS` query (currently around line 42-47).

Replace:
```ts
  sql: `SELECT id_formulario AS value, titulo AS label FROM registro_formularios WHERE ativo = 1 ORDER BY titulo`,
```
With:
```ts
  sql: `SELECT form_id AS value, titulo AS label FROM registro_formularios WHERE ativo = 1 ORDER BY titulo`,
```

- [ ] **Step 4: Run the test to verify it passes**

Run from `desktop/`:
```bash
npm test -- src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/infrastructure/persistence/sqlite/queries/kanban.ts desktop/src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts
git commit -m "fix: KANBAN_LOOKUP_FORMS referenciava coluna inexistente (id_formulario -> form_id)"
```

---

## Task 3: Regression coverage for all Kanban + form lookup queries (+ fix the `KANBAN_LOOKUP_PROJETOS` live bug)

**Files:**
- Modify: `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts`
- Modify: `desktop/src/infrastructure/persistence/sqlite/queries/kanban.ts` (`KANBAN_LOOKUP_PROJETOS`, currently around line 50-56)
- Test/Create: `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/forms.test.ts`

**Interfaces:**
- Consumes: `createMemoryDb` (Task 1); `KANBAN_LOOKUP_USUARIOS`, `KANBAN_LOOKUP_PROJETOS` from `kanban.ts`; `FORMS_ATIVOS` from `forms.ts`.
- Produces: guard against future column drift on lookup queries, and a corrected `KANBAN_LOOKUP_PROJETOS.sql`.

**Context — canonical columns used by these queries:**
- `usuarios`: `id TEXT PRIMARY KEY, nome TEXT, ativo INTEGER` (kanban.ts `KANBAN_LOOKUP_USUARIOS` selects `id, nome` filtered by `ativo = 1`). This one is correct as-is — no fix needed, only a regression test.
- `projetos`: `id TEXT PRIMARY KEY, nome TEXT, arquivado_em TEXT, arquivado_por TEXT` (ensure-columns.ts:1171-1198, ADR-012). There is **no `arquivado` INTEGER column** — it was migrated to `arquivado_em`/`arquivado_por`, with `arquivado_em IS NULL` meaning "not archived". `KANBAN_LOOKUP_PROJETOS` currently does `SELECT id AS value, nome AS label FROM projetos WHERE arquivado = 0 ORDER BY nome` (kanban.ts:51) — this is a **second live bug**, identical in nature to `KANBAN_LOOKUP_FORMS` (Task 2): it references a column that does not exist on a fresh schema and throws `SQLITE_ERROR: no such column: arquivado` at runtime via `useTaskOptions()` (`src/interface/hooks/queries/useKanban.ts:100-101`). This task fixes it using the same failing-test-first approach as Task 2, instead of writing a passing test against the wrong (pre-ADR-012) schema.
- `registro_formularios`: as in Task 2.

- [ ] **Step 1: Add the `KANBAN_LOOKUP_USUARIOS` regression test (no bug — just coverage)**

Append to `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts` (inside the file, after the existing `describe`):
```ts
import { KANBAN_LOOKUP_USUARIOS, KANBAN_LOOKUP_PROJETOS } from '../kanban';

const DDL_USUARIOS = `CREATE TABLE usuarios (id TEXT PRIMARY KEY, nome TEXT, ativo INTEGER DEFAULT 1)`;

describe('KANBAN_LOOKUP_USUARIOS', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('lista apenas usuários ativos', async () => {
        db = await createMemoryDb([DDL_USUARIOS]);
        await db.execute("INSERT INTO usuarios (id, nome, ativo) VALUES ('u1', 'Ana', 1)");
        await db.execute("INSERT INTO usuarios (id, nome, ativo) VALUES ('u2', 'Bo', 0)");

        const rows = await db.query<{ value: string; label: string }>(KANBAN_LOOKUP_USUARIOS.sql);

        expect(rows).toEqual([{ value: 'u1', label: 'Ana' }]);
    });
});
```
Move the `import { KANBAN_LOOKUP_FORMS } from '../kanban';` line to a single import that also brings `KANBAN_LOOKUP_USUARIOS` (leave `KANBAN_LOOKUP_PROJETOS` for Step 2, since that one is TDD'd separately):
```ts
import { KANBAN_LOOKUP_FORMS, KANBAN_LOOKUP_USUARIOS, KANBAN_LOOKUP_PROJETOS } from '../kanban';
```
Run `npm test -- src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts` — expect this new test to PASS immediately (no bug here, `KANBAN_LOOKUP_USUARIOS` is correct).

- [ ] **Step 2: Write the failing test for `KANBAN_LOOKUP_PROJETOS` against the real (post-ADR-012) schema**

Append to the same `kanban.test.ts`:
```ts
const DDL_PROJETOS = `CREATE TABLE projetos (id TEXT PRIMARY KEY, nome TEXT, arquivado_em TEXT)`;

describe('KANBAN_LOOKUP_PROJETOS', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('lista apenas projetos não-arquivados (arquivado_em IS NULL)', async () => {
        db = await createMemoryDb([DDL_PROJETOS]);
        await db.execute("INSERT INTO projetos (id, nome, arquivado_em) VALUES ('p1', 'Alpha', NULL)");
        await db.execute("INSERT INTO projetos (id, nome, arquivado_em) VALUES ('p2', 'Beta', '2026-01-01T00:00:00Z')");

        const rows = await db.query<{ value: string; label: string }>(KANBAN_LOOKUP_PROJETOS.sql);

        expect(rows).toEqual([{ value: 'p1', label: 'Alpha' }]);
    });
});
```
Run `npm test -- src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts`.
Expected: FAIL — `SQLITE_ERROR: no such column: arquivado` thrown from `db.query(KANBAN_LOOKUP_PROJETOS.sql)`, because the DDL fixture now matches the real `projetos` schema (no `arquivado` column) instead of the query's stale assumption.

- [ ] **Step 3: Fix `KANBAN_LOOKUP_PROJETOS` in `kanban.ts`**

In `desktop/src/infrastructure/persistence/sqlite/queries/kanban.ts`, change the `KANBAN_LOOKUP_PROJETOS` query (currently around line 50-56).

Replace:
```ts
  sql: `SELECT id AS value, nome AS label FROM projetos WHERE arquivado = 0 ORDER BY nome`,
```
With:
```ts
  sql: `SELECT id AS value, nome AS label FROM projetos WHERE arquivado_em IS NULL ORDER BY nome`,
```

Run `npm test -- src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts` again. Expected: PASS.

- [ ] **Step 4: Add forms.ts lookup tests**

The exact export name is already confirmed: `FORMS_ATIVOS` in `desktop/src/infrastructure/persistence/sqlite/queries/forms.ts:19-24`, with `sql: SELECT form_id, titulo, conteudo FROM registro_formularios WHERE ativo = 1`.

Create `desktop/src/infrastructure/persistence/sqlite/queries/__tests__/forms.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryDb, type MemoryDb } from '../../../../../test/sqliteMemory';
import { FORMS_ATIVOS } from '../forms';

const DDL_REGISTRO_FORMULARIOS = `
    CREATE TABLE registro_formularios (
        form_id TEXT PRIMARY KEY,
        titulo  TEXT,
        conteudo TEXT,
        ativo   INTEGER DEFAULT 1
    )`;

describe('FORMS_ATIVOS', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('lista formulários ativos com form_id e titulo', async () => {
        db = await createMemoryDb([DDL_REGISTRO_FORMULARIOS]);
        await db.execute("INSERT INTO registro_formularios (form_id, titulo, conteudo, ativo) VALUES ('f1', 'Um', '{}', 1)");
        await db.execute("INSERT INTO registro_formularios (form_id, titulo, conteudo, ativo) VALUES ('f2', 'Dois', '{}', 0)");

        const rows = await db.query<{ form_id: string; titulo: string }>(FORMS_ATIVOS.sql);

        expect(rows.map((r) => r.form_id)).toEqual(['f1']);
    });
});
```
Expected: PASS immediately — `FORMS_ATIVOS` is correct as defined, this is coverage only, not a fix.

- [ ] **Step 5: Run all new tests together**

Run from `desktop/`:
```bash
npm test -- src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts src/infrastructure/persistence/sqlite/queries/__tests__/forms.test.ts
```
Expected: PASS for all four `describe` blocks (`KANBAN_LOOKUP_FORMS` from Task 2, plus `KANBAN_LOOKUP_USUARIOS`, `KANBAN_LOOKUP_PROJETOS`, `FORMS_ATIVOS` from this task). If anything still fails with `no such column`, that is a newly found bug — record it (do NOT silently "fix" by editing the DDL fixture to match the broken query; instead correct the query itself, the same way as Steps 2-3 above, and note it in the commit message).

- [ ] **Step 6: Commit**

```bash
git add desktop/src/infrastructure/persistence/sqlite/queries/__tests__/kanban.test.ts desktop/src/infrastructure/persistence/sqlite/queries/kanban.ts desktop/src/infrastructure/persistence/sqlite/queries/__tests__/forms.test.ts
git commit -m "fix: KANBAN_LOOKUP_PROJETOS referenciava coluna removida (arquivado -> arquivado_em) e adiciona guarda de regressao para lookups de kanban/forms"
```

---

## Task 4: Reconcile `local_db_schema.json` (mark legacy + ship generator)

**Files:**
- Create: `scripts/dump-local-schema.js`
- Modify: `local_db_schema.json` (add a `__meta` key at the top — header only)

**Interfaces:**
- Produces: a Node CLI `scripts/dump-local-schema.js <db_path>` that writes the same JSON shape as `local_db_schema.json` to stdout.

**Context:** `local_db_schema.json` is a pre-`migrate-ptbr.ts` snapshot (still shows `form_registry`, `tarefas.form_registry_id`, `data_registry`, EN timestamps). It misleads any reader into thinking it is the current schema. The canonical source is `desktop/scripts/ensure-columns.ts`.

- [ ] **Step 1: Confirm the JSON has no code consumer**

Run from repo root:
```bash
find desktop/src mobile/www packages -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -not -path "*/node_modules/*" | xargs grep -l "local_db_schema" 2>/dev/null
```
Expected: empty output (no source file imports/reads it). If something DOES read it, STOP and surface that before editing the file.

- [ ] **Step 2: Write the generator script**

Create `scripts/dump-local-schema.js`:
```js
#!/usr/bin/env node
const sqlite3 = require('sqlite3');

const dbPath = process.argv[2];
if (!dbPath) {
    console.error('Usage: node scripts/dump-local-schema.js <path/to/ecoforms.db> > local_db_schema.json');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", (err, tables) => {
    if (err) throw err;
    const out = {};
    let pending = tables.length;
    const done = () => { process.stdout.write(JSON.stringify(out, null, 2) + '\n'); db.close(); };
    if (pending === 0) return done();
    tables.forEach((t) => {
        db.all(`PRAGMA table_info(${t.name})`, (e, cols) => {
            if (e) throw e;
            out[t.name] = cols.map((c) => ({
                table_name: t.name,
                column_name: c.name,
                data_type: c.type,
                is_nullable: c.notnull ? 'NO' : 'YES',
                column_default: c.dflt,
            }));
            if (--pending === 0) done();
        });
    });
});
```

- [ ] **Step 3: Smoke-test the generator (optional, only if a .db file exists)**

If a local DB file is available (e.g. produced by running the desktop app once), run from repo root:
```bash
node scripts/dump-local-schema.js path/to/ecoforms.db | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log('tables:',Object.keys(j).length);console.log('registro_formularios cols:',(j.registro_formularios||[]).map(c=>c.column_name).join(','))})"
```
Expected: prints a table count and a `registro_formularios` column list that includes `form_id`. If no DB file is available, skip this step (the script is still valid; it will be exercised when a DB exists).

- [ ] **Step 4: Mark the JSON as legacy**

Edit `local_db_schema.json`. Replace the opening:
```json
{
  "Atendimento": [
```
with:
```json
{
  "__meta": {
    "aviso": "SNAPSHOT LEGADO pre-migracao PT-BR. NAO e a fonte de verdade.",
    "fonte_canonica": "desktop/scripts/ensure-columns.ts",
    "regenerar": "node scripts/dump-local-schema.js <caminho/para/ecoforms.db> > local_db_schema.json"
  },
  "Atendimento": [
```

- [ ] **Step 5: Verify JSON still parses**

Run from repo root:
```bash
node -e "JSON.parse(require('fs').readFileSync('local_db_schema.json','utf8')); console.log('ok')"
```
Expected: prints `ok`.

- [ ] **Step 6: Commit**

```bash
git add scripts/dump-local-schema.js local_db_schema.json
git commit -m "chore: marca local_db_schema.json como legado e adiciona gerador a partir de DB vivo"
```

---

## Out of Scope — Needs Separate Plan

The analysis surfaced two larger items deliberately excluded from this plan:

1. **Mobile persistence-layer unification (Camada A ↔ Camada B).** The mobile workspace runs 4 parallel persistence layers; domain forms read/write `sql.js` (Camada A) while sync reads the native Capacitor SQLite schema (Camada B), with no bridge for `tbl_clientes`/`tbl_coletas`/`tbl_roteiros`/`tbl_modulos`/`tbl_ecopontos`. Field-level drift exists too (`criada_em`×`criado_em`, `encerrada_por`×`encerrado_por`, `cancelada_em`/`concluido_em`/`iniciado_em` absent, `responsavel_id`×`atribuido_para`, `updated_at`×`atualizado_em`). Resolving this is an architectural decision (merge vs. bridge vs. migrate UI to Camada B) and requires the **brainstorming** skill before a plan.

2. **`form_registry_id` → `id_formulario` type cleanup (desktop).** `SqliteTaskRepository` already maps the DB column `id_formulario` to the domain field correctly, so this is cosmetic (lingering `form_registry_id` in the `KanbanTask` presentation type). Worth a small follow-up but not a correctness bug. Verify by reading `desktop/src/types` (the explore agent referenced `types/index.ts`; confirm the real path before editing).

## Self-Review Notes

- **Spec coverage:** the confirmed inconsistencies from the analysis are: (a) `KANBAN_LOOKUP_FORMS` live bug → Task 2; (b) `KANBAN_LOOKUP_PROJETOS` live bug (references dropped `projetos.arquivado`, post-ADR-012 column is `arquivado_em`) → Task 3, found during plan verification against `ensure-columns.ts:1171-1198` — the original draft mis-stated `projetos.arquivado` as a canonical column and would have shipped a regression test that passed against a fabricated/stale schema instead of catching the bug; corrected before implementation; (c) no schema-query guard → Tasks 1+3; (d) stale `local_db_schema.json` → Task 4; (e) roteiros mapping → verified NON-bug, correctly dropped; (f) mobile split → explicitly deferred with rationale. ✓
- **Placeholder scan:** no remaining conditional steps — Task 3's forms.ts export name is now given directly (`FORMS_ATIVOS`, confirmed against `forms.ts:19-24`) rather than left for the implementer to resolve. All steps contain full code. ✓
- **Type consistency:** `MemoryDb` interface identical across Tasks 1–3; `createMemoryDb` signature stable; helper import path `'../../../../../test/sqliteMemory'` is consistent from both `queries/__tests__/` locations. ✓
