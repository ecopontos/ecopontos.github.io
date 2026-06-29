# Auditoria de Imports — Hooks Catalog

> Executado em: 2026-05-19  
> Objetivo: verificar se todos os hooks ativos estão sendo importados via catálogo (`@desktop/src/interface/hooks/catalog/`) ou se há bypasses diretos aos diretórios técnicos.

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Arquivos com **bypass** (import direto) | **77** |
| Imports internos (dentro de `src/interface/hooks/`) | 4 |
| Hooks catalogados e ativos | 60+ |
| Hooks **não catalogados** usados em bypass | ~15 |

**Conclusão:** A migração para o catálogo ainda **não está completa**. A grande maioria dos componentes e páginas continua importando hooks diretamente dos diretórios técnicos (`queries/`, `mutations/`, `utils/`, `tauri/`, `domain/`) em vez de usar os temas do catálogo.

---

## Bypasses Encontrados (54 arquivos)

Esses arquivos importam hooks **diretamente dos diretórios técnicos**, bypassando o catálogo. Deveriam usar os temas do catálogo.

### `desktop/app/` — 31 arquivos

| # | Arquivo | Hooks importados (direto) | Tema correto no catálogo |
|---|---------|---------------------------|--------------------------|
| 1 | `app/analysis/page.tsx` | `useSqlite`, `useFormTemplate`, `useTauriDialog` | `tauri`, `forms` |
| 2 | `app/modulo/[slug]/ModuloPageClient.tsx` | `useActiveViews` | `modules-views` |
| 3 | `app/page.tsx` | `useSync`, `useFormPermissions`, `useSqlite`, `getInboxAccessFilter` | `sync`, `auth`, `tauri` |
| 4 | `app/view/page.client.tsx` | `useSubmissionData`, `useTauriInvoke` | `forms`, `tauri` |
| 5 | `app/manifestacoes/[id]/ManifestacaoDetailPage.tsx` | `useManifestacaoById`, `useManifestacaoTramitacoes`, `useManifestacaoRespostas`, `useManifestacaoDespachos`, `useManifestacaoPrazos`, `useManifestacaoAnexos`, `useManifestacaoCobranças`, `useManifestacaoEnvios`, `useManifestacaoCatalogos`, `useSubassuntos`, `useSubunidades`, `useProgramasOrcamentarios`, `useModelosResposta`, `useSetores`, `useManifestacaoMutations`, `useAnexoUpload` | `manifestacoes`, `auth` |
| 6 | `app/caixas/page.tsx` | `useSqlite` | `tauri` |
| 7 | `app/manifestacoes/page.tsx` | `useManifestacoes` (named exports), `useSetores`, `useManifestacaoMutations` | `manifestacoes`, `auth` |
| 8 | `app/manifestacoes/novo/page.tsx` | `useManifestacaoMutations`, `useManifestacaoCatalogos`, `useSetores` | `manifestacoes`, `auth` |
| 9 | `app/clientes/[id]/ClienteDetailPage.tsx` | `useClienteById`, `usePfContactsByPj`, `usePfUnassigned`, `useClienteMutations` | `clientes` |
| 10 | `app/clientes/novo/page.tsx` | `useClienteMutations` | `clientes` |
| 11 | `app/clientes/page.tsx` | `useClientes` | `clientes` |
| 12 | `app/login/page.tsx` | `useTauriInvoke` | `tauri` |
| 13 | `app/minhas-solicitacoes/page.tsx` | `useSolicitacoesList` | `forms` |
| 14 | `app/history/page.tsx` | `useSqlite` | `tauri` |
| 15 | `app/tarefas/[id]/TaskDetailPage.tsx` | `useSqlite` | `tauri` |
| 16 | `app/run/page.client.tsx` | `useSqlite`, `useFormPermissions` | `tauri`, `auth` |
| 17 | `app/forms/edit/page.client.tsx` | `useTauriInvoke` | `tauri` |
| 18 | `app/forms/page.tsx` | `useSqlite` | `tauri` |
| 19 | `app/logistica/roteiros/[id]/RoteiroDetailPage.tsx` | `useRoteiroById`, `useClientesByRoteiro`, `useExecucoes`, `useChecklistByExecucao`, `useHistoricoByExecucao`, `useIntercorrenciasByExecucao`, `useLogisticsMutations` | `logistica` |
| 20 | `app/projects/[id]/ProjectDetailPage.tsx` | `useProjectDetail`, `useProjectMutations`, `canManageByRole` | `kanban`, `auth` |
| 21 | `app/projects/page.tsx` | `canManageByRole`, `useProjects`, `useProjectMutations` | `auth`, `kanban` |
| 22 | `app/debug/page.tsx` | `useDebugHealth`, `useSeedDemo` | `tauri`, `utils` |
| 23 | `app/logistica/roteiros/novo/page.tsx` | `useLogisticsMutations` | `logistica` |
| 24 | `app/logistica/page.tsx` | `useRoteiros`, `useExecucoes` | `logistica` |
| 25 | `app/admin/sectors/page.tsx` | `useSqlite` | `tauri` |
| 26 | `app/admin/modules/page.tsx` | `useModules` | `modules-views` |
| 27 | `app/admin/users/page.tsx` | `useSupabaseAdmin`, `useAdminUsers` | `auth` |
| 28 | `app/admin/inspector/page.tsx` | `useSQLiteQuery`, `useNetworkParquet` | `tauri`¹, `utils` |
| 29 | `app/admin/schema-inspector/page.tsx` | `useSqlite` | `tauri` |
| 30 | `app/admin/settings/page.tsx` | `useDeviceConfig`, `useSyncSettings`, `useNetworkParquet` | `sync`, `utils` |
| 31 | `app/tasks/metrics/page.tsx` | `useTaskMetrics` | `kanban` |

