# Schema Bootstrap Split Plan

**Goal:** Prepare a behavior-preserving modularization of `desktop/scripts/ensure-columns.ts` so the schema bootstrap can be maintained by domain without changing runtime behavior in the first slice.

**Scope:** Planning only. No code files are changed by this task.

## Current Responsibility Measurement

Measured in `ecoforms/desktop/scripts/ensure-columns.ts` on 2026-07-07:

| Responsibility marker | Count |
| --- | ---: |
| `CREATE TABLE IF NOT EXISTS` | 94 |
| `ALTER TABLE` | 104 |
| `INSERT OR IGNORE` | 28 |
| `CREATE INDEX` | 127 |
| `CREATE VIEW` | 3 |
| `.catch(() => {})` | 134 |

Representative evidence:

| Line | Evidence |
| ---: | --- |
| 17 | Existing private helper `ensureModuleTables(execute)` already separates part of module bootstrap. |
| 19 | First module table creation starts with `CREATE TABLE IF NOT EXISTS registro_modulos`. |
| 41 | Module indexes are created inline with schema statements. |
| 43 | Additive migration for `registro_modulos.config_version` uses a silent empty catch. |
| 93 | Public orchestration currently lives in `ensureColumns(query, execute)`. |
| 156-159 | `setores` uses multiple additive `ALTER TABLE ... ADD COLUMN` guards with silent catches. |
| 917, 945, 1144 | Views are mixed into the same bootstrap function. |
| 1645-1656 | `configuracoes_sistema` seeds use repeated `INSERT OR IGNORE` statements. |
| 1978-2054 | Module registry, permissions, and visuals are seeded later in the same file. |
| 2448-2450 | Retention cleanup statements also use silent catches near the end of bootstrap. |

The count profile shows this is not just a formatting split. The file combines fresh-install DDL, additive migration guards, seed data, view creation, indexes, table recreation migrations, geospatial virtual tables, and retention cleanup. The split must preserve ordering and error behavior before improving structure.

## Rules

1. Preserve behavior first.
2. Keep one public orchestration function.
3. Split by domain, not by SQL statement type alone.
4. Replace silent `.catch(() => {})` with explicit expected-error handling.

## Proposed Modules

| Module | Responsibility |
| --- | --- |
| `desktop/scripts/schema/bootstrap.ts` | Later compatibility orchestration only. Do not introduce this as a caller-visible replacement in the first slice. If added later, it must sit behind the existing `ensureColumns(query, execute)` export path after tests prove no behavioral or caller impact. |
| `desktop/scripts/schema/core-schema.ts` | Users, permissions, sectors, config. Owns RBAC tables, sectors, users, user-sector mapping, Supabase user mapping, system config, email config, app config, session/access audit, and low-level shared catalog/config bootstrap that is not specific to a feature domain. |
| `desktop/scripts/schema/ouvidoria-schema.ts` | `manifestacoes`, `tramitacoes`, `respostas`, `prazos`. Owns ouvidoria catalogs, manifestations, workflow/tramitation, response delivery, deadlines, notifications tied to manifestations, protocol sequence, normalized inbox view, and CHECK-recreation migrations for ouvidoria tables. |
| `desktop/scripts/schema/logistica-schema.ts` | `roteiros`, `execucao`, `intercorrencias`, `residuos`. Owns residue types, route definitions, route-client links, collection execution, weighing, execution history, execution clients, checklist, incidents, attachments tied to logistics, service scheduling where it depends on route/task execution, terrains, operational points, geospatial layers, and logistics views. |
| `desktop/scripts/schema/tasks-schema.ts` | `tarefas`, `projetos`, `demandas`. Owns project/task/demand tables, task workflow columns, task comments/events/attachments, activities, action/audit logs where they are task/workflow centric, and indexes tied to task/project/demand queries. |
| `desktop/scripts/schema/modules-schema.ts` | `registro_modulos`, visuals, widgets. Owns module registry, module permissions, module visuals, view registry, decision registry, user widget instances, sync module registry seeds, and visual/widget defaults. |
| `desktop/scripts/schema/schema-helpers.ts` | Idempotent SQL helpers. Owns helpers for additive schema changes, expected SQLite error classification, idempotent index/view/table execution wrappers if needed, and shared helper tests. |

## Helper Contract

```ts
addColumnIfMissing(
  execute: ExecuteFn,
  tableName: string,
  columnName: string,
  columnDefinition: string
): Promise<void>
```

