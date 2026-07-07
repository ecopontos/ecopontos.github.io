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

## Verification Log

Working directory: worktree root

### `npm run typecheck:desktop`

- Status: not run yet
- Reason: scheduled for Task 9

### `npm run test:desktop`

- Status: not run yet
- Reason: scheduled for Task 9

### `npm run build:desktop`

- Status: not run yet
- Reason: scheduled for Task 9

## Sync Matrix

- Matrix: `docs/backend/2026-07-07-sync-event-matrix.md`
- Status: created
- Blocker: no envelope migration until legacy-documented and handler-only decisions are resolved, and an event parity test exists.