> ¹ `useSQLiteQuery` está marcado como `@deprecated` no catálogo.

### `desktop/components/` — 41 arquivos

| # | Arquivo | Hooks importados (direto) | Tema correto no catálogo |
|---|---------|---------------------------|--------------------------|
| 32 | `components/layout/AppSidebar.tsx` | `useTauriQuery`, `useModules` | `tauri`, `modules-views` |
| 33 | `components/kanban/TaskEntriesModal.tsx` | `useSqlite`, `useFormTemplate`, `useAllUsers`, `useTaskHistory` | `tauri`, `forms`, `auth`, `kanban` |
| 34 | `components/dashboard-composer/SelectDashboardModal.tsx` | `useActiveViews` | `modules-views` |
| 35 | `components/dashboard/ViewRenderer.tsx` | `useViewById`, `useSqlite` | `modules-views`, `tauri` |
| 36 | `components/clientes/ClientePhoneSearch.tsx` | `useClientePhoneSearch` | `clientes` |
| 37 | `components/kanban/SolicitacaoReviewModal.tsx` | `useTaskOptions`, `canManageByRole`, `useTauriInvoke` | `kanban`, `auth`, `tauri` |
| 38 | `components/runtime/FormRenderer.tsx` | `useSqlite`, `useVisibilityEvaluator` | `tauri`, `forms` |
| 39 | `components/forms/SchemaEditor.tsx` | `useSqlite` | `tauri` |
| 40 | `components/kanban/NewTaskModal.tsx` | `useTauriInvoke` | `tauri` |
| 41 | `components/kanban/EditTaskModal.tsx` | `useTauriInvoke`, `useContainer`, `useEventBus` | `tauri`, `utils`, `sync` |
| 42 | `components/users/UserDialog.tsx` | `useTauriInvoke` | `tauri` |
| 43 | `components/kanban/ReassignTaskDialog.tsx` | `useSqlite`, `useKanban` | `tauri`, `kanban` |
| 44 | `components/kanban/TaskAttachments.tsx` | `useSqlite`, `useFileStorage` | `tauri`, `utils` |
| 45 | `components/gallery/GalleryGrid.tsx` | `useSupabaseClient` | `utils` |
| 46 | `components/DynamicDashboard.tsx` | `useContainer` | `utils` |
| 47 | `components/kanban/KanbanBoard.tsx` | `useKanban`, `useTaskOptions` | `kanban` |
| 48 | `components/auth/FirstRunSetupModal.tsx` | `useTauriInvoke` | `tauri` |
| 49 | `components/runtime/FormFieldRenderer.tsx` | `evaluateVisibilityRules` | `forms` |
| 50 | `components/runtime/fields/VistoriaChecklistRenderer.tsx` | `useDataRegistryAggregated` | `data-registry` |
| 51 | `components/runtime/fields/RadioRenderer.tsx` | `useDataRegistryAggregated` | `data-registry` |
| 52 | `components/runtime/fields/PresenceRenderer.tsx` | `useDataRegistryAggregated` | `data-registry` |
| 53 | `components/runtime/fields/SelectRenderer.tsx` | `useDataRegistryAggregated` | `data-registry` |
| 54 | `components/runtime/fields/ChipsRenderer.tsx` | `useDataRegistryAggregated` | `data-registry` |
| 55 | `components/runtime/fields/AutocompleteRenderer.tsx` | `useDataRegistryAggregated` | `data-registry` |
| 56 | `components/forms/FieldPropertiesPanel.tsx` | `useDataRegistryTypesNew` | `data-registry` |
| 57 | `components/registry/DataRegistryEditor.tsx` | `useDataRegistryUseCases`, `useDataRegistryItemsNew`, `DataRegistryItemView` | `data-registry` |
| 58 | `components/registry/DataRegistryPage.tsx` | `useDataRegistryUseCases`, `useDataRegistryItemsNew`, `DataRegistryItemView` | `data-registry` |
| 59 | `components/registry/DataRegistryList.tsx` | `useDataRegistryItemsNew`, `useTauriDialog`, `DataRegistryItemView` | `data-registry`, `tauri` |
| 60 | `components/registry/DataRegistryImport.tsx` | `useDataRegistryBulkInsert` | `data-registry` |
| 61 | `components/ClientLayout.tsx` | `useTauriInvoke`, `initializeContainer` | `tauri`, `utils` |
| 62 | `components/DetailViewModal.tsx` | `useFormTemplate`, `useInboxMutations`, `useAllUsers` | `forms`, `auth` |
| 63 | `components/auth/PermissionGuards.tsx` | `Permission` (type de `usePermissions`) | `auth` |
| 64 | `components/registry/DataRegistrySidebar.tsx` | `useDataRegistryTypesNew`, `useDataRegistryTypeCountsNew` | `data-registry` |
| 65 | `components/projects/ProjectDialog.tsx` | `useAllUsers` | `auth` |
| 66 | `components/projects/ProjectCard.tsx` | `ProjectWithMetrics` | `kanban` |
| 67 | `components/kanban/TaskHistoryTab.tsx` | `useTaskComments` | `kanban` |
| 68 | `components/kanban/KanbanViewToolbar.tsx` | `ViewMode` (type de `useKanbanViewState`) | `kanban` |
| 69 | `components/kanban/StakeholdersSelect.tsx` | `useTaskOptions` | `kanban` |
| 70 | `components/forms/FormAccessModal.tsx` | `useUsersByForm` | `forms` |
| 71 | `components/admin/StorageStatusCard.tsx` | `useFileStorage` | `utils` |
| 72 | `components/SyncStatusIndicator.tsx` | `useKeyboardShortcuts` | `utils` |

