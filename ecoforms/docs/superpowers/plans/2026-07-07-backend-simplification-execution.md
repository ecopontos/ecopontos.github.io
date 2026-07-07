# Backend Simplification Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce backend maintenance complexity in `ecoforms` without changing the local-first, SQLite, event-sync and Tauri architecture.

**Architecture:** Start with evidence-producing audits, then execute low-risk refactors behind tests. `packages/core` becomes the canonical sync contract; desktop and mobile keep platform-specific persistence handlers. Root artifacts are inventoried before any removal.

**Tech Stack:** TypeScript, JavaScript, Next.js, Tauri/Rust, SQLite, Vitest, npm workspaces, Markdown docs.

---

## Scope

This is a guardrail plan for the first execution wave. It covers:

- Sync contract evidence and first parity test.
- Tauri command inventory.
- Root artifact inventory.
- Low-risk application boilerplate reduction.
- Bootstrap schema modularization preparation.
- Documentation alignment.

Do not remove files from the repository in this plan unless a task explicitly says so. The first execution wave should produce measurable evidence and safe refactors only.

## File Map

Create:

- `ecoforms/docs/backend/2026-07-07-sync-event-matrix.md`: event parity matrix across core, desktop and mobile.
- `ecoforms/docs/backend/2026-07-07-tauri-command-matrix.md`: Tauri command usage matrix.
- `ecoforms/docs/backend/2026-07-07-root-artifact-inventory.md`: root artifact ownership and entrypoint inventory.
- `ecoforms/desktop/src/infrastructure/sync/__tests__/event-envelope-parity.test.ts`: parity test for sync event declarations.
- `ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md`: running execution log.

Modify:

- `ecoforms/docs/2026-07-07-levantamento-backend-revisado.md`: link to the produced matrices and execution status.
- `ecoforms/docs/2026-07-07-avaliacao-critica-levantamento-backend.md`: link to the produced matrices and execution status.
- `ecoforms/desktop/docs/BACKEND_NAO_EXPOSTO.md`: replace stale Tauri command counts after the command matrix is complete.
- `ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts`: only after the parity test exists and the matrix classifies differences.
- `ecoforms/desktop/src/application/decisions/DecisionUseCases.ts`: candidate for low-risk wrapper removal.
- `ecoforms/desktop/src/application/views/ViewUseCases.ts`: candidate for partial low-risk wrapper removal only.
- `ecoforms/desktop/src/infrastructure/container.ts`: split by domain in a subsequent execution wave while preserving public container shape.
- `ecoforms/desktop/scripts/ensure-columns.ts`: split by schema domain in a subsequent execution wave while preserving behavior.

Validate with:

- `npm run typecheck:desktop`
- `npm run test:desktop`
- `npm run build:desktop`
- `npx vitest run desktop/src/infrastructure/sync/__tests__/event-envelope-parity.test.ts --config desktop/vitest.config.ts`

---

### Task 1: Capture Baseline Metrics

**Files:**
- Create: `ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md`
- Read: `ecoforms/package.json`
- Read: `ecoforms/desktop/package.json`
- Read: `ecoforms/desktop/src-tauri/src/lib.rs`
- Read: `ecoforms/desktop/scripts/ensure-columns.ts`
- Read: `ecoforms/packages/core/src/sync/EventEnvelope.ts`
- Read: `ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts`
- Read: `ecoforms/mobile/www/js/sync/EventEnvelope.js`

