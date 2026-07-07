# Low-Risk Use Case Simplification Plan

**Goal:** identify read-only use case wrappers that can be simplified in future, small backend PRs without changing behavior.

**Scope:** `ecoforms/desktop/src/application/decisions/DecisionUseCases.ts`, `ecoforms/desktop/src/application/views/ViewUseCases.ts`, and consumers under `ecoforms/desktop/src`.

## Evidence Commands

Decision wrapper class references:

```powershell
rg -n "GetDecisionUseCase|GetDecisionsByTargetTypeUseCase|GetDecisionsByActionUseCase|GetDecisionsForPerfilUseCase|GetActiveDecisionsUseCase" ecoforms/desktop/src
```

Summary: all five decision wrapper classes are pure repository delegation in `DecisionUseCases.ts`. `rg` found references in the class definitions, `ecoforms/desktop/src/infrastructure/container.ts`, and `ecoforms/desktop/src/infrastructure/container/modules/ModuleContainerModule.ts`. No `c.decisions.*` runtime consumer was found by a scoped container-property search.

Decision container-property search:

```powershell
rg -n "\.decisions\.(get|getByTargetType|getByAction|getForPerfil|getActive)|decisions\.get|decisions\.getByTargetType|decisions\.getByAction|decisions\.getForPerfil|decisions\.getActive" ecoforms/desktop/src
```

Summary: no matches. This lowers runtime migration risk, but the container API and exported TypeScript interfaces still depend on the wrapper types.

View wrapper class references:

```powershell
rg -n "GetViewUseCase|GetActiveViewsUseCase|GetViewsByModuleUseCase|GetViewsByPerfilUseCase" ecoforms/desktop/src
```

Summary: all four getter classes are pure repository delegation in the first section of `ViewUseCases.ts`. `rg` found references in the class definitions, `ecoforms/desktop/src/infrastructure/container.ts`, and `ecoforms/desktop/src/infrastructure/container/modules/ModuleContainerModule.ts`.

View container-property search:

```powershell
rg -n "\.views\.(get|getActive|getByModule|getByPerfil)|views\.get|views\.getActive|views\.getByModule|views\.getByPerfil" ecoforms/desktop/src
```

Summary: `useViewById` calls `c.views.get.execute(viewId)` at `ecoforms/desktop/src/interface/hooks/queries/useViews.ts:28`; `useActiveViews` calls `c.views.getActive.execute()` at `ecoforms/desktop/src/interface/hooks/queries/useViews.ts:54`. No runtime calls were found for `c.views.getByModule` or `c.views.getByPerfil`. The search also matched unrelated `this.views.get(...)` calls in the test fake `InMemoryModuleVisualViewRepository`; those are map lookups, not use case consumers.

## Rules

- Remove only wrappers that do not enforce validation, authorization, events or state transitions.
- Preserve use cases that create dashboards, normalize widgets or check permissions.
- Prefer one small PR per domain.
- Do not remove a wrapper directly when callers or container API shape require a migration path; first migrate consumers and public container types to repositories or query services.
- Treat `DecisionUseCases.ts` as pure delegation today, but treat `ViewUseCases.ts` as mixed because the same file also contains dashboard creation, permission checks, widget normalization, data fetching, and state writes.

## Candidates

