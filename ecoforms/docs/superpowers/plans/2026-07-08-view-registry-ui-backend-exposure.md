# View Registry UI Backend Exposure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make module dashboard view metadata round-trip correctly between SQLite backend repositories and desktop UI hooks.

**Architecture:** Keep the existing Clean Architecture boundary. Fix the SQLite repository to use canonical Portuguese columns, expose existing module dashboard use cases through the container, and add thin React hooks that call those use cases through `getContainerAsync()`.

**Tech Stack:** Next.js desktop app, TypeScript, Vitest, SQLite through `SqlitePort`.

---

### Task 1: Persist View Template Metadata

**Files:**
- Modify: `ecoforms/desktop/src/infrastructure/persistence/sqlite/__tests__/SqliteViewRegistryRepository.test.ts`
- Modify: `ecoforms/desktop/src/infrastructure/persistence/sqlite/SqliteViewRegistryRepository.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that loaded dashboards expose `userId` and `isTemplate`, and that INSERT/UPDATE statements include `id_usuario` and `modelo`.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteViewRegistryRepository.test.ts`

Expected: FAIL because `dashboard?.isTemplate` is `false` and SQL does not contain `id_usuario`/`modelo`.

- [ ] **Step 3: Implement repository mapping**

Select `id_usuario AS user_id` and `modelo AS is_template` in all repository reads. Persist `row.user_id` and `row.is_template` in INSERT and UPDATE.

- [ ] **Step 4: Re-run focused test**

Run: `npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteViewRegistryRepository.test.ts`

Expected: PASS.

### Task 2: Expose Module Dashboard Use Cases

**Files:**
- Modify: `ecoforms/desktop/src/infrastructure/container.ts`
- Modify: `ecoforms/desktop/src/infrastructure/container/modules/ModuleContainerModule.ts`
- Modify: `ecoforms/desktop/src/interface/hooks/queries/useViews.ts`
- Modify: `ecoforms/desktop/src/interface/hooks/catalog/modules-views.ts`

- [ ] **Step 1: Add container fields**

Include `createModuleDashboard`, `updateModuleDashboard`, `deleteModuleDashboard`, `updateModuleDashboardWidgets`, and `getModuleDashboardData` in `ViewRegistryUseCases` and module container wiring.

- [ ] **Step 2: Add UI hooks**

Expose `useModuleDashboardMutations()` and `useModuleDashboardData()` from `useViews.ts`, then re-export them from `catalog/modules-views.ts`.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --prefix desktop`

Expected: PASS.

### Task 3: Verify

**Files:**
- No additional files.

- [ ] **Step 1: Run focused tests**

Run: `npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteViewRegistryRepository.test.ts src/application/views/__tests__/ModuleDashboardUseCases.test.ts`

Expected: PASS.

- [ ] **Step 2: Run desktop typecheck**

Run: `npm run typecheck --prefix desktop`

Expected: PASS.