- [ ] **Step 1: Create the backend docs directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'ecoforms/docs/backend'
```

Expected: directory exists.

- [ ] **Step 2: Count current Tauri commands**

Run:

```powershell
$content = Get-Content -LiteralPath 'ecoforms/desktop/src-tauri/src/lib.rs'
$inside = $false
$commands = @()
foreach ($line in $content) {
  if ($line -match 'generate_handler!\[') { $inside = $true; continue }
  if ($inside -and $line -match '^\s*\]') { break }
  if ($inside -and $line.Trim().Length -gt 0) {
    $commands += $line.Trim().TrimEnd(',')
  }
}
$commands.Count
```

Expected: prints the current command count. On the last audit it was `63`; if it differs, record the new value.

- [ ] **Step 3: Count schema bootstrap lines**

Run:

```powershell
(Get-Content -LiteralPath 'ecoforms/desktop/scripts/ensure-columns.ts').Count
```

Expected: prints the current line count. On the last audit it was `2453`; if it differs, record the new value.

- [ ] **Step 4: Count sync event declarations**

Run:

```powershell
$desktop = Select-String -LiteralPath 'ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts' -Pattern "'[^']+'" -AllMatches |
  ForEach-Object { $_.Matches.Value.Trim("'") } |
  Where-Object { $_ -like '*.*' } |
  Sort-Object -Unique
$core = Select-String -LiteralPath 'ecoforms/packages/core/src/sync/EventEnvelope.ts' -Pattern "'[^']+'" -AllMatches |
  ForEach-Object { $_.Matches.Value.Trim("'") } |
  Where-Object { $_ -like '*.*' -and $_ -ne '../utils/uuidv7.js' } |
  Sort-Object -Unique
"core=$($core.Count)"
"desktop=$($desktop.Count)"
```

Expected: prints both counts.

- [ ] **Step 5: Write the progress log**

Run this command to create `ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md` with measured values:

```powershell
$content = Get-Content -LiteralPath 'ecoforms/desktop/src-tauri/src/lib.rs'
$inside = $false
$commands = @()
foreach ($line in $content) {
  if ($line -match 'generate_handler!\[') { $inside = $true; continue }
  if ($inside -and $line -match '^\s*\]') { break }
  if ($inside -and $line.Trim().Length -gt 0) {
    $commands += $line.Trim().TrimEnd(',')
  }
}
$ensureLines = (Get-Content -LiteralPath 'ecoforms/desktop/scripts/ensure-columns.ts').Count
$desktop = Select-String -LiteralPath 'ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts' -Pattern "'[^']+'" -AllMatches |
  ForEach-Object { $_.Matches.Value.Trim("'") } |
  Where-Object { $_ -like '*.*' } |
  Sort-Object -Unique
$core = Select-String -LiteralPath 'ecoforms/packages/core/src/sync/EventEnvelope.ts' -Pattern "'[^']+'" -AllMatches |
  ForEach-Object { $_.Matches.Value.Trim("'") } |
  Where-Object { $_ -like '*.*' -and $_ -ne '../utils/uuidv7.js' } |
  Sort-Object -Unique
@"
# Backend Simplification Progress

Date: 2026-07-07

## Baseline

- Tauri commands registered: $($commands.Count)
- ``desktop/scripts/ensure-columns.ts`` lines: $ensureLines
- Core sync event declarations: $($core.Count)
- Desktop sync event declarations: $($desktop.Count)

## Guardrails

- Do not remove root artifacts without inventory.
- Do not remove Tauri commands without command matrix classification.
- Do not migrate sync contracts without an event parity test.
- Preserve local-first, SQLite, event-sync and encrypted transport assumptions.

## Verification Log

- Pending: ``npm run typecheck:desktop``
- Pending: ``npm run test:desktop``
- Pending: ``npm run build:desktop``
"@ | Set-Content -LiteralPath 'ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md' -Encoding UTF8
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md
git commit -m "docs: record backend simplification baseline"
```

Expected: commit created. If the user does not want commits yet, skip this step and leave the file staged status visible.

---

### Task 2: Build Sync Event Matrix

**Files:**
- Create: `ecoforms/docs/backend/2026-07-07-sync-event-matrix.md`
- Read: `ecoforms/packages/core/src/sync/EventEnvelope.ts`
- Read: `ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts`
- Read: `ecoforms/mobile/www/js/sync/EventEnvelope.js`
- Read: `ecoforms/desktop/src/infrastructure/sync/HandlerRegistry.ts`
- Read: `ecoforms/mobile/www/js/sync/HandlerRegistry.js`

- [ ] **Step 1: Generate event differences**

Run:

```powershell
$desktop = Select-String -LiteralPath 'ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts' -Pattern "'[^']+'" -AllMatches |
  ForEach-Object { $_.Matches.Value.Trim("'") } |
  Where-Object { $_ -like '*.*' } |
  Sort-Object -Unique