### `desktop/contexts/` — 2 arquivos

| # | Arquivo | Hooks importados (direto) | Tema correto no catálogo |
|---|---------|---------------------------|--------------------------|
| 73 | `contexts/SyncContext.tsx` | `useSqlite`, `useOnlineStatus` | `tauri`, `sync` |
| 74 | `contexts/AuthContext.tsx` | `usePermissions`, `useSqlite` | `auth`, `tauri` |

### `desktop/src/application/` — 2 arquivos

| # | Arquivo | Hooks importados (direto) | Tema correto no catálogo |
|---|---------|---------------------------|--------------------------|
| 75 | `src/application/actions/ActionRegistry.ts` | `UserRole` (type de `usePermissions`) | `auth` |
| 76 | `src/application/widgets/WidgetRegistry.ts` | `UserRole` (type de `usePermissions`) | `auth` |

### Testes — 1 arquivo

| # | Arquivo | Hooks importados (direto) | Tema correto no catálogo |
|---|---------|---------------------------|--------------------------|
| 77 | `src/application/permissions/__tests__/usePermissionsReassign.test.ts` | `usePermissions` | `auth` |

---

## Hooks Importados Diretamente (não via catálogo)

Lista consolidada de hooks que aparecem em bypasses, com o diretório técnico de origem:

| Hook | Diretório | Tema do Catálogo | Status no Catálogo |
|------|-----------|------------------|--------------------|
| `useSqlite` | `queries/` | `tauri` | ✅ ativo |
| `useFormTemplate` | `queries/` | `forms` | ✅ ativo |
| `useTauriDialog` | `tauri/` | `tauri` | ✅ ativo |
| `useTauriFs` | `tauri/` | `tauri` | removido em 2026-06-29; filesystem direto via plugin-fs descontinuado |
| `useActiveViews` | `queries/` | `modules-views` | ✅ ativo |
| `useSync` | `queries/` | `sync` | ✅ ativo |
| `useFormPermissions` | `utils/` | `auth` | ✅ ativo |
| `getInboxAccessFilter` | `utils/` | `auth` | ✅ ativo |
| `useSubmissionData` | `queries/` | `forms` | ✅ ativo |
| `useTauriInvoke` | `tauri/` | `tauri` | ✅ ativo |
| `useManifestacaoById` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacaoTramitacoes` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacaoRespostas` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacaoDespachos` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacaoPrazos` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacaoAnexos` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacaoCobranças` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacaoEnvios` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacoes` | `queries/` | `manifestacoes` | ✅ ativo |
| `useManifestacaoCatalogos` | `queries/` | `manifestacoes` | ✅ ativo |
| `useSubassuntos` | `queries/` | `manifestacoes` | ✅ ativo |
| `useSubunidades` | `queries/` | `manifestacoes` | ✅ ativo |
| `useProgramasOrcamentarios` | `queries/` | `manifestacoes` | ✅ ativo |
| `useModelosResposta` | `queries/` | `manifestacoes` | ✅ ativo |
| `useSetores` | `queries/` | `auth` | ✅ ativo |
| `useManifestacaoMutations` | `mutations/` | `manifestacoes` | ✅ ativo |
| `useAnexoUpload` | `mutations/` | `forms` | ✅ ativo |
| `useClientes` | `queries/` | `clientes` | ✅ ativo |
| `useClienteById` | `queries/` | `clientes` | ✅ ativo |
| `usePfContactsByPj` | `queries/` | `clientes` | ✅ ativo |
| `usePfUnassigned` | `queries/` | `clientes` | ✅ ativo |
| `useClientePhoneSearch` | `queries/` | `clientes` | ✅ ativo |
| `useClienteMutations` | `mutations/` | `clientes` | ✅ ativo |
| `useSolicitacoesList` | `queries/` | `forms` | ✅ ativo |
| `useRoteiroById` | `queries/` | `logistica` | ✅ ativo |
| `useClientesByRoteiro` | `queries/` | `logistica` | ✅ ativo |
| `useExecucoes` | `queries/` | `logistica` | ✅ ativo |
| `useChecklistByExecucao` | `queries/` | `logistica` | ✅ ativo |
| `useHistoricoByExecucao` | `queries/` | `logistica` | ✅ ativo |
| `useIntercorrenciasByExecucao` | `queries/` | `logistica` | ✅ ativo |
| `useLogisticsMutations` | `mutations/` | `logistica` | ✅ ativo |
| `useProjectDetail` | `queries/` | `kanban` | ✅ ativo |
| `useProjectMutations` | `queries/` | `kanban` | ✅ ativo |
| `useProjects` | `queries/` | `kanban` | ✅ ativo |
| `canManageByRole` | `utils/` | `auth` | ✅ ativo |
| `useDebugHealth` | `queries/` | `tauri` | ✅ ativo |
| `useSeedDemo` | `mutations/` | `utils` | ✅ ativo |
| `useRoteiros` | `queries/` | `logistica` | ✅ ativo |
| `useModules` | `queries/` | `modules-views` | ✅ ativo |
| `useSupabaseAdmin` | `queries/` | `auth` | ✅ ativo |
| `useAdminUsers` | `queries/` | `auth` | ✅ ativo |
| `useSQLiteQuery` | `queries/` | `tauri` | ⚠️ **@deprecated** |
| `useNetworkParquet` | `utils/` | `utils` | ✅ ativo |
| `useDeviceConfig` | `utils/` | `sync` | ✅ ativo |
| `useSyncSettings` | `queries/` | `sync` | ✅ ativo |
| `useTaskMetrics` | `queries/` | `kanban` | ✅ ativo |
| `useTauriQuery` | `tauri/` | `tauri` | ✅ ativo |
| `useAllUsers` | `queries/` | `auth` | ✅ ativo |
| `useTaskHistory` | `queries/` | `kanban` | ✅ ativo |
| `useViewById` | `queries/` | `modules-views` | ✅ ativo |
| `useKanban` | `queries/` | `kanban` | ✅ ativo |
| `useTaskOptions` | `queries/` | `kanban` | ✅ ativo |
| `useContainer` | `utils/` | `utils` | ✅ ativo |
| `useEventBus` | `utils/` | `sync` | ✅ ativo |
| `useFileStorage` | `utils/` | `utils` | ✅ ativo |
| `useSupabaseClient` | `utils/` | `utils` | ✅ ativo |
| `useVisibilityEvaluator` | `queries/` | `forms` | ✅ ativo |
| `evaluateVisibilityRules` | `queries/` | `forms` | ✅ ativo |
| `useDataRegistryAggregated` | `queries/` | `data-registry` | ✅ ativo |
| `useDataRegistryTypesNew` | `queries/` | `data-registry` | ✅ ativo |
| `useDataRegistryItemsNew` | `queries/` | `data-registry` | ✅ ativo |
| `useDataRegistryUseCases` | `domain/` | `data-registry` | ✅ ativo |
| `useDataRegistryBulkInsert` | `mutations/` | `data-registry` | ✅ ativo |
| `useDataRegistryTypeCountsNew` | `queries/` | `data-registry` | ✅ ativo |
| `useInboxMutations` | `mutations/` | `forms` | ✅ ativo |
| `Permission` (type) | `utils/` | `auth` | ✅ ativo |
| `UserRole` (type) | `utils/` | `auth` | ✅ ativo |
| `usePermissions` | `utils/` | `auth` | ✅ ativo |
| `UsePermissionsReturn` | `utils/` | `auth` | ✅ ativo |
| `useOnlineStatus` | `utils/` | `sync` | ✅ ativo |
| `useKeyboardShortcuts` | `utils/` | `utils` | ✅ ativo |
| `useTaskComments` | `queries/` | `kanban` | ✅ ativo |
| `useKanbanViewState` | `queries/` | `kanban` | ✅ ativo |
| `useTaskUseCases` | `domain/` | `kanban` | ✅ ativo |
| `useUsersByForm` | `queries/` | `forms` | ✅ ativo |
| `useAssignedActiveForms` | `queries/` | `forms` | ✅ ativo |
| `useDashboardWidgets` | `hooks/` raiz | `modules-views` | ✅ ativo |
| `useWorkflowActions` | `hooks/` raiz | `kanban` | ✅ ativo |
| `useDemandas` | `queries/` | `forms` | ✅ ativo (não aparece em bypass) |

