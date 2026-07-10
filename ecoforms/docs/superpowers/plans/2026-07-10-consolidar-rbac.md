# Consolidar RBAC (#6 hierarquia campo, #7 fonte única + codegen, #8 ghosts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate RBAC role hierarchy and permission matrix into a single canonical source in `packages/core`, generate the Rust SQL seed and mobile JS mirror from it, and delete ghost roles / dead RBAC files across desktop and mobile.

**Architecture:** A new `packages/core/src/permissions/rbac-matrix.ts` becomes the single source of truth for `ROLE_HIERARCHY` and `PERMISSION_MATRIX` (36 permission strings, 6 canonical roles: admin/gerente/coordenador/encarregado/operador/campo). A generator script (`packages/core/scripts/generate-rbac.mjs`) reads the compiled matrix and emits two mirrors: a Rust SQL seed file consumed via `include_str!` in `setup.rs`, and a `window.ECOFORMS_RBAC` JS global consumed by `mobile/www/js/auth-manager.js`. Desktop's `AccessPolicy.ts` imports the hierarchy directly instead of duplicating it. Three fully-dead mobile files (`rbac.js`, `auth-manager-v2.js`, `PermissionManager.js`) are deleted outright — confirmed unreferenced by any script tag, import, or test in the repo.

**Tech Stack:** TypeScript (packages/core, desktop), Rust (Tauri/rusqlite, desktop/src-tauri), vanilla JS (mobile), Vitest (all three test suites), Node.js (generator script, ESM, no new dependencies).

## Global Constraints

- Canonical roles are exactly these 6, no others: `admin`, `gerente`, `coordenador`, `encarregado`, `operador`, `campo`. Any role string outside this set (`superadmin`, `manager`, `user`, `guest`) is a ghost and must not appear in generated output.
- `campo` and `operador` must always be at hierarchy level `4` (peers, not sub/superordinate) — this is already correct in `desktop/src/domain/access/AccessPolicy.ts:8-15` and `desktop/src-tauri/src/commands/setup.rs:413-422`; the consolidation must not regress it.
- `system.sync` is deliberately restricted to `[admin, gerente]` in the canonical matrix — this **changes** current Rust-seed behavior (today grants to all 6 roles, `setup.rs:444`) to match the TS layer, which already restricts it (`PermissionActionAdapter.ts:94`). The app is pre-production (no live users/data), so this behavior change requires no migration plan.
- Do not modify `PermissionActionRegistry.ts`'s public API (`register`, `canExecute`, `getAvailableActions`, `registerMany`, `clearEntity`) — only add new exports alongside it.
- Generated files (`rbac_seed.sql`, `rbac-matrix.generated.js`, `__snapshots__/rbac-matrix.json`) are committed to the repo (not gitignored) and carry a `// AUTO-GERADO` / `-- AUTO-GERADO` header — never hand-edited.
- Every new/modified TS test file uses Vitest (`describe`/`it`/`expect`), matching the existing convention in `packages/core/src/permissions/__tests__/campoLevel.test.ts` and `desktop/src/application/permissions/__tests__/usePermissionsReassign.test.ts`.

---

## File Structure

**Create:**
- `packages/core/src/permissions/rbac-matrix.ts` — canonical `ROLE_HIERARCHY`, `ROLE_METADATA`, `PERMISSION_MATRIX`, `DATA_EDIT_OWN_TIME_WINDOWS`.
- `packages/core/src/permissions/__tests__/rbac-matrix.test.ts` — consistency tests for the matrix itself (ghosts, campo=operador=4, system.sync scope).
- `packages/core/scripts/generate-rbac.mjs` — reads `dist/permissions/rbac-matrix.js`, writes the 3 generated artifacts.
- `packages/core/vitest.config.ts` — test runner config (packages/core currently has **no** vitest config or devDependency; its one existing test file, `campoLevel.test.ts`, is never executed by any config in the repo today — confirmed by running both `desktop`'s and `mobile`'s vitest suites and finding zero matches).
- `desktop/src-tauri/src/commands/rbac_seed.sql` — generated Rust SQL seed (produced by Task 3, not hand-written).
- `mobile/www/js/rbac-matrix.generated.js` — generated mobile JS mirror (produced by Task 3, not hand-written).
- `packages/core/src/permissions/__snapshots__/rbac-matrix.json` — generated snapshot (produced by Task 3).
- `mobile/tests/rbac-consistency.test.js` — validates `window.ECOFORMS_RBAC` matches the core matrix and that `auth-manager.js` exposes no ghost roles.

**Modify:**
- `packages/core/src/permissions/index.ts` — re-export the new matrix module.
- `packages/core/package.json` — add `vitest` devDependency, `test` and `gen:rbac` scripts, chain `gen:rbac` into `build`.
- `mobile/package.json` — ensure core's `build` (tsc + gen:rbac) runs before mobile's own bundling step.
- `desktop/src-tauri/src/commands/setup.rs:393-471` — `seed_rbac_tables` consumes `include_str!("rbac_seed.sql")` instead of hardcoded INSERTs; add 3 new tests.
- `desktop/src/domain/access/AccessPolicy.ts:8-15` — import `ROLE_HIERARCHY` from `ecoforms-core/permissions` instead of a local duplicate.
- `desktop/src/application/permissions/PermissionActionAdapter.ts:69` — remove the dead `timeWindow: 24` on `data.edit_own` (never actually evaluated — `canExecute` is called only once in the whole desktop codebase, at `usePermissions.ts:131`, and that call never passes `ctx.createdAt`, so the check is always skipped).
- `desktop/src/interface/hooks/utils/usePermissions.ts:155-169` — `canEditData` reads role/hour buckets from `DATA_EDIT_OWN_TIME_WINDOWS` instead of hardcoded `"coordenador"` / `isOperator()` branches, preserving exact current behavior (including that `encarregado` is excluded today, same as after).
- `mobile/www/js/auth-manager.js` — `ROLE_HIERARCHY` (L742-747, currently missing `coordenador`/`campo` entirely), `fullAccessRoles` (L692), `getPermissionRoles` (L815-852), `buildAccessFilterSQL` (L792-809).
- `mobile/www/js/services/ActivityService.js:100,112-113` — remove `superadmin`/`manager` ghosts.
- `mobile/www/index.html`, `user-management.html`, `sector-management.html`, `login.html`, `diagnose-users.html` — add `<script src="js/rbac-matrix.generated.js">` before `auth-manager.js`.