$core = Select-String -LiteralPath 'ecoforms/packages/core/src/sync/EventEnvelope.ts' -Pattern "'[^']+'" -AllMatches |
  ForEach-Object { $_.Matches.Value.Trim("'") } |
  Where-Object { $_ -like '*.*' -and $_ -ne '../utils/uuidv7.js' } |
  Sort-Object -Unique
"Only desktop:"
Compare-Object $core $desktop | Where-Object SideIndicator -eq '=>' | ForEach-Object InputObject
"Only core:"
Compare-Object $core $desktop | Where-Object SideIndicator -eq '<=' | ForEach-Object InputObject
```

Expected: lists event names that need explicit classification.

- [ ] **Step 2: Check whether mobile envelope is a reexport**

Run:

```powershell
Get-Content -LiteralPath 'ecoforms/mobile/www/js/sync/EventEnvelope.js'
```

Expected: file shows `export { ... } from '/js/ecoforms-core.js';`.

- [ ] **Step 3: Check handler coverage for each divergent event**

Run:

```powershell
$desktop = Select-String -LiteralPath 'ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts' -Pattern "'[^']+'" -AllMatches |
  ForEach-Object { $_.Matches.Value.Trim("'") } |
  Where-Object { $_ -like '*.*' } |
  Sort-Object -Unique
$core = Select-String -LiteralPath 'ecoforms/packages/core/src/sync/EventEnvelope.ts' -Pattern "'[^']+'" -AllMatches |
  ForEach-Object { $_.Matches.Value.Trim("'") } |
  Where-Object { $_ -like '*.*' -and $_ -ne '../utils/uuidv7.js' } |
  Sort-Object -Unique
$divergentEvents = Compare-Object $core $desktop | ForEach-Object InputObject | Sort-Object -Unique
foreach ($eventName in $divergentEvents) {
  "### $eventName"
  rg -n ([regex]::Escape($eventName)) ecoforms/desktop/src/infrastructure/sync/HandlerRegistry.ts ecoforms/mobile/www/js/sync/HandlerRegistry.js ecoforms/desktop/src ecoforms/mobile/www/js
}
```

Expected: each divergent event prints references or no matches. No-match events require a `remove-from-desktop` or `legacy-documented` decision.

- [ ] **Step 4: Create the sync matrix doc**

Create `ecoforms/docs/backend/2026-07-07-sync-event-matrix.md` with:

```markdown
# Sync Event Matrix

Date: 2026-07-07

## Summary

- `mobile/www/js/sync/EventEnvelope.js` is a reexport of `ecoforms-core`.
- The material drift is between `packages/core/src/sync/EventEnvelope.ts` and `desktop/src/infrastructure/sync/EventEnvelope.ts`.
- `HandlerRegistry` remains platform-specific because handlers apply persistence and local side effects.

## Classification Rules

- `canonical`: keep in `packages/core`.
- `add-to-core`: exists in desktop and is still emitted or handled, but missing from core.
- `remove-from-desktop`: exists in desktop but is not emitted, handled or documented.
- `legacy-documented`: exists for compatibility and must stay temporarily.
- `handler-only`: handled by platform code but not a contract source.

## Event Matrix

| Event | Core | Desktop envelope | Desktop handler | Mobile handler | Classification | Decision |
|---|---:|---:|---:|---:|---|---|

## Decisions