---

## Hooks Faltantes no Catálogo

Durante a auditoria, os seguintes hooks/dados **foram encontrados em uso direto mas não estão exportados** nos arquivos temáticos do catálogo:

| Hook/Dado | Diretório | Tema Sugerido | Ação |
|-----------|-----------|---------------|------|
| `useSQLiteColumnExists` | `queries/useSQLiteSchema` | `tauri` | ✅ Já está no catálogo, mas não há bypasses |
| `useTauriMutation`, `useLastInsertId`, `useTauriBatch` | `tauri/useTauriMutation` | `tauri` | ✅ Já está no catálogo, mas não há bypasses |
| `ProjectWithMetrics` | `queries/useProjects` | `kanban` | ⚠️ **NÃO exportado** no `catalog/kanban.ts`; adicionar se for usado externamente |
| `ViewMode` | `queries/useKanbanViewState` | `kanban` | ⚠️ **NÃO exportado** no `catalog/kanban.ts`; adicionar se for usado externamente |
| `SolicitacaoPackage` | `queries/useSolicitacoesList` | `forms` | ⚠️ **NÃO exportado** no `catalog/forms.ts`; adicionar se for usado externamente |
| `DataRegistryItemView` | `queries/useDataRegistryItems` | `data-registry` | ⚠️ **NÃO exportado** no `catalog/data-registry.ts`; adicionar se for usado externamente |

---

## Ação Recomendada

1. **Corrigir os 54 arquivos com bypass**: substituir os imports diretos pelos temas do catálogo.  
   Exemplo de correção:
   ```tsx
   // ❌ Antes (bypass)
   import { useClientes } from "@/src/interface/hooks/queries/useClientes";

   // ✅ Depois (via catálogo)
   import { useClientes } from "@/src/interface/hooks/catalog/clientes";
   ```

2. **Adicionar types faltantes ao catálogo**: exportar `ProjectWithMetrics`, `ViewMode`, `SolicitacaoPackage`, `DataRegistryItemView` nos respectivos arquivos temáticos para permitir imports tipados via catálogo.

3. **Remover uso de `useSQLiteQuery`**: o hook está `@deprecated` no catálogo, mas ainda é usado em `app/admin/inspector/page.tsx`. Migrar para repositórios via use cases do container DI.

4. **Internos (aceitáveis)**: os imports dentro de `src/interface/hooks/` (ex: `useKanban.ts` importando `useTauriQuery`) são considerados internos e não precisam de correção — os hooks técnicos podem referenciar uns aos outros.

---

*Relatório gerado automaticamente pelo skill `hooks-catalog` — Fluxo 3 (Auditoria de imports).*