Behavior:

1. Execute `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`.
2. Ignore only SQLite duplicate-column diagnostics from `ALTER TABLE ... ADD COLUMN`, for example `duplicate column name`.
3. Do not match or ignore generic `already exists`, table-exists, index-exists, missing-table, syntax, permission, adapter, or unknown errors.
4. Rethrow every other error unchanged.
5. Keep SQL identifier inputs constrained to known call-site constants in the first slice. If runtime identifiers are introduced later, add identifier validation before using this helper outside bootstrap internals.

Expected SQLite duplicate-column indicators must be matched explicitly and narrowly. The classifier should be covered by tests before replacing broad catches.

```ts
function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column name/i.test(message);
}
```

## First Implementation Slice

Move only one low-risk domain first: `desktop/scripts/schema/modules-schema.ts`.

Why this slice:

1. Module bootstrap is already partially isolated in `ensureModuleTables(execute)` near the top of `ensure-columns.ts`.
2. Its statements are mostly self-contained around `registro_modulos`, `permissoes_modulos`, `cursores_sync_lan`, `visuais_modulos`, module permissions, visual defaults, view registry, decisions, and widgets.
3. It exercises table creation, indexes, additive columns, and seed data without moving the largest ouvidoria/logistics/task chains first.
4. It gives a safe place to introduce `schema-helpers.ts` and replace one or two silent duplicate-column catches with explicit expected-error handling before scaling the pattern.

First-slice ordering and public API constraints:

1. Preserve original execution order and phases exactly.
2. Keep `ensureColumns(query, execute)` exported from `desktop/scripts/ensure-columns.ts` at the current import path with no caller changes.
3. Do not replace callers with `bootstrap.ts` in the first slice.
4. If module-domain statements are split, use phase-preserving exports from `modules-schema.ts`:
   - `ensureModuleTables(execute)` called at the original early module table/index location.
   - `seedModuleRegistryAndVisuals(execute)` called at the later module seed/default-visual location.
5. Keep later module-related registry, visual, widget, and permission seed calls at their original later phase instead of pulling them up beside early table creation.

First-slice steps:

1. Add `desktop/scripts/schema/schema-helpers.ts` with `addColumnIfMissing` and a small expected-error classifier.
2. Add focused tests for duplicate-column ignore and non-duplicate rethrow behavior.
3. Add `desktop/scripts/schema/modules-schema.ts` and move only module-domain statements from `ensure-columns.ts`.
4. Keep `ensureColumns(query, execute)` as the single public orchestration function exported from the existing file and import path.
5. Call `ensureModuleTables(execute)` from the original early table/index phase.
6. Call `seedModuleRegistryAndVisuals(execute)` from the original later seed/default-visual phase.
7. Run desktop typecheck.
8. Run desktop tests covering bootstrap/schema behavior.
9. Compare generated schema or smoke-test bootstrap on a fresh database and an existing database fixture if available.

Do not continue into ouvidoria, logistics, tasks, or core in the first PR unless the module slice passes cleanly and produces no schema diff beyond ordering-neutral effects.

## Behavior Preservation Risks

| Risk | Mitigation |
| --- | --- |
| Hidden dependencies on statement order | Move one domain at a time and keep orchestration order identical inside the existing `ensureColumns(query, execute)` path. |
| Silent catches currently mask non-duplicate failures | Replace only where expected error semantics are known and tested; otherwise leave behavior unchanged until classified. |
| Seeds depend on tables from another domain | Keep cross-domain seed blocks in the current orchestration position until ownership is confirmed. |
| Views reference tables from multiple domains | Do not move a view solely because it is a view; place it with the domain that owns the query contract and preserve creation after all referenced tables exist. |
| Table recreation migrations are not simple DDL | Leave recreation migrations in place until they have dedicated tests or fixtures proving old-schema upgrade behavior. |

## Completion Criteria For The Split

1. `ensureColumns(query, execute)` remains the only public bootstrap entry point and stays exported from the current import path.
2. Each domain module exposes internal bootstrap functions only.
3. Existing fresh-install schema remains equivalent.
4. Existing-database additive migrations keep working.
5. No silent `.catch(() => {})` remains unless a documented temporary exception is accepted in the plan for a later slice.
6. Desktop typecheck and schema/bootstrap tests pass after each domain slice.