- No sync contract migration starts until every divergent event has a classification.
```

Every row must use a real event from Step 1 output; do not add example-only rows.

- [ ] **Step 5: Update progress log**

Append to `ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md`:

```markdown
## Sync Matrix

- Matrix: `docs/backend/2026-07-07-sync-event-matrix.md`
- Status: created
- Blocker: no envelope migration until all divergent events are classified.
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add ecoforms/docs/backend/2026-07-07-sync-event-matrix.md ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md
git commit -m "docs: add sync event matrix"
```

Expected: commit created.

---

### Task 3: Add Sync Event Parity Test

**Files:**
- Create: `ecoforms/desktop/src/infrastructure/sync/__tests__/event-envelope-parity.test.ts`
- Read: `ecoforms/packages/core/src/sync/EventEnvelope.ts`
- Read: `ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts`

- [ ] **Step 1: Write the failing parity test**

Create `ecoforms/desktop/src/infrastructure/sync/__tests__/event-envelope-parity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EcoFormsEventTypes as coreEventTypes } from 'ecoforms-core/sync';
import { EcoFormsEventTypes as desktopEventTypes } from '../EventEnvelope';

describe('sync event contract parity', () => {
    it('keeps desktop event declarations aligned with ecoforms-core', () => {
        const core = [...coreEventTypes].sort();
        const desktop = [...desktopEventTypes].sort();

        expect(desktop).toEqual(core);
    });
});
```

- [ ] **Step 2: Run test to verify current drift**

Run:

```powershell
npx vitest run desktop/src/infrastructure/sync/__tests__/event-envelope-parity.test.ts --config desktop/vitest.config.ts
```

Expected: FAIL while the matrix still has unresolved event differences.

- [ ] **Step 3: Mark the test as gated if immediate migration is not in this task**

If the project cannot accept a failing test on the branch yet, change the test to `it.skip` and add the reason:

```ts
import { describe, expect, it } from 'vitest';
import { EcoFormsEventTypes as coreEventTypes } from 'ecoforms-core/sync';
import { EcoFormsEventTypes as desktopEventTypes } from '../EventEnvelope';

describe('sync event contract parity', () => {
    it.skip('keeps desktop event declarations aligned with ecoforms-core after matrix decisions are applied', () => {
        const core = [...coreEventTypes].sort();
        const desktop = [...desktopEventTypes].sort();

        expect(desktop).toEqual(core);
    });
});
```

Expected: test documents intended parity without breaking the branch before classifications are applied.

- [ ] **Step 4: Commit**

Run:

```powershell
git add ecoforms/desktop/src/infrastructure/sync/__tests__/event-envelope-parity.test.ts
git commit -m "test: document sync event parity target"
```

Expected: commit created.

---

### Task 4: Build Tauri Command Matrix

**Files:**
- Create: `ecoforms/docs/backend/2026-07-07-tauri-command-matrix.md`
- Modify: `ecoforms/desktop/docs/BACKEND_NAO_EXPOSTO.md`
- Read: `ecoforms/desktop/src-tauri/src/lib.rs`
- Search: `ecoforms/desktop/src`

- [ ] **Step 1: Extract registered commands**

Run:

```powershell
$content = Get-Content -LiteralPath 'ecoforms/desktop/src-tauri/src/lib.rs'
$inside = $false
$commands = @()
foreach ($line in $content) {
  if ($line -match 'generate_handler!\[') { $inside = $true; continue }
  if ($inside -and $line -match '^\s*\]') { break }
  if ($inside -and $line.Trim().Length -gt 0) {
    $commands += $line.Trim().TrimEnd(',')
  }
}
$commands | Sort-Object
```

Expected: sorted command list.

- [ ] **Step 2: Search frontend invocations**

Run:

```powershell
$content = Get-Content -LiteralPath 'ecoforms/desktop/src-tauri/src/lib.rs'
$inside = $false
$commands = @()
foreach ($line in $content) {
  if ($line -match 'generate_handler!\[') { $inside = $true; continue }
  if ($inside -and $line -match '^\s*\]') { break }
  if ($inside -and $line.Trim().Length -gt 0) {
    $commands += $line.Trim().TrimEnd(',').Split('::')[-1]
  }
}
foreach ($commandName in ($commands | Sort-Object -Unique)) {
  "### $commandName"
  rg -n "invoke\(['`\"]$commandName['`\"]" ecoforms/desktop/src ecoforms/desktop/app ecoforms/desktop/components
}
```

Expected: each command prints frontend calls or no matches.

- [ ] **Step 3: Search Rust internal usage**

Run:

```powershell
$content = Get-Content -LiteralPath 'ecoforms/desktop/src-tauri/src/lib.rs'
$inside = $false
$commands = @()
foreach ($line in $content) {
  if ($line -match 'generate_handler!\[') { $inside = $true; continue }
  if ($inside -and $line -match '^\s*\]') { break }
  if ($inside -and $line.Trim().Length -gt 0) {
    $commands += $line.Trim().TrimEnd(',').Split('::')[-1]
  }
}
foreach ($functionName in ($commands | Sort-Object -Unique)) {
  "### $functionName"
  rg -n "\b$functionName\b" ecoforms/desktop/src-tauri/src
}
```

Expected: identifies whether each function is only registered or also referenced internally.

- [ ] **Step 4: Create the command matrix doc**

Create `ecoforms/docs/backend/2026-07-07-tauri-command-matrix.md`:

```markdown
# Tauri Command Matrix