**Delete:**
- `mobile/www/js/rbac.js` — confirmed unreferenced by any `<script>` tag, import, or test anywhere in the repo; its `ROLE_HIERARCHY` wrongly sets `campo: 5`.
- `mobile/www/js/auth-manager-v2.js` — confirmed unreferenced anywhere.
- `mobile/www/js/core/PermissionManager.js` — confirmed unreferenced anywhere (not even by a test — the plan's original assumption that `auth-encarregado.test.js` touches it is wrong; that file does not exist in the repo). Its role vocabulary (`superadmin`/`admin`/`manager`/`user`/`guest` + `encarregado`) doesn't map onto the canonical 6 roles at all.

---

## Task 1: packages/core test runner infrastructure

**Files:**
- Create: `packages/core/vitest.config.ts`
- Modify: `packages/core/package.json`

**Interfaces:**
- Produces: `npm --prefix packages/core test` runs Vitest across `packages/core/src/**/*.test.{ts,tsx}`. All later core tasks depend on this working.

- [ ] **Step 1: Add vitest devDependency and test script**

Edit `packages/core/package.json` — add to `devDependencies` and `scripts`:

```json
{
  "name": "ecoforms-core",
  "version": "0.1.0",
  "description": "Core compartilhado entre mobile e desktop",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./sync": {
      "import": "./dist/sync/index.js",
      "types": "./dist/sync/index.d.ts"
    },
    "./ports": {
      "import": "./dist/ports/SqlitePort.js",
      "types": "./dist/ports/SqlitePort.d.ts"
    },
    "./repositories": {
      "import": "./dist/repositories/index.js",
      "types": "./dist/repositories/index.d.ts"
    },
    "./permissions": {
      "import": "./dist/permissions/index.js",
      "types": "./dist/permissions/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc && node scripts/generate-rbac.mjs",
    "clean": "rm -rf dist",
    "test": "vitest run",
    "gen:rbac": "node scripts/generate-rbac.mjs"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "vitest": "^4.1.9"
  }
}
```

Note: `build` now runs `generate-rbac.mjs` after `tsc` — this script doesn't exist until Task 3, so `npm run build` will fail until then. That's fine; Task 1 only needs `test` to work, which doesn't depend on `build`.

- [ ] **Step 2: Write vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 3: Install and verify the existing test now runs**

Run: `npm install` (from repo root — hoists the new `vitest` devDependency for the `packages/core` workspace member)

Run: `npm --prefix packages/core test`
Expected: `campoLevel.test.ts` (the pre-existing, previously-never-executed test) is discovered and **passes** — 5 tests in `PermissionActionRegistry — campo level regression (B5)`.

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json packages/core/vitest.config.ts package-lock.json
git commit -m "test(core): wire up vitest for packages/core (campoLevel.test.ts was never executed)"
```

---

## Task 2: Canonical rbac-matrix.ts

**Files:**
- Create: `packages/core/src/permissions/rbac-matrix.ts`
- Create: `packages/core/src/permissions/__tests__/rbac-matrix.test.ts`
- Modify: `packages/core/src/permissions/index.ts`

**Interfaces:**
- Consumes: `UserRole` type from `packages/core/src/permissions/PermissionActionRegistry.ts:6`.
- Produces (used by Tasks 3, 5, 6):
  - `ROLE_HIERARCHY: Record<UserRole, number>`
  - `ROLE_METADATA: Record<UserRole, { nome: string; descricaoPerfil: string; descricaoNivel: string }>`
  - `PERMISSION_MATRIX: Record<string, { roles: UserRole[] }>`
  - `DATA_EDIT_OWN_TIME_WINDOWS: Partial<Record<UserRole, number>>`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/permissions/__tests__/rbac-matrix.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY, PERMISSION_MATRIX, ROLE_METADATA, DATA_EDIT_OWN_TIME_WINDOWS } from '../rbac-matrix';

const ALL_ROLES = ['admin', 'gerente', 'coordenador', 'encarregado', 'operador', 'campo'];
const GHOST_ROLES = ['superadmin', 'manager', 'user', 'guest'];

describe('rbac-matrix — consistência canônica', () => {
  it('ROLE_HIERARCHY define exatamente os 6 perfis canônicos', () => {
    expect(Object.keys(ROLE_HIERARCHY).sort()).toEqual([...ALL_ROLES].sort());
  });

  it('campo e operador têm o mesmo nível hierárquico (4)', () => {
    expect(ROLE_HIERARCHY.campo).toBe(4);
    expect(ROLE_HIERARCHY.operador).toBe(4);
    expect(ROLE_HIERARCHY.campo).toBe(ROLE_HIERARCHY.operador);
  });

  it('nenhuma permissão contém ghost roles nem roles desconhecidos', () => {
    for (const [, entry] of Object.entries(PERMISSION_MATRIX)) {
      for (const role of entry.roles) {
        expect(GHOST_ROLES).not.toContain(role);
        expect(ALL_ROLES).toContain(role);
      }
    }
  });

  it('system.sync é restrito a admin e gerente', () => {
    expect(PERMISSION_MATRIX['system.sync'].roles.slice().sort()).toEqual(['admin', 'gerente']);
  });

  it('tasks.reassign inclui encarregado (comportamento atual preservado)', () => {
    expect(PERMISSION_MATRIX['tasks.reassign'].roles.slice().sort()).toEqual(['admin', 'encarregado', 'gerente']);
  });

  it('ROLE_METADATA cobre os 6 perfis canônicos', () => {
    expect(Object.keys(ROLE_METADATA).sort()).toEqual([...ALL_ROLES].sort());
  });

  it('DATA_EDIT_OWN_TIME_WINDOWS reflete coordenador=48h, operador/campo=24h, encarregado sem janela', () => {
    expect(DATA_EDIT_OWN_TIME_WINDOWS.coordenador).toBe(48);
    expect(DATA_EDIT_OWN_TIME_WINDOWS.operador).toBe(24);
    expect(DATA_EDIT_OWN_TIME_WINDOWS.campo).toBe(24);
    expect(DATA_EDIT_OWN_TIME_WINDOWS.encarregado).toBeUndefined();
  });

  it('PERMISSION_MATRIX tem exatamente 36 permissões (paridade com o seed Rust atual)', () => {
    expect(Object.keys(PERMISSION_MATRIX)).toHaveLength(36);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix packages/core test -- rbac-matrix`
Expected: FAIL with `Cannot find module '../rbac-matrix'` (file doesn't exist yet).

- [ ] **Step 3: Write rbac-matrix.ts**

Create `packages/core/src/permissions/rbac-matrix.ts`:

```ts
/**
 * Fonte canônica única de RBAC — hierarquia de perfis e matriz de permissões.
 * Gerado a partir daqui: desktop/src-tauri/src/commands/rbac_seed.sql e
 * mobile/www/js/rbac-matrix.generated.js (via packages/core/scripts/generate-rbac.mjs).
 */
import type { UserRole } from './PermissionActionRegistry.js';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 0,
  gerente: 1,
  coordenador: 2,
  encarregado: 3,
  operador: 4,
  campo: 4,
};

export interface RoleMetadata {
  nome: string;
  descricaoPerfil: string;
  descricaoNivel: string;
}

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  admin: { nome: 'Administrador', descricaoPerfil: 'Acesso total', descricaoNivel: 'Acesso total' },
  gerente: { nome: 'Gerente', descricaoPerfil: 'Gestao de usuarios e relatorios', descricaoNivel: 'Gestao' },
  coordenador: { nome: 'Coordenador', descricaoPerfil: 'Coordenacao de equipe', descricaoNivel: 'Coordenacao' },
  encarregado: { nome: 'Encarregado', descricaoPerfil: 'Supervisao de campo', descricaoNivel: 'Supervisao' },
  operador: { nome: 'Operador', descricaoPerfil: 'Execucao de tarefas', descricaoNivel: 'Execucao' },
  campo: { nome: 'Campo', descricaoPerfil: 'Execucao de tarefas', descricaoNivel: 'Execucao' },
};

export interface PermissionEntry {
  roles: UserRole[];
}

export const PERMISSION_MATRIX: Record<string, PermissionEntry> = {
  'users.create': { roles: ['admin', 'gerente'] },
  'users.edit': { roles: ['admin', 'gerente'] },
  'users.delete': { roles: ['admin'] },
  'users.view_all': { roles: ['admin', 'gerente'] },
  'users.change_password': { roles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] },
  'forms.create': { roles: ['admin', 'gerente'] },
  'forms.edit': { roles: ['admin', 'gerente'] },
  'forms.delete': { roles: ['admin'] },
  'forms.assign': { roles: ['admin', 'gerente'] },
  'forms.fill': { roles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] },
  'data.view_all': { roles: ['admin', 'gerente'] },
  'data.view_own': { roles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] },
  'data.edit_all': { roles: ['admin'] },
  'data.edit_own': { roles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] },
  'data.delete': { roles: ['admin'] },
  'data.export': { roles: ['admin', 'gerente'] },
  'data.archive': { roles: ['admin', 'gerente'] },
  'system.config': { roles: ['admin'] },
  'system.logs': { roles: ['admin', 'gerente'] },
  'system.sync': { roles: ['admin', 'gerente'] },
  'system.device_setup': { roles: ['admin', 'gerente'] },
  'reports.view': { roles: ['admin', 'gerente'] },
  'reports.export': { roles: ['admin', 'gerente'] },
  'activities.manage': { roles: ['admin', 'gerente'] },
  'tasks.reassign': { roles: ['admin', 'gerente', 'encarregado'] },
  'clients.view': { roles: ['admin', 'gerente', 'coordenador'] },
  'clients.create': { roles: ['admin', 'gerente'] },
  'clients.edit': { roles: ['admin', 'gerente'] },
  'clients.delete': { roles: ['admin'] },
  'clients.export': { roles: ['admin', 'gerente'] },
  'crm.view': { roles: ['admin', 'gerente', 'coordenador', 'encarregado'] },
  'crm.edit': { roles: ['admin', 'gerente', 'coordenador'] },
  'ouvidoria.view': { roles: ['admin', 'gerente', 'coordenador', 'encarregado'] },
  'ouvidoria.create': { roles: ['admin', 'gerente', 'coordenador', 'encarregado'] },
  'ouvidoria.respond': { roles: ['admin', 'gerente', 'coordenador'] },
  'ouvidoria.close': { roles: ['admin', 'gerente'] },
};

/**
 * Janela de edição (horas) para data.edit_own por perfil, usada por canEditData().
 * admin/gerente não aparecem aqui pois têm acesso incondicional (sem janela).
 * encarregado não aparece pois hoje não tem acesso via canEditData (comportamento preservado).
 */
export const DATA_EDIT_OWN_TIME_WINDOWS: Partial<Record<UserRole, number>> = {
  coordenador: 48,
  operador: 24,
  campo: 24,
};
```

- [ ] **Step 4: Re-export from index.ts**

Edit `packages/core/src/permissions/index.ts`:

```ts
export * from './PermissionActionRegistry.js';
export * from './rbac-matrix.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix packages/core test -- rbac-matrix`
Expected: PASS — 7 tests.

Run: `npm --prefix packages/core test`
Expected: all test files pass (`campoLevel.test.ts` + `rbac-matrix.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/permissions/rbac-matrix.ts packages/core/src/permissions/__tests__/rbac-matrix.test.ts packages/core/src/permissions/index.ts
git commit -m "feat(core): add canonical RBAC matrix (rbac-matrix.ts)"
```

---

## Task 3: Generator script (packages/core → Rust SQL + mobile JS + snapshot)

**Files:**
- Create: `packages/core/scripts/generate-rbac.mjs`
- Create (generated, committed): `desktop/src-tauri/src/commands/rbac_seed.sql`
- Create (generated, committed): `mobile/www/js/rbac-matrix.generated.js`
- Create (generated, committed): `packages/core/src/permissions/__snapshots__/rbac-matrix.json`
- Modify: `mobile/package.json`

**Interfaces:**
- Consumes: `ROLE_HIERARCHY`, `ROLE_METADATA`, `PERMISSION_MATRIX` from `packages/core/dist/permissions/rbac-matrix.js` (compiled output of Task 2's file — requires `tsc` to have run first).
- Produces: the 3 generated files consumed by Task 4 (Rust) and Task 8 (mobile).

- [ ] **Step 1: Write the generator script**

Create `packages/core/scripts/generate-rbac.mjs`:

```js
#!/usr/bin/env node
/**
 * Gera os artefatos RBAC (Rust seed SQL, mobile window global, snapshot) a partir
 * da matriz canônica compilada em dist/permissions/rbac-matrix.js.
 * Pré-requisito: `tsc` já ter rodado (dist/ precisa existir). Chamado automaticamente
 * por `npm run build` neste pacote.
 */
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(coreRoot, '../..');

const { ROLE_HIERARCHY, PERMISSION_MATRIX, ROLE_METADATA } = await import(
  path.join(coreRoot, 'dist/permissions/rbac-matrix.js')
);

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

function buildPerfisInsert() {
  const rows = Object.entries(ROLE_METADATA)
    .map(([perfil, meta]) => `    ('${perfil}','${sqlEscape(meta.nome)}','${sqlEscape(meta.descricaoPerfil)}')`)
    .join(',\n');
  return `INSERT INTO perfis (id, nome, descricao) VALUES\n${rows};`;
}

function buildHierarquiaInsert() {
  const rows = Object.entries(ROLE_HIERARCHY)
    .map(([perfil, nivel]) => `    ('${perfil}',${nivel},'${sqlEscape(ROLE_METADATA[perfil].descricaoNivel)}')`)
    .join(',\n');
  return `INSERT INTO hierarquia_perfis (perfil, nivel, descricao) VALUES\n${rows};`;
}

function buildPermissoesInserts() {
  return Object.entries(PERMISSION_MATRIX)
    .map(([permissao, entry]) => {
      const rows = entry.roles.map((role) => `('${role}','${permissao}')`).join(',');
      return `INSERT INTO permissoes (perfil, permissao) VALUES ${rows};`;
    })
    .join('\n');
}

const sql = [
  '-- AUTO-GERADO por packages/core/scripts/generate-rbac.mjs — não editar manualmente.',
  '-- Fonte: packages/core/src/permissions/rbac-matrix.ts',
  '',
  buildPerfisInsert(),
  '',
  buildHierarquiaInsert(),
  '',
  buildPermissoesInserts(),
  '',
].join('\n');

const rustSeedPath = path.join(monorepoRoot, 'desktop/src-tauri/src/commands/rbac_seed.sql');
writeFileSync(rustSeedPath, sql, 'utf-8');
console.log(`[generate-rbac] escrito ${rustSeedPath}`);

const mobileJs = `// AUTO-GERADO por packages/core/scripts/generate-rbac.mjs — não editar manualmente.
(function () {
  window.ECOFORMS_RBAC = {
    ROLE_HIERARCHY: ${JSON.stringify(ROLE_HIERARCHY, null, 2)},
    PERMISSION_MATRIX: ${JSON.stringify(PERMISSION_MATRIX, null, 2)}
  };
})();
`;
const mobilePath = path.join(monorepoRoot, 'mobile/www/js/rbac-matrix.generated.js');
writeFileSync(mobilePath, mobileJs, 'utf-8');
console.log(`[generate-rbac] escrito ${mobilePath}`);

const snapshotDir = path.join(coreRoot, 'src/permissions/__snapshots__');
mkdirSync(snapshotDir, { recursive: true });
const snapshotPath = path.join(snapshotDir, 'rbac-matrix.json');
writeFileSync(snapshotPath, JSON.stringify({ ROLE_HIERARCHY, PERMISSION_MATRIX }, null, 2) + '\n', 'utf-8');
console.log(`[generate-rbac] escrito ${snapshotPath}`);
```

- [ ] **Step 2: Run the build (tsc + generator) and verify output**

Run: `npm --prefix packages/core run build`
Expected output ends with:
```
[generate-rbac] escrito .../desktop/src-tauri/src/commands/rbac_seed.sql
[generate-rbac] escrito .../mobile/www/js/rbac-matrix.generated.js
[generate-rbac] escrito .../packages/core/src/permissions/__snapshots__/rbac-matrix.json
```

- [ ] **Step 3: Verify generated SQL content**

Run: `grep -c "INSERT INTO permissoes" desktop/src-tauri/src/commands/rbac_seed.sql`
Expected: `36`

Run: `grep "system.sync" desktop/src-tauri/src/commands/rbac_seed.sql`
Expected: exactly one line, containing only `'admin'` and `'gerente'` — e.g. `INSERT INTO permissoes (perfil, permissao) VALUES ('admin','system.sync'),('gerente','system.sync');`

- [ ] **Step 4: Wire mobile's build to regenerate before bundling**

Edit `mobile/package.json` — change the `build` script from:

```json
"build": "npm run build-core && npm run build-css-prod && npm run concat-css && npm run sync-field-css",
```

to:

```json
"build": "npm --prefix ../packages/core run build && npm run build-core && npm run build-css-prod && npm run concat-css && npm run sync-field-css",
```

This ensures `rbac-matrix.generated.js` is regenerated (and core's `dist/` rebuilt) before mobile's esbuild bundling step runs, every time `npm run build` (or `debug-mobile`/`build-debug`/`cap-sync`) executes.

- [ ] **Step 5: Commit**

```bash
git add packages/core/scripts/generate-rbac.mjs desktop/src-tauri/src/commands/rbac_seed.sql mobile/www/js/rbac-matrix.generated.js packages/core/src/permissions/__snapshots__/rbac-matrix.json mobile/package.json
git commit -m "feat(core): generate Rust seed SQL and mobile RBAC mirror from canonical matrix"
```

---

## Task 4: Rust consumes generated seed

**Files:**
- Modify: `desktop/src-tauri/src/commands/setup.rs:393-471`

**Interfaces:**
- Consumes: `desktop/src-tauri/src/commands/rbac_seed.sql` (produced by Task 3, via `include_str!`).
- Produces: `seed_rbac_tables(conn: &Connection) -> Result<(), String>` — same signature as before, no callers need to change.

- [ ] **Step 1: Write the failing tests**

Add to the `#[cfg(test)] mod tests` block in `desktop/src-tauri/src/commands/setup.rs` (after the existing `bootstrap_import_seed_users_is_idempotent_for_same_seed` test, before the closing `}` of the `mod tests` block):

```rust
    #[test]
    fn seed_rbac_tables_restricts_system_sync_to_admin_and_gerente() {
        let app = make_app(SessionState::new());
        let db_state = app.state::<DbState>();
        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        seed_rbac_tables(conn).unwrap();

        let mut stmt = conn
            .prepare("SELECT perfil FROM permissoes WHERE permissao = 'system.sync' ORDER BY perfil")
            .unwrap();
        let roles: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(Result::ok)
            .collect();

        assert_eq!(roles, vec!["admin".to_string(), "gerente".to_string()]);
    }

    #[test]
    fn seed_rbac_tables_sets_campo_and_operador_to_same_level() {
        let app = make_app(SessionState::new());
        let db_state = app.state::<DbState>();
        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        seed_rbac_tables(conn).unwrap();

        let campo_level: i64 = conn
            .query_row("SELECT nivel FROM hierarquia_perfis WHERE perfil = 'campo'", [], |row| row.get(0))
            .unwrap();
        let operador_level: i64 = conn
            .query_row("SELECT nivel FROM hierarquia_perfis WHERE perfil = 'operador'", [], |row| row.get(0))
            .unwrap();

        assert_eq!(campo_level, operador_level);
        assert_eq!(campo_level, 4);
    }

    #[test]
    fn seed_rbac_tables_seeds_36_permission_kinds_across_6_perfis() {
        let app = make_app(SessionState::new());
        let db_state = app.state::<DbState>();
        let conn_guard = db_state.conn.lock().unwrap();
        let conn = conn_guard.as_ref().unwrap();
        seed_rbac_tables(conn).unwrap();

        let perfis_count: i64 = conn.query_row("SELECT COUNT(*) FROM perfis", [], |row| row.get(0)).unwrap();
        let distinct_permissoes: i64 = conn
            .query_row("SELECT COUNT(DISTINCT permissao) FROM permissoes", [], |row| row.get(0))
            .unwrap();

        assert_eq!(perfis_count, 6);
        assert_eq!(distinct_permissoes, 36);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd desktop/src-tauri && cargo test seed_rbac_tables`
Expected: `seed_rbac_tables_restricts_system_sync_to_admin_and_gerente` FAILS (current hardcoded seed at `setup.rs:444` grants `system.sync` to all 6 roles, not just `admin`/`gerente`). The other two pass already (current code already sets campo=operador=4 and seeds 36 distinct permission strings across 6 perfis) — that's expected; they exist as regression guards, not new red steps.

- [ ] **Step 3: Replace hardcoded INSERTs with include_str!**

In `desktop/src-tauri/src/commands/setup.rs`, replace lines 402-468 (everything from the first `conn.execute("INSERT INTO perfis...` through the closing `for batch in &perms_batches { ... }` loop) with:

```rust
    const RBAC_SEED_SQL: &str = include_str!("rbac_seed.sql");
    conn.execute_batch(RBAC_SEED_SQL)
        .map_err(|e| format!("Erro ao seed RBAC: {}", e))?;
```

The function should now read (lines 392-end):

```rust
/// Popula perfis, hierarquia_perfis e permissoes se estiverem vazias.
pub fn seed_rbac_tables(conn: &Connection) -> Result<(), String> {
    let perfis_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM perfis", [], |row| row.get(0))
        .unwrap_or(0);

    if perfis_count > 0 {
        return Ok(());
    }

    const RBAC_SEED_SQL: &str = include_str!("rbac_seed.sql");
    conn.execute_batch(RBAC_SEED_SQL)
        .map_err(|e| format!("Erro ao seed RBAC: {}", e))?;

    Ok(())
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd desktop/src-tauri && cargo test seed_rbac_tables`
Expected: PASS — all 3 new tests green.

Run: `cd desktop/src-tauri && cargo test`
Expected: all existing tests in `setup.rs` (password validation, bootstrap tests) still PASS — unaffected by this change.

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/src/commands/setup.rs
git commit -m "fix(desktop): seed RBAC tables from generated SQL, restrict system.sync to admin/gerente"
```

---

## Task 5: Desktop AccessPolicy.ts imports canonical hierarchy

**Files:**
- Modify: `desktop/src/domain/access/AccessPolicy.ts:8-15`

**Interfaces:**
- Consumes: `ROLE_HIERARCHY` from `ecoforms-core/permissions` (Task 2).
- Produces: no change to `AccessPolicy.ts`'s public functions (`isKnownPerfil`, `roleLevel`, `isAdmin`, `isManagerOrAbove`, `getAccessiblePerfis`, `getSubordinatePerfis`, `canAccessUserData`, `canAssignProfile`) — same signatures, same behavior, values now sourced from the core package instead of a local duplicate.

- [ ] **Step 1: Write the failing test**

Create `desktop/src/domain/access/__tests__/AccessPolicy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY } from 'ecoforms-core/permissions';
import { roleLevel, getSubordinatePerfis } from '../AccessPolicy';

describe('AccessPolicy — usa a hierarquia canônica do core', () => {
  it('roleLevel delega para ROLE_HIERARCHY do core', () => {
    expect(roleLevel('campo')).toBe(ROLE_HIERARCHY.campo);
    expect(roleLevel('operador')).toBe(ROLE_HIERARCHY.operador);
    expect(roleLevel('campo')).toBe(roleLevel('operador'));
  });

  it('getSubordinatePerfis(coordenador) inclui encarregado, operador e campo', () => {
    const subs = getSubordinatePerfis('coordenador').sort();
    expect(subs).toEqual(['campo', 'encarregado', 'operador'].sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix desktop run test -- AccessPolicy`
Expected: test file is found and currently PASSES already (since local `ROLE_HIERARCHY` already has identical values) — this is expected; it's a regression guard for Step 3's refactor, not a red step. Confirm it passes now with the OLD local constant, so we know it'll keep passing after the import swap.

- [ ] **Step 3: Replace local ROLE_HIERARCHY with core import**

Edit `desktop/src/domain/access/AccessPolicy.ts`:

```ts
/**
 * Regras puras de controle de acesso (hierarquia de perfis).
 * Tradução para SQL/filtros fica nos repositórios de infraestrutura.
 */
import { ROLE_HIERARCHY as CORE_ROLE_HIERARCHY, type UserRole } from 'ecoforms-core/permissions';

export type Perfil = UserRole;

const ROLE_HIERARCHY: Record<Perfil, number> = CORE_ROLE_HIERARCHY;

export function isKnownPerfil(perfil: string): perfil is Perfil {
    return perfil in ROLE_HIERARCHY;
}

export function roleLevel(perfil: string): number | undefined {
    return isKnownPerfil(perfil) ? ROLE_HIERARCHY[perfil] : undefined;
}

export function isAdmin(perfil: string): boolean {
    return perfil === 'admin';
}

export function isManagerOrAbove(perfil: string): boolean {
    const level = roleLevel(perfil);
    return level !== undefined && level <= ROLE_HIERARCHY.gerente;
}

/**
 * Perfis acessíveis para um usuário de dado perfil (ele mesmo + subordinados).
 */
export function getAccessiblePerfis(userPerfil: string): string[] {
    const userLevel = roleLevel(userPerfil);
    if (userLevel === undefined) return [userPerfil];
    return (Object.entries(ROLE_HIERARCHY) as [Perfil, number][])
        .filter(([, level]) => level >= userLevel)
        .map(([perfil]) => perfil);
}

export function getSubordinatePerfis(userPerfil: string): string[] {
    const userLevel = roleLevel(userPerfil);
    if (userLevel === undefined) return [];
    return (Object.entries(ROLE_HIERARCHY) as [Perfil, number][])
        .filter(([, level]) => level > userLevel)
        .map(([perfil]) => perfil);
}

export function canAccessUserData(currentPerfil: string, targetPerfil: string): boolean {
    const currentLevel = roleLevel(currentPerfil);
    const targetLevel = roleLevel(targetPerfil);
    if (currentLevel === undefined || targetLevel === undefined) return false;
    return targetLevel >= currentLevel;
}

export function canAssignProfile(actorPerfil: string, targetPerfil: string): boolean {
    const actorLevel = roleLevel(actorPerfil);
    const targetLevel = roleLevel(targetPerfil);
    if (actorLevel === undefined || targetLevel === undefined) return false;
    if (actorLevel === 0) return true;
    return targetLevel > actorLevel;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix desktop run test -- AccessPolicy`
Expected: PASS — both tests green, now backed by the core import.

Run: `npm --prefix desktop run test`
Expected: full desktop suite still green (no other file imports the old local `ROLE_HIERARCHY` — it was module-private, not exported).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/domain/access/AccessPolicy.ts desktop/src/domain/access/__tests__/AccessPolicy.test.ts
git commit -m "refactor(desktop): AccessPolicy imports ROLE_HIERARCHY from ecoforms-core/permissions"
```

---

## Task 6: Desktop time-window consolidation (data.edit_own)

**Files:**
- Modify: `desktop/src/application/permissions/PermissionActionAdapter.ts:69`
- Modify: `desktop/src/interface/hooks/utils/usePermissions.ts:155-169`

**Interfaces:**
- Consumes: `DATA_EDIT_OWN_TIME_WINDOWS` from `ecoforms-core/permissions` (Task 2).
- Produces: `canEditData` keeps its exact existing signature and behavior (verified by Step 1's test using the CURRENT hardcoded logic as the behavior spec).

- [ ] **Step 1: Write the failing test (pins current behavior before refactor)**

Create `desktop/src/interface/hooks/utils/__tests__/canEditData.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { usePermissions } from '../usePermissions';

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

describe('usePermissions().canEditData — janelas de tempo por perfil', () => {
  it('coordenador pode editar registro próprio com até 48h', () => {
    const user = { id: 'u1', perfil: 'coordenador' } as any;
    const { canEditData } = usePermissions(user);
    expect(canEditData({ criado_em: hoursAgoIso(47), user_id: 'u1' })).toBe(true);
    expect(canEditData({ criado_em: hoursAgoIso(49), user_id: 'u1' })).toBe(false);
  });

  it('operador e campo podem editar registro próprio com até 24h', () => {
    const operador = { id: 'u2', perfil: 'operador' } as any;
    const campo = { id: 'u3', perfil: 'campo' } as any;
    expect(usePermissions(operador).canEditData({ criado_em: hoursAgoIso(23), user_id: 'u2' })).toBe(true);
    expect(usePermissions(operador).canEditData({ criado_em: hoursAgoIso(25), user_id: 'u2' })).toBe(false);
    expect(usePermissions(campo).canEditData({ criado_em: hoursAgoIso(23), user_id: 'u3' })).toBe(true);
    expect(usePermissions(campo).canEditData({ criado_em: hoursAgoIso(25), user_id: 'u3' })).toBe(false);
  });

  it('encarregado não pode editar via canEditData (sem janela definida — comportamento atual preservado)', () => {
    const user = { id: 'u4', perfil: 'encarregado' } as any;
    const { canEditData } = usePermissions(user);
    expect(canEditData({ criado_em: hoursAgoIso(1), user_id: 'u4' })).toBe(false);
  });

  it('admin e gerente editam sem restrição de tempo', () => {
    const admin = { id: 'u5', perfil: 'admin' } as any;
    expect(usePermissions(admin).canEditData({ criado_em: hoursAgoIso(1000), user_id: 'outro' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it currently passes (behavior baseline)**

Run: `npm --prefix desktop run test -- canEditData`
Expected: PASS — all 4 tests green against the *current* hardcoded implementation. This confirms the test correctly specifies today's behavior before we refactor its internals.

- [ ] **Step 3: Refactor canEditData to consume DATA_EDIT_OWN_TIME_WINDOWS**

Edit `desktop/src/interface/hooks/utils/usePermissions.ts` — add the import (top of file, alongside existing imports):

```ts
import { User } from "@/types";
import { initializePermissionRegistry, globalPermissionRegistry, type UserRole } from "@/src/application/permissions/PermissionActionAdapter";
import { DATA_EDIT_OWN_TIME_WINDOWS } from "ecoforms-core/permissions";
```

Replace the `canEditData` function body (lines 155-169):

```ts
    const canEditData = (dataRecord: { criado_em?: string; created_at?: string; user_id?: string }): boolean => {
        if (!user || !userRole) return false;
        if (isAdmin() || isManager()) return true;
        const timestamp = dataRecord.criado_em || dataRecord.created_at;
        if (!timestamp) return false;
        const window = DATA_EDIT_OWN_TIME_WINDOWS[userRole];
        if (window === undefined) return false;
        const createdAt = new Date(timestamp);
        const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        return hoursAgo <= window && dataRecord.user_id === user.id;
    };
```

- [ ] **Step 4: Remove the dead timeWindow on the registry's data.edit_own config**

Edit `desktop/src/application/permissions/PermissionActionAdapter.ts` line 69 — remove `, timeWindow: 24` (it was never evaluated: `canExecute`'s `if (config.timeWindow && ctx.createdAt)` check is always skipped because the only call site, `usePermissions.ts:131`, never passes `ctx.createdAt`):

```ts
  { action: 'EDITAR' as UniversalAction, entity: 'data', requiredRoles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] as UserRole[], scope: 'own' as const },
```

- [ ] **Step 5: Run test to verify it still passes**

Run: `npm --prefix desktop run test -- canEditData`
Expected: PASS — same 4 tests green, now backed by `DATA_EDIT_OWN_TIME_WINDOWS`.

Run: `npm --prefix desktop run test`
Expected: full desktop suite green, including `usePermissionsReassign.test.ts` (untouched — `tasks.reassign` config wasn't modified) and `AccessPolicy.test.ts` from Task 5.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/interface/hooks/utils/usePermissions.ts desktop/src/application/permissions/PermissionActionAdapter.ts desktop/src/interface/hooks/utils/__tests__/canEditData.test.ts
git commit -m "refactor(desktop): consolidate data.edit_own time windows into ecoforms-core, drop dead registry timeWindow"
```

---

## Task 7: Mobile — delete dead RBAC files

**Files:**
- Delete: `mobile/www/js/rbac.js`
- Delete: `mobile/www/js/auth-manager-v2.js`
- Delete: `mobile/www/js/core/PermissionManager.js`
- Delete: `mobile/tests/auth-encarregado.test.js` *(skip — confirmed this file does not exist anywhere in the repo; nothing to delete)*

**Interfaces:**
- Consumes: nothing (these files are unreferenced).
- Produces: nothing — pure deletion, verified safe by grep before and after.

- [ ] **Step 1: Confirm zero references (safety check before deleting)**

Run: `grep -rn "rbac\.js\|auth-manager-v2\|PermissionManager" mobile/www --include=*.html --include=*.js | grep -v "mobile/www/js/rbac.js:\|mobile/www/js/auth-manager-v2.js:\|mobile/www/js/core/PermissionManager.js:"`
Expected: no output (no external references to any of the 3 files).

- [ ] **Step 2: Delete the files**

```bash
git rm mobile/www/js/rbac.js mobile/www/js/auth-manager-v2.js mobile/www/js/core/PermissionManager.js
```

- [ ] **Step 3: Run the full mobile test suite to confirm no regression**

Run: `npm --prefix mobile test`
Expected: same test count as before (13 test files, 94 tests) minus any tests inside the deleted files themselves — confirmed via Explore that no test file imports `rbac.js`, `auth-manager-v2.js`, or `PermissionManager.js`, so the count should be unchanged at 13 files / 94 tests, all passing.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(mobile): delete dead RBAC files (rbac.js, auth-manager-v2.js, PermissionManager.js — confirmed unreferenced)"
```

---

## Task 8: Mobile auth-manager.js consolidation

**Files:**
- Modify: `mobile/www/js/auth-manager.js` (lines 692, 742-747, 792-809, 815-852)
- Modify: `mobile/www/index.html`, `mobile/www/user-management.html`, `mobile/www/sector-management.html`, `mobile/www/login.html`, `mobile/www/diagnose-users.html`
- Modify: `mobile/tests/auth-manager.test.js` (add coordenador/campo coverage)

**Interfaces:**
- Consumes: `window.ECOFORMS_RBAC.ROLE_HIERARCHY`, `window.ECOFORMS_RBAC.PERMISSION_MATRIX` (from Task 3's generated `rbac-matrix.generated.js`, loaded via `<script>` before `auth-manager.js`).
- Produces: `AuthManager.ROLE_HIERARCHY` now covers all 6 roles (was 4); `getPermissionRoles(permission)` now covers all 36 permission keys (was 17) with zero ghosts.

- [ ] **Step 1: Write the failing tests**

Add to `mobile/tests/auth-manager.test.js`, inside the `describe('AuthManager — perfis e permissões', ...)` block, after the existing `canEditUser()` tests:

```js
    it('ROLE_HIERARCHY cobre os 6 perfis canônicos com campo === operador', () => {
        expect(Object.keys(window.AuthManager.ROLE_HIERARCHY).sort()).toEqual(
            ['admin', 'campo', 'coordenador', 'encarregado', 'gerente', 'operador'].sort()
        );
        expect(window.AuthManager.ROLE_HIERARCHY.campo).toBe(window.AuthManager.ROLE_HIERARCHY.operador);
    });

    it('hasPermission() nunca retorna true para roles ghost', () => {
        auth.currentUser = makeUser({ perfil: 'superadmin' });
        expect(auth.hasPermission('users.create')).toBe(false);
        expect(auth.hasPermission('system.sync')).toBe(false);
    });

    it('hasPermission() — coordenador e campo têm data.edit_own (gap corrigido)', () => {
        auth.currentUser = makeUser({ perfil: 'coordenador' });
        expect(auth.hasPermission('data.edit_own')).toBe(true);
        auth.currentUser = makeUser({ perfil: 'campo' });
        expect(auth.hasPermission('data.edit_own')).toBe(true);
    });
```

Also update the existing script-loading preamble at the top of the file (lines 1-17) to load the generated matrix before `auth-manager.js`, since `auth-manager.js` will now reference `window.ECOFORMS_RBAC`:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the generated RBAC matrix into global scope first (auth-manager.js depends on it)
const rbacMatrixPath = path.resolve(__dirname, '../www/js/rbac-matrix.generated.js');
if (fs.existsSync(rbacMatrixPath)) {
    eval(fs.readFileSync(rbacMatrixPath, 'utf-8'));
}

// Load AuthManager into global scope via eval
const authManagerPath = path.resolve(__dirname, '../www/js/auth-manager.js');
if (fs.existsSync(authManagerPath)) {
    const src = fs.readFileSync(authManagerPath, 'utf-8');
    // Patch window.syncAdapter to avoid reference errors during load
    if (typeof window !== 'undefined' && !window.syncAdapter) {
        window.syncAdapter = { stop: async () => {}, start: async () => {} };
    }
    eval(src);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix mobile test -- auth-manager.test.js`
Expected: FAIL — `ROLE_HIERARCHY cobre os 6 perfis canônicos` fails (current `ROLE_HIERARCHY` only has 4 keys); `hasPermission() nunca retorna true para roles ghost` fails (`'superadmin'` currently grants `users.create`/`system.sync`); `coordenador e campo têm data.edit_own` fails (both absent from current `getPermissionRoles` map).

- [ ] **Step 3: Fix ROLE_HIERARCHY (L742-747)**

Replace in `mobile/www/js/auth-manager.js`:

```js
    /**
     * Mapa de hierarquia de perfis (níveis)
     * Menor = mais permissivo
     * Fonte: window.ECOFORMS_RBAC.ROLE_HIERARCHY (gerado de packages/core), com
     * fallback inline idêntico caso o script não tenha carregado.
     */
    static ROLE_HIERARCHY = (typeof window !== 'undefined' && window.ECOFORMS_RBAC?.ROLE_HIERARCHY) || {
        'admin': 0,
        'gerente': 1,
        'coordenador': 2,
        'encarregado': 3,
        'operador': 4,
        'campo': 4
    };
```

- [ ] **Step 4: Fix fullAccessRoles (L692)**

```js
        // Admin e Gerente têm acesso a tudo
        const fullAccessRoles = ['admin', 'gerente'];
```

- [ ] **Step 5: Fix getPermissionRoles (L815-852)**

Replace the whole method body:

```js
    /**
     * Mapa de permissões por perfil — lido de window.ECOFORMS_RBAC.PERMISSION_MATRIX
     * (gerado de packages/core), com fallback vazio caso o script não tenha carregado.
     */
    getPermissionRoles(permission) {
        const matrix = (typeof window !== 'undefined' && window.ECOFORMS_RBAC?.PERMISSION_MATRIX) || {};
        return matrix[permission]?.roles || [];
    }
```

- [ ] **Step 6: Parameterize buildAccessFilterSQL (L792-809, bonus fix)**

```js
    /**
     * Gera cláusula SQL para filtrar registros por acesso.
     * Retorna a cláusula e os parâmetros separadamente — o chamador deve
     * usar bind parameters, nunca interpolar os valores retornados direto na query.
     * @param {string} aliasTabela - Alias da tabela no SQL (ex: 's' para suite)
     * @param {string} aliasUsuario - Alias da tabela de usuários (ex: 'u')
     * @returns {{ clause: string, params: string[] }}
     */
    buildAccessFilterSQL(aliasTabela = 's', aliasUsuario = 'u') {
        if (!this.currentUser?.id || !this.currentUser?.perfil) {
            return { clause: '1=0', params: [] };
        }

        if (this.isAdmin()) {
            return { clause: '1=1', params: [] };
        }

        const accessiblePerfis = this.getSubordinatePerfis();
        const placeholders = accessiblePerfis.map(() => '?').join(', ');

        return {
            clause: `(${aliasTabela}.user_id = ? OR ${aliasUsuario}.perfil IN (${placeholders}))`,
            params: [this.currentUser.id, ...accessiblePerfis],
        };
    }
```

Note: this changes the method's return type from `string` to `{ clause, params }`. Search callers before merging:

Run: `grep -rn "buildAccessFilterSQL" mobile/www mobile/tests`

If any call site exists, update it to destructure `{ clause, params }` and pass `params` as bind parameters to its SQL execution call instead of interpolating `clause` alone. If no call sites exist outside the method's own definition, this is dead code being hardened defensively — leave the call-site update as a follow-up note in the commit message.

- [ ] **Step 7: Add script tag to the 5 HTML files**

In each of `mobile/www/index.html`, `mobile/www/user-management.html`, `mobile/www/sector-management.html`, `mobile/www/login.html`, `mobile/www/diagnose-users.html`, find the line loading `auth-manager.js` (e.g. `login.html:403`: `<script src="js/auth-manager.js"></script>`) and add the matrix script immediately before it:

```html
    <script src="js/rbac-matrix.generated.js"></script>
    <script src="js/auth-manager.js"></script>
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm --prefix mobile test -- auth-manager.test.js`
Expected: PASS — all tests green, including the 3 new ones and the pre-existing `tasks.reassign`/`canEditUser` tests (unaffected, since `tasks.reassign` roles `[admin, gerente, encarregado]` are unchanged in the canonical matrix).

Run: `npm --prefix mobile test`
Expected: full mobile suite green (94+ tests, no regressions).

- [ ] **Step 9: Commit**

```bash
git add mobile/www/js/auth-manager.js mobile/www/index.html mobile/www/user-management.html mobile/www/sector-management.html mobile/www/login.html mobile/www/diagnose-users.html mobile/tests/auth-manager.test.js
git commit -m "fix(mobile): auth-manager.js reads RBAC from generated canonical matrix, removes ghost roles, fixes campo/coordenador gaps"
```

---

## Task 9: Mobile ActivityService.js ghost removal

**Files:**
- Modify: `mobile/www/js/services/ActivityService.js:100,112-113`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change to `hasFormPermission`/`getTaskVisibilityDiagnostics`.

- [ ] **Step 1: Write the failing test**

Find or create `mobile/tests/activity-service.test.js`. If it doesn't already exist, create it:

```js
import { describe, it, expect } from 'vitest';
import { ActivityService } from '../www/js/services/ActivityService.js';

describe('ActivityService — sem ghost roles', () => {
    it('hasFormPermission concede acesso total apenas a admin/gerente', () => {
        const service = new ActivityService();
        expect(service.hasFormPermission({ perfil: 'superadmin' }, 'form-1')).toBe(false);
        expect(service.hasFormPermission({ perfil: 'manager' }, 'form-1')).toBe(false);
        expect(service.hasFormPermission({ perfil: 'admin' }, 'form-1')).toBe(true);
        expect(service.hasFormPermission({ perfil: 'gerente' }, 'form-1')).toBe(true);
    });

    it('getTaskVisibilityDiagnostics não reconhece superadmin/manager como admin/gerente', () => {
        const service = new ActivityService();
        const task = { status: 'a_fazer', atribuido_para: 'other', form_registry_id: null, arquivado: false, setor_id: null };
        const diag = service.getTaskVisibilityDiagnostics(task, { id: 'u1', perfil: 'superadmin', setores: [] });
        expect(diag.reasons).toContain('acesso (perfil sem visibilidade)');
    });
});
```

If an existing test file for `ActivityService` already covers similar ground, add these two cases to it instead of creating a duplicate file — check with `grep -rln "ActivityService" mobile/tests` first and reuse that file's existing import/setup pattern (constructor signature may differ from the sketch above; match whatever the existing file already does to instantiate the service).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix mobile test -- ActivityService` (or the matched existing filename)
Expected: FAIL on the first assertion — `hasFormPermission({ perfil: 'superadmin' }, ...)` currently returns `true`.

- [ ] **Step 3: Fix the ghosts**

Edit `mobile/www/js/services/ActivityService.js`:

Line 100:
```js
        const fullAccessRoles = ['admin', 'gerente'];
```

Lines 112-113:
```js
        const isAdmin = user.perfil === 'admin';
        const isManager = user.perfil === 'gerente';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix mobile test -- ActivityService`
Expected: PASS.

Run: `npm --prefix mobile test`
Expected: full mobile suite green.

- [ ] **Step 5: Commit**

```bash
git add mobile/www/js/services/ActivityService.js mobile/tests/activity-service.test.js
git commit -m "fix(mobile): remove superadmin/manager ghost roles from ActivityService"
```

---

## Task 10: Cross-runtime consistency test (anti-drift)

**Files:**
- Create: `mobile/tests/rbac-consistency.test.js`

**Interfaces:**
- Consumes: `mobile/www/js/rbac-matrix.generated.js` (Task 3) and `packages/core/src/permissions/__snapshots__/rbac-matrix.json` (Task 3).
- Produces: a standing regression test that fails if the generated mobile mirror ever drifts from the core snapshot (e.g., someone hand-edits the generated file, or forgets to re-run `gen:rbac` after changing the matrix).

- [ ] **Step 1: Write the test**

```js
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('RBAC cross-runtime consistency', () => {
    it('window.ECOFORMS_RBAC (gerado) bate exatamente com o snapshot canônico do core', () => {
        const snapshotPath = path.resolve(__dirname, '../../packages/core/src/permissions/__snapshots__/rbac-matrix.json');
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

        const generatedPath = path.resolve(__dirname, '../www/js/rbac-matrix.generated.js');
        const sandbox = {};
        const fn = new Function('window', fs.readFileSync(generatedPath, 'utf-8') + '\nreturn window;');
        const window = fn(sandbox);

        expect(window.ECOFORMS_RBAC.ROLE_HIERARCHY).toEqual(snapshot.ROLE_HIERARCHY);
        expect(window.ECOFORMS_RBAC.PERMISSION_MATRIX).toEqual(snapshot.PERMISSION_MATRIX);
    });

    it('nenhuma role em PERMISSION_MATRIX é um ghost', () => {
        const snapshotPath = path.resolve(__dirname, '../../packages/core/src/permissions/__snapshots__/rbac-matrix.json');
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
        const GHOST_ROLES = ['superadmin', 'manager', 'user', 'guest'];

        for (const entry of Object.values(snapshot.PERMISSION_MATRIX)) {
            for (const role of entry.roles) {
                expect(GHOST_ROLES).not.toContain(role);
            }
        }
    });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm --prefix mobile test -- rbac-consistency`
Expected: PASS — both tests green (Task 3's generator already produced consistent output; this test just guards against future drift).

- [ ] **Step 3: Verify the test actually catches drift (sanity check, not committed)**

Temporarily edit `mobile/www/js/rbac-matrix.generated.js` to add a bogus role (e.g. change one `roles` array to include `'superadmin'`), run the test again, confirm it FAILS, then revert the temporary edit (`git checkout -- mobile/www/js/rbac-matrix.generated.js`).

- [ ] **Step 4: Commit**

```bash
git add mobile/tests/rbac-consistency.test.js
git commit -m "test(mobile): add cross-runtime RBAC consistency guard against drift"
```

---

## Self-Review Notes

**Spec coverage:**
- #6 (hierarquia campo) — Task 2 (canonical `campo=operador=4`), Task 4 (Rust test), Task 5 (`AccessPolicy.ts` import), Task 8 (`auth-manager.js` `ROLE_HIERARCHY` now has all 6 roles, was missing 2). Covered.
- #7 (fonte única + codegen) — Tasks 1-3 (matrix + generator), Task 4 (Rust consumes generated SQL), Task 8 (mobile consumes generated JS). Covered.
- #8 (ghosts) — Task 8 (`auth-manager.js` `fullAccessRoles`, `getPermissionRoles`), Task 9 (`ActivityService.js`), Task 7 (delete `rbac.js`, `auth-manager-v2.js`, `PermissionManager.js` — the worst ghost offenders, entirely dead code). Covered.
- Anti-drift tests (original Fase 5) — Task 2 (core), Task 4 (Rust), Task 10 (mobile). Covered.
- Bonus `buildAccessFilterSQL` parameterization — Task 8, Step 6. Covered.

**Corrections carried over from the validation pass (not to re-litigate during execution):**
- `campo=operador=4` was already correct in `AccessPolicy.ts` and the old Rust seed — Task 5 and Task 4 are consolidations, not bug fixes, for that specific value.
- The `data.edit_own` "two conflicting time windows" turned out to be one live implementation (`canEditData`) plus one dead, never-evaluated registry config — Task 6 removes the dead config rather than trying to reconcile two live rules.
- `auth-encarregado.test.js` does not exist anywhere in the repo — Task 7 explicitly skips deleting it and does not reference it as existing.
- `PermissionManager.js` is fully dead code (confirmed zero references, including zero test references) — Task 7 deletes it outright rather than "normalizing" its incompatible role vocabulary.
- `system.sync` behavior change (Rust seed going from 6 roles to 2) is safe to ship without a migration plan — app is pre-production, no live users affected.

**Placeholder scan:** No TBD/TODO markers; every step has complete, runnable code or an exact command with expected output.

**Type consistency:** `PermissionEntry.roles: UserRole[]` (Task 2) is consumed identically in the generator (Task 3), in `AccessPolicy.ts` via `ROLE_HIERARCHY` (Task 5), and in mobile via `window.ECOFORMS_RBAC.PERMISSION_MATRIX[permission].roles` (Task 8) — same shape end to end. `DATA_EDIT_OWN_TIME_WINDOWS` type (`Partial<Record<UserRole, number>>`) matches its usage in `usePermissions.ts` (`DATA_EDIT_OWN_TIME_WINDOWS[userRole]` where `userRole: UserRole`).

## Ordem de execução

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 (each task's tests must pass before starting the next — Task 4 depends on Task 3's generated file existing on disk; Task 8 depends on Task 3's generated mobile file).

## Fora de escopo (próxima rodada)

Credenciais no APK (`usuarios.json`), RLS Supabase não versionado, LAN sem RBAC por usuário, `server.js` segredo único.
