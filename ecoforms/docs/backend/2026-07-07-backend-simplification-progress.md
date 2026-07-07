# Backend Simplification Progress

Date: 2026-07-07

## Baseline

- Tauri commands registered: 63 (counted from `generate_handler!` entries in `ecoforms/desktop/src-tauri/src/lib.rs`)
- `desktop/scripts/ensure-columns.ts` lines: 2453 (physical line count from `(Get-Content -LiteralPath 'ecoforms/desktop/scripts/ensure-columns.ts').Count`)
- Core sync event declarations: 53 (unique quoted event-like strings from `ecoforms/packages/core/src/sync/EventEnvelope.ts`, excluding `../utils/uuidv7.js`)
- Desktop sync event declarations: 50 (unique quoted event-like strings from `ecoforms/desktop/src/infrastructure/sync/EventEnvelope.ts`)

## Guardrails

- Do not remove root artifacts without `ecoforms/docs/backend/2026-07-07-root-artifact-inventory.md` covering `src/`, `server.js`, `app/login/page.tsx`, `default/vitest.config.js`, `meu-supabase-mcp/`.
- Do not remove Tauri commands without `ecoforms/docs/backend/2026-07-07-tauri-command-matrix.md` containing command name, frontend invoke evidence, Rust internal-use evidence, classification, keep/remove/reserve decision, migration risk.
- Do not migrate sync contracts without an event parity test.
- Preserve local-first, SQLite, event-sync and encrypted transport assumptions.

## Verification Checkpoint

Working directory: `C:\Users\marceloluiz.comcap\Desktop\github\ecopontos.github.io\.worktrees\backend-simplification-execution\ecoforms`

### Setup

- `npm install`: pass. Installed 1102 packages, audited 1106 packages, 0 vulnerabilities.
- `npm --prefix packages/core run build`: pass. Required before `typecheck:desktop` because the initial typecheck could not resolve `ecoforms-core`.

### `npm run typecheck:desktop`

- Status: pass after `packages/core` build.
- Initial attempt after `npm install`: failed because `ecoforms-core` artifacts were not built and TypeScript could not resolve `ecoforms-core` / `ecoforms-core/sync`.
- Final attempt: pass, exit code 0.

### `npm run test:desktop`

- Status: pass with elevated execution.
- Sandbox attempt: failed before tests with `Error: spawn EPERM` while Vite/esbuild loaded `desktop/vitest.config.ts`.
- Elevated attempt: pass. Result: 57 test files passed, 1 skipped; 377 tests passed, 1 skipped.

### `npm run build:desktop`

- Status: pass.
- Result: Next.js build completed successfully, including `packages/core` prebuild and 85 static pages generated.

## Next Execution Wave

- Resolve `legacy-documented` and `handler-only` sync matrix decisions.
- Convert `event-envelope-parity.test.ts` from skipped to active after sync decisions are applied.
- Start low-risk use case simplification from `docs/backend/2026-07-07-usecase-simplification-plan.md`.
- Start one-domain schema bootstrap split from `docs/backend/2026-07-07-schema-bootstrap-split-plan.md`.

## Sync Matrix

- Matrix: `docs/backend/2026-07-07-sync-event-matrix.md`
- Status: created
- Blocker: no envelope migration until legacy-documented and handler-only decisions are resolved, and an event parity test exists.