Date: 2026-07-07

## Summary

- Registered commands in `generate_handler!`: record the numeric output from Step 1 in this line before committing
- Documentation source to update: `desktop/docs/BACKEND_NAO_EXPOSTO.md`

## Classification Rules

- `frontend-invoked`: found through `invoke('command_name')`.
- `rust-internal`: not invoked by frontend, but used by Rust or required as state/security bridge.
- `reserved-documented`: not currently invoked but intentionally retained.
- `candidate-remove`: no frontend call, no internal usage, no operational justification.

## Matrix

| Command | Frontend invoke | Rust internal use | Classification | Decision |
|---|---:|---:|---|---|
```

Every row must use a real command from Step 1 output; do not add example-only rows.

- [ ] **Step 5: Update stale Tauri counts**

Modify `ecoforms/desktop/docs/BACKEND_NAO_EXPOSTO.md`:

```markdown
> Re-auditoria em 2026-07-07: a contagem anterior de 35 comandos esta obsoleta.
> Ver matriz atual em `docs/backend/2026-07-07-tauri-command-matrix.md`.
```

Replace the obsolete summary that says `35 comandos registrados` with a reference to the matrix and the current count.

- [ ] **Step 6: Commit**

Run:

```powershell
git add ecoforms/docs/backend/2026-07-07-tauri-command-matrix.md ecoforms/desktop/docs/BACKEND_NAO_EXPOSTO.md
git commit -m "docs: update Tauri command inventory"
```

Expected: commit created.

---

### Task 5: Inventory Root Artifacts

**Files:**
- Create: `ecoforms/docs/backend/2026-07-07-root-artifact-inventory.md`
- Read: `ecoforms/package.json`
- Read: `ecoforms/server.js`
- Read: `ecoforms/meu-supabase-mcp/package.json`
- Read: `ecoforms/app/login/page.tsx`
- Read: `ecoforms/default/vitest.config.js`
- Read: files under `ecoforms/src`

- [ ] **Step 1: Confirm workspace boundaries**

Run:

```powershell
Get-Content -LiteralPath 'ecoforms/package.json'
```

Expected: workspaces are `desktop`, `mobile`, and `packages/core`.

- [ ] **Step 2: Search references to root artifacts**

Run:

```powershell
rg -n "server\.js|meu-supabase-mcp|app/login|default/vitest|src/index|supabase-mcp-connector" ecoforms
```

Expected: references are listed, or no output for unused artifacts.

- [ ] **Step 3: Inspect lateral entrypoints**

Run:

```powershell
Get-Content -LiteralPath 'ecoforms/server.js' | Select-Object -First 80
Get-Content -LiteralPath 'ecoforms/meu-supabase-mcp/package.json'
```

Expected: `server.js` is an Express entrypoint and `meu-supabase-mcp` has independent scripts.

- [ ] **Step 4: Create the root artifact inventory**

Create `ecoforms/docs/backend/2026-07-07-root-artifact-inventory.md`:

```markdown
# Root Artifact Inventory