| Use case | Current behavior | Consumer evidence | Decision |
| --- | --- | --- | --- |
| `GetDecisionUseCase` | Pure delegation: `execute(id)` returns `repo.findById(id)`. No validation, authorization, events, or state transitions. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:142,228` and `infrastructure/container/modules/ModuleContainerModule.ts:22,58,102`; scoped `c.decisions.get` search found no runtime consumer. | Candidate for a decision-domain migration PR. Do not delete immediately; first remove or replace the container API dependency. |
| `GetDecisionsByTargetTypeUseCase` | Pure delegation: `execute(targetType)` returns `repo.findByTargetType(targetType)`. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:142,229` and `infrastructure/container/modules/ModuleContainerModule.ts:22,59,103`; scoped `c.decisions.getByTargetType` search found no runtime consumer. | Candidate for the same decision-domain migration PR. Keep until container type and factory no longer expose it. |
| `GetDecisionsByActionUseCase` | Pure delegation: `execute(action)` returns `repo.findByAction(action)`. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:142,230` and `infrastructure/container/modules/ModuleContainerModule.ts:22,60,104`; scoped `c.decisions.getByAction` search found no runtime consumer. | Candidate for the same decision-domain migration PR. Use cautious removal after container API migration. |
| `GetDecisionsForPerfilUseCase` | Pure delegation: `execute(perfil, targetType)` returns `repo.findByPerfilAndTargetType(perfil, targetType)`. It does not check permissions; it only passes filter inputs to the repository. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:142,231` and `infrastructure/container/modules/ModuleContainerModule.ts:22,61,105`; scoped `c.decisions.getForPerfil` search found no runtime consumer. | Candidate for the same decision-domain migration PR. Preserve behavior by migrating any future callers to the equivalent repository query. |
| `GetActiveDecisionsUseCase` | Pure delegation: `execute()` returns `repo.findActive()`. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:142,232` and `infrastructure/container/modules/ModuleContainerModule.ts:22,62,106`; scoped `c.decisions.getActive` search found no runtime consumer. | Candidate for the same decision-domain migration PR. Do not delete before removing container exposure. |
| `GetViewUseCase` | Pure delegation: `execute(id)` returns `repo.findById(id)`. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:141,221` and `infrastructure/container/modules/ModuleContainerModule.ts:21,52,95`; property search found runtime hook consumer `c.views.get.execute(viewId)` in `interface/hooks/queries/useViews.ts:28`. | Needs migration path, not immediate deletion. Future PR should update `useViewById` and the container contract before removing the wrapper. |
| `GetActiveViewsUseCase` | Pure delegation: `execute()` returns `repo.findActive()`. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:141,222` and `infrastructure/container/modules/ModuleContainerModule.ts:21,53,96`; property search found runtime hook consumer `c.views.getActive.execute()` in `interface/hooks/queries/useViews.ts:54`. | Needs migration path, not immediate deletion. Future PR should update `useActiveViews` and preserve module filtering behavior currently done in the hook. |
| `GetViewsByModuleUseCase` | Pure delegation: `execute(moduleType)` returns `repo.findByModuleType(moduleType)`. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:141,223` and `infrastructure/container/modules/ModuleContainerModule.ts:21,54,97`; scoped `c.views.getByModule` search found no runtime consumer. | Candidate for a separate view-domain migration PR after removing container exposure. Keep separate from dashboard-preserving work because `ViewUseCases.ts` is mixed. |
| `GetViewsByPerfilUseCase` | Pure delegation: `execute(perfil)` returns `repo.findByPerfil(perfil)`. It filters by profile but does not enforce authorization. | Class-name `rg` found container import/type/instantiation in `infrastructure/container.ts:141,224` and `infrastructure/container/modules/ModuleContainerModule.ts:21,55,98`; scoped `c.views.getByPerfil` search found no runtime consumer. | Candidate for the same view getter migration PR after removing container exposure. Avoid conflating this with permission-checking dashboard use cases. |

## Preserve

- `CreateModuleDashboardUseCase`: creates a `ViewRegistryEntity`, assigns a new `uuidv7`, normalizes widget inputs, calls `assertCanEdit`, and writes through `repo.save`.
- Use cases that call `assertCanEdit`: `CreateModuleDashboardUseCase`, `UpdateModuleDashboardUseCase`, and `DeleteModuleDashboardUseCase`.
- Use cases that normalize widgets: `CreateModuleDashboardUseCase`, `UpdateModuleDashboardUseCase`, `UpdateModuleDashboardWidgetsUseCase` through `UpdateModuleDashboardUseCase`, and `GetModuleDashboardDataUseCase`.
- Use cases that write state: `CreateModuleDashboardUseCase`, `UpdateModuleDashboardUseCase`, `DeleteModuleDashboardUseCase`, and `UpdateModuleDashboardWidgetsUseCase` through `UpdateModuleDashboardUseCase`.

## Suggested PR Slices

1. Decision getter migration: replace the `decisions` container API with direct repository access or a narrower query service, then remove the five pure decision wrappers once no container type imports remain.
2. View getter migration: migrate `useViewById` and `useActiveViews` away from `c.views.get.execute` and `c.views.getActive.execute`, remove unused `getByModule` and `getByPerfil` container exposure, then remove only the four trivial view getter wrappers.
3. Dashboard preservation: leave dashboard use cases in place unless a later design explicitly replaces permission checks, widget normalization, and state writes with an equivalent application service.

## Verification Notes

- Direct runtime consumers found by property search: two of nine candidate wrappers (`GetViewUseCase`, `GetActiveViewsUseCase`).
- Container API/type/factory dependencies found by class-name search: nine of nine candidate wrappers.
- No code changes should be made as part of this planning task.