Date: 2026-07-07

## Workspace Boundary

`ecoforms/package.json` declares these workspaces:

- `desktop`
- `mobile`
- `packages/core`

## Classification Rules

- `main-workspace`: part of a declared workspace.
- `lateral-tool`: has its own entrypoint or package metadata.
- `tracked-orphan`: tracked but not referenced by main workspace scripts.
- `candidate-remove`: no script, no import, no operational owner.

## Inventory

| Artifact | Evidence | Classification | Decision |
|---|---|---|---|
| `server.js` | Express entrypoint with API routes. | `lateral-tool` | Keep until owner confirms. |
| `meu-supabase-mcp/` | Own `package.json` and scripts. | `lateral-tool` | Keep until owner confirms. |
| `src/` | Root source outside declared workspaces. | `tracked-orphan` | Audit imports before moving/removing. |
| `app/login/page.tsx` | Root app artifact outside desktop workspace. | `tracked-orphan` | Audit history before moving/removing. |
| `default/vitest.config.js` | Root test config outside declared workspaces. | `tracked-orphan` | Audit usage before moving/removing. |
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add ecoforms/docs/backend/2026-07-07-root-artifact-inventory.md
git commit -m "docs: inventory root backend artifacts"
```

Expected: commit created.

---

### Task 6: Low-Risk Use Case Simplification Plan

**Files:**
- Create: `ecoforms/docs/backend/2026-07-07-usecase-simplification-plan.md`
- Read: `ecoforms/desktop/src/application/decisions/DecisionUseCases.ts`
- Read: `ecoforms/desktop/src/application/views/ViewUseCases.ts`
- Search: consumers in `ecoforms/desktop/src`

- [ ] **Step 1: Find consumers of decision use cases**

Run:

```powershell
rg -n "GetDecisionUseCase|GetDecisionsByTargetTypeUseCase|GetDecisionsByActionUseCase|GetDecisionsForPerfilUseCase|GetActiveDecisionsUseCase" ecoforms/desktop/src
```

Expected: consumer list shows whether wrappers can be inlined safely.

- [ ] **Step 2: Find consumers of trivial view getters**

Run:

```powershell
rg -n "GetViewUseCase|GetActiveViewsUseCase|GetViewsByModuleUseCase|GetViewsByPerfilUseCase" ecoforms/desktop/src
```

Expected: consumer list shows where direct repository calls or a smaller query service could replace wrappers.

- [ ] **Step 3: Document exact simplification candidates**

Create `ecoforms/docs/backend/2026-07-07-usecase-simplification-plan.md`:

```markdown
# Use Case Simplification Plan

Date: 2026-07-07

## Rules

- Remove only wrappers that do not enforce validation, authorization, events or state transitions.
- Preserve use cases that create dashboards, normalize widgets or check permissions.
- Prefer one small PR per domain.

## Candidates

| Use case | Current behavior | Consumer | Decision |
|---|---|---|---|
| `GetDecisionUseCase` | delegates to `repo.findById` | record the literal matching lines from `rg` | inline or replace with query service |
| `GetDecisionsByTargetTypeUseCase` | delegates to `repo.findByTargetType` | record the literal matching lines from `rg` | inline or replace with query service |
| `GetDecisionsByActionUseCase` | delegates to `repo.findByAction` | record the literal matching lines from `rg` | inline or replace with query service |
| `GetDecisionsForPerfilUseCase` | delegates to `repo.findByPerfilAndTargetType` | record the literal matching lines from `rg` | inline or replace with query service |
| `GetActiveDecisionsUseCase` | delegates to `repo.findActive` | record the literal matching lines from `rg` | inline or replace with query service |
| `GetViewUseCase` | delegates to `repo.findById` | record the literal matching lines from `rg` | inline only if no UI contract depends on class |
| `GetActiveViewsUseCase` | delegates to `repo.findActive` | record the literal matching lines from `rg` | inline only if no UI contract depends on class |
| `GetViewsByModuleUseCase` | delegates to `repo.findByModuleType` | record the literal matching lines from `rg` | inline only if no UI contract depends on class |
| `GetViewsByPerfilUseCase` | delegates to `repo.findByPerfil` | record the literal matching lines from `rg` | inline only if no UI contract depends on class |

## Preserve

- `CreateModuleDashboardUseCase`
- use cases that call `assertCanEdit`
- use cases that normalize widgets
- use cases that write state
```

Every consumer evidence cell must contain record the literal matching lines from `rg`.

- [ ] **Step 4: Commit**

Run:

```powershell
git add ecoforms/docs/backend/2026-07-07-usecase-simplification-plan.md
git commit -m "docs: plan low-risk use case simplification"
```

Expected: commit created.

---

### Task 7: Prepare Bootstrap Modularization

**Files:**
- Create: `ecoforms/docs/backend/2026-07-07-schema-bootstrap-split-plan.md`
- Read: `ecoforms/desktop/scripts/ensure-columns.ts`

- [ ] **Step 1: Measure schema responsibilities**

Run:

```powershell
Select-String -LiteralPath 'ecoforms/desktop/scripts/ensure-columns.ts' -Pattern 'CREATE TABLE IF NOT EXISTS|ALTER TABLE|INSERT OR IGNORE|CREATE INDEX|CREATE VIEW|catch\(\(\) => \{\}\)' |
  Select-Object LineNumber,Line
```

Expected: line list showing table creation, migrations, seeds and swallowed errors.

- [ ] **Step 2: Create split plan**

Create `ecoforms/docs/backend/2026-07-07-schema-bootstrap-split-plan.md`:

```markdown
# Schema Bootstrap Split Plan

Date: 2026-07-07

## Rules

- Preserve behavior first.
- Keep one public orchestration function.
- Split by domain, not by SQL statement type alone.
- Replace silent `.catch(() => {})` with explicit expected-error handling.

## Proposed Modules

| Module | Responsibility |
|---|---|
| `desktop/scripts/schema/bootstrap.ts` | public orchestration |
| `desktop/scripts/schema/core-schema.ts` | users, permissions, sectors, config |
| `desktop/scripts/schema/ouvidoria-schema.ts` | manifestacoes, tramitacoes, respostas, prazos |
| `desktop/scripts/schema/logistica-schema.ts` | roteiros, execucao, intercorrencias, residuos |
| `desktop/scripts/schema/tasks-schema.ts` | tarefas, projetos, demandas |
| `desktop/scripts/schema/modules-schema.ts` | registro_modulos, visuals, widgets |
| `desktop/scripts/schema/schema-helpers.ts` | idempotent SQL helpers |

## Helper Contract

```ts
export async function addColumnIfMissing(
    execute: (sql: string) => Promise<unknown>,
    tableName: string,
    columnName: string,
    columnDefinition: string,
): Promise<void> {
    try {
        await execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    } catch (error) {
        const message = String(error);
        if (message.includes('duplicate column name') || message.includes('already exists')) {
            return;
        }
        throw error;
    }
}
```

## First Implementation Slice

Move only one low-risk domain first, then run desktop typecheck and tests.
```

- [ ] **Step 3: Commit**

Run:

```powershell
git add ecoforms/docs/backend/2026-07-07-schema-bootstrap-split-plan.md
git commit -m "docs: plan schema bootstrap modularization"
```

Expected: commit created.

---

### Task 8: Link Execution Artifacts from Existing Docs

**Files:**
- Modify: `ecoforms/docs/2026-07-07-levantamento-backend-revisado.md`
- Modify: `ecoforms/docs/2026-07-07-avaliacao-critica-levantamento-backend.md`

- [ ] **Step 1: Add execution artifact section to revised survey**

Append to `ecoforms/docs/2026-07-07-levantamento-backend-revisado.md`:

```markdown
## Artefatos de execução

- Plano: `docs/superpowers/plans/2026-07-07-backend-simplification-execution.md`
- Progresso: `docs/backend/2026-07-07-backend-simplification-progress.md`
- Matriz de sync: `docs/backend/2026-07-07-sync-event-matrix.md`
- Matriz Tauri: `docs/backend/2026-07-07-tauri-command-matrix.md`
- Inventário da raiz: `docs/backend/2026-07-07-root-artifact-inventory.md`
```

- [ ] **Step 2: Add execution artifact section to critical evaluation**

Append to `ecoforms/docs/2026-07-07-avaliacao-critica-levantamento-backend.md`:

```markdown
## Artefatos de execução

- Plano: `docs/superpowers/plans/2026-07-07-backend-simplification-execution.md`
- Evidências e progresso: `docs/backend/2026-07-07-backend-simplification-progress.md`
- Nenhuma remoção deve ocorrer antes das matrizes de sync, Tauri e raiz.
```

- [ ] **Step 3: Commit**

Run:

```powershell
git add ecoforms/docs/2026-07-07-levantamento-backend-revisado.md ecoforms/docs/2026-07-07-avaliacao-critica-levantamento-backend.md
git commit -m "docs: link backend simplification execution artifacts"
```

Expected: commit created.

---

### Task 9: Run Verification Checkpoint

**Files:**
- Modify: `ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md`

- [ ] **Step 1: Run desktop typecheck**

Run:

```powershell
npm run typecheck:desktop
```

Expected: command exits `0`.

- [ ] **Step 2: Run desktop tests**

Run:

```powershell
npm run test:desktop
```

Expected: command exits `0`, or failures are recorded with exact failing test names.

- [ ] **Step 3: Run desktop build**

Run:

```powershell
npm run build:desktop
```

Expected: command exits `0`.

- [ ] **Step 4: Record verification results**

Append to `ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md`:

```markdown
## Verification Checkpoint

- `npm run typecheck:desktop`: pass/fail, date, notes
- `npm run test:desktop`: pass/fail, date, notes
- `npm run build:desktop`: pass/fail, date, notes

## Next Execution Wave

- Apply sync event matrix decisions.
- Convert parity test from skipped to active after event decisions.
- Start low-risk use case simplification.
- Start one-domain schema bootstrap split.
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add ecoforms/docs/backend/2026-07-07-backend-simplification-progress.md
git commit -m "docs: record backend simplification verification checkpoint"
```

Expected: commit created.

---

## Execution Notes

- If a verification command fails because dependencies are missing, run `npm install` only with user approval.
- If a command needs network access and fails due sandbox restrictions, rerun it with explicit approval.
- If unrelated files are dirty, do not revert them.
- If a root artifact appears unused, do not delete it in this wave. Record evidence and propose a separate removal PR.
- If the sync parity test fails, that is expected until the event matrix decisions are applied.

## Completion Criteria

This plan is complete when:

- Baseline metrics are recorded.
- Sync matrix exists and classifies divergent events.
- Tauri command matrix exists and updates stale docs.
- Root artifact inventory exists.
- Use case simplification candidates are documented.
- Schema bootstrap split plan exists.
- Existing backend survey docs link to the execution artifacts.
- Verification checkpoint is recorded.

