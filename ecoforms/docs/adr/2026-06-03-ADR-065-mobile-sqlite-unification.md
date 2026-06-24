# ADR-065 ÔÇö Unifica├º├úo do storage mobile: IndexedDB ÔåÆ SQLite


> **Renumerado** de ADR-052 para ADR-065 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:**Implementado** (Fases 1ÔÇô4)
**Data:** 2026-06-03  
**Implementado em:** 2026-06-03  
**Autor:** Marcelo Luiz  
**Branch:** adr-051-commands-backend

---

## Contexto

### Diverg├¬ncia de stacks (estado antes da implementa├º├úo)

| Aspecto | Desktop (Tauri v2) | Mobile (Capacitor v8) |
|---|---|---|
| Storage | SQLite via `invoke('db_query')` (Rust) | IndexedDB via `SyncEventDB` (browser API) |
| Schema | `ensure-columns.ts` ÔÇö tabelas relacionais com FK e ├¡ndices | Object stores planos (`syncEventQueue`, `usuarios`, `tarefas`, etc.) |
| Queries | Cat├ílogo tipado em `queries/*.ts` | SQL inexistente ÔÇö acesso direto por chave/cursor |
| Reposit├│rios | `SqliteKanbanRepository`, `SqliteManifestacaoRepository`, etc. | Nenhum ÔÇö l├│gica inline nos handlers JS |
| Tipagem | TypeScript estrito | JavaScript puro |

Essa diverg├¬ncia gerava tr├¬s problemas concretos:

1. **Manuten├º├úo duplicada de schema.** Qualquer nova entidade exigia cria├º├úo em `ensure-columns.ts` para o desktop e um novo object store para o mobile, sem garantia de consist├¬ncia estrutural.
2. **Aus├¬ncia de reposit├│rios no mobile.** L├│gica de acesso a dados espalhada em `HandlerRegistry.js`, `DataService.js` e `SyncAdapter.js`.
3. **Portabilidade zero de `ecoforms-core`.** O mobile n├úo implementava `SqlitePort`, impossibilitando reaproveitamento de l├│gica de dom├¡nio.

### Paradigma form-centric vs task-centric

A tela **"Tarefas de Campo"** (`/minhas-tarefas-campo`) introduzida no desktop demonstrou um paradigma alternativo ao form-centric atual do mobile:

```
gestor agenda ÔåÆ tarefa criada (origem='booking') ÔåÆ worker v├¬ roteiro do dia ÔåÆ confirma desfecho
```

A unifica├º├úo de storage via SQLite ├® o pr├®-requisito t├®cnico para portar esse modelo ao mobile ÔÇö sem reposit├│rios compartilhados, qualquer tela desenvolvida no desktop precisa ser reescrita do zero para o APK.

---

## Decis├úo

Substituir o IndexedDB do mobile por SQLite via `@capacitor-community/sqlite@8.1.0`, alinhando os dois runtimes em torno de:

- Uma **├║nica fonte de verdade de schema**: `ensure-columns.ts` + `MobileSchemaBootstrap.js`
- Uma **interface de port compartilhada**: `SqlitePort` em `packages/core`
- **Reposit├│rios em `ecoforms-core`**: interfaces e implementa├º├Áes compartilhadas

---

## Implementa├º├úo ÔÇö o que foi feito

### Fase 1 ÔÇö `SqlitePort` em `ecoforms-core` Ô£à

**Arquivos criados/modificados:**

| Arquivo | Mudan├ºa |
|---|---|
| `packages/core/src/ports/SqlitePort.ts` | Interface criada (fonte can├┤nica) |
| `packages/core/src/index.ts` | Re-exporta `SqlitePort` |
| `packages/core/package.json` | Export `"./ports"` adicionado |
| `desktop/src/application/ports/SqlitePort.ts` | Agora re-exporta de `ecoforms-core` |
| `desktop/tsconfig.json` | Path mapping `ecoforms-core/ports` adicionado |
| `mobile/www/js/adapters/CapacitorSqliteAdapter.js` | Adapter criado ÔÇö API direta via `Capacitor.Plugins.CapacitorSQLite` |
| `mobile/package.json` | `@capacitor-community/sqlite@^8.1.0` adicionado |

**Desvio do plano:** plugin instalado como `^8.1.0` (n├úo `^6.0.2`) ÔÇö vers├úo 6 incompat├¡vel com `@capacitor/core@8.x`. O adapter usa a API direta via `Capacitor.Plugins` (sem bundler/import ES module) adequada ao ambiente `www/` est├ítico.

---

### Fase 2 ÔÇö Schema mobile Ô£à

**Arquivos criados/modificados:**

| Arquivo | Mudan├ºa |
|---|---|
| `mobile/www/js/adapters/MobileSchemaBootstrap.js` | Cria 12 tabelas + ├¡ndices via `sqliteAdapter` ÔÇö idempotente |
| `mobile/www/js/adapters/IndexedDbMigration.js` | Migra├º├úo one-shot IndexedDB ÔåÆ SQLite; marcada em `localStorage('idb_migration_v1')` |
| `mobile/www/js/auth-manager.js` | Chama bootstrap + migra├º├úo antes de `SyncAdapter.start()` ÔÇö ambos non-fatal |

**Tabelas criadas no mobile:**
`perfis`, `escalas`, `setores`, `usuarios`, `usuarios_setores`, `registro_formularios`, `registro_dados`, `pacotes`, `tbl_suite`, `tarefas`, `tarefas_eventos`, `demandas`, `demanda_eventos`, `fila_eventos_sync`, `log_eventos_aplicados`

**Desvio do plano:** `ensure-columns.ts` n├úo foi executado diretamente no mobile (├® TypeScript com depend├¬ncias Tauri). Em vez disso, criado `MobileSchemaBootstrap.js` com o subset relevante extra├¡do manualmente ÔÇö abordagem mais segura e sem acoplamento ao toolchain desktop.

---

### Fase 3 ÔÇö Reposit├│rios compartilhados em `ecoforms-core` Ô£à

**Arquivos criados/modificados:**

| Arquivo | Mudan├ºa |
|---|---|
| `packages/core/src/repositories/KanbanRepository.ts` | Interface `KanbanRepository` + todos os tipos de input + `Interessado` + `SqliteSyncEventRepository` (implementa├º├úo concreta) |
| `packages/core/src/repositories/index.ts` | Barrel de exporta├º├úo |
| `packages/core/package.json` | Export `"./repositories"` adicionado |
| `desktop/src/domain/kanban/KanbanRepository.ts` | Re-exporta de `ecoforms-core` ÔÇö zero breaking change |
| `desktop/types/index.ts` | `Interessado` agora vem de `ecoforms-core` |
| `desktop/tsconfig.json` | Path mapping `ecoforms-core/repositories` adicionado |
| `mobile/www/js/adapters/MobileKanbanRepository.js` | Implementa subset de `KanbanRepository` para mobile (`findBookingTasksForUser`, `updateTask`, `insertTaskEvent`); stubs expl├¡citos para m├®todos n├úo suportados |

**Desvio do plano:** `SqliteKanbanRepository` e `SqliteManifestacaoRepository` n├úo foram movidos fisicamente para `ecoforms-core` ÔÇö o desktop usa o `SqlitePort` via Tauri (Rust `invoke`) que n├úo existe no contexto do pacote core. Em vez disso, a **interface** foi movida para `ecoforms-core` e o mobile ganhou `MobileKanbanRepository.js` como implementa├º├úo separada. Isso ├® arquiteturalmente mais correto ÔÇö o core define o contrato, cada runtime fornece sua implementa├º├úo.

---

### Fase 4 ÔÇö Migra├º├úo do pipeline de sync mobile Ô£à

**Arquivos criados/modificados:**

| Arquivo | Mudan├ºa |
|---|---|
| `mobile/www/js/sync/EventBus.js` | Reescrito: IndexedDB removido, usa `SqliteSyncEventRepository` + `sqliteAdapter` |
| `mobile/www/js/sync/EventBus.legacy.js` | Backup do original IndexedDB (preservado para rollback) |
| `mobile/www/js/adapters/MobileSchemaBootstrap.js` | `sync_device_log` adicionado ao schema |

**Mapeamento de opera├º├Áes:**

| Opera├º├úo | IndexedDB (antes) | SQLite (depois) |
|---|---|---|
| `publish()` | `store.put()` em `syncEventQueue` IDB | `syncRepo.enqueue()` ÔåÆ `fila_eventos_sync` |
| `getPendingEnvelopes()` | Cursor em IDBIndex `statusSeq` | `syncRepo.getPending()` ÔåÆ SQL `WHERE situacao='pending'` |
| `markAsSent()` | `store.put()` + `logStore.put()` IDB | `syncRepo.markSent()` + INSERT `sync_device_log` |
| `markAsFailed()` | `store.put()` com `attempts++` | `syncRepo.markFailed()` ÔåÆ UPDATE SQLite |
| `_nextSeq()` | Cursor em `syncDeviceLog` IDB | `MAX(seq)` em `sync_device_log` |
| `_isProcessed()` | `index.get(eventId)` IDB | `SELECT 1 WHERE event_id = ?` |
| `dispatch()` handlers | Recebiam `(envelope, idb)` | Recebem `(envelope, sqliteAdapter)` |
| `purgeOld*()` | Cursor + delete IDB | DELETE com `datetime('now', '-N days')` |

**API p├║blica 100% preservada** ÔÇö `TransportService`, `InboundService` e `SyncAdapter` sem nenhuma altera├º├úo.

---

### Fase 5 ÔÇö Port de "Tarefas de Campo" para mobile ­ƒö▓ pendente

Com reposit├│rios compartilhados dispon├¡veis (Fase 3), portar `MinhasTarefasCampoPage` para o mobile como tela nativa do APK:

- Adicionar `offline-first`: fila local de desfechos pendentes sincronizados quando conectividade restaurada
- Adicionar suporte a c├ómera via `@capacitor/camera` para anexos em intercorr├¬ncias
- Essa tela passa a ser o ponto de entrada principal do perfil `campo` no mobile

**Crit├®rio de conclus├úo:** quando ÔëÑ80% dos acessos do perfil `campo` no mobile passarem pela tela de tarefas em vez de formul├írios avulsos.

---

## Alternativas consideradas

### Op├º├úo B ÔÇö `SqlitePort` abstrato com IndexedDB mapeado
**Rejeitada.** IndexedDB n├úo ├® SQL ÔÇö mapeamento de queries relacionais para cursores de object store ├® fr├ígil, n├úo suporta JOINs reais e acumula d├¡vida estrutural.

### Op├º├úo C ÔÇö Manter diverg├¬ncia, adicionar gera├º├úo de c├│digo
**Rejeitada.** Resolve apenas sync de schema, n├úo elimina duplicidade de l├│gica de reposit├│rio.

---

## Consequ├¬ncias

### Positivas

- `ensure-columns.ts` (desktop) e `MobileSchemaBootstrap.js` (mobile) compartilham estrutura ÔÇö diverg├¬ncias s├úo detect├íveis por diff
- `KanbanRepository`, `SqliteSyncEventRepository` e tipos de input definidos uma ├║nica vez em `ecoforms-core`
- `EventBus.js` opera sobre SQL puro ÔÇö queries debug├íveis, sem cursor API IndexedDB
- `Interessado` e demais tipos de dom├¡nio t├¬m fonte can├┤nica em `ecoforms-core`
- Habilita a transi├º├úo do mobile de **form-centric ÔåÆ task-centric** (Fase 5)

### Negativas / Riscos

- **Migra├º├úo de dados**: `IndexedDbMigration.js` cobre os stores principais; stores n├úo mapeados (`syncDeviceLog`, `tbl_clientes`, `tbl_roteiros`) n├úo s├úo migrados ÔÇö dados hist├│ricos desses stores s├úo perdidos na transi├º├úo
- **`@capacitor-community/sqlite` v8.1.0**: API sem bundler depende de `Capacitor.Plugins.CapacitorSQLite` dispon├¡vel em runtime ÔÇö falha silenciosa em ambiente web puro (dev server sem Capacitor)
- **Handlers do EventBus**: recebiam `db` (IDB) como segundo argumento ÔÇö agora recebem `sqliteAdapter`. Handlers que usavam `db` diretamente precisam ser auditados

---

## Plano de implementa├º├úo ÔÇö status final

| Fase | Entreg├ível | Status | Desvio do plano original |
|---|---|---|---|
| 1 | `SqlitePort` em `ecoforms-core` + `CapacitorSqliteAdapter` | Ô£à Conclu├¡do | Plugin v8.1.0 (n├úo v6); API direta sem bundler |
| 2 | Schema mobile + migra├º├úo de dados | Ô£à Conclu├¡do | `MobileSchemaBootstrap.js` separado (n├úo `ensure-columns.ts` direto) |
| 3 | Reposit├│rios compartilhados | Ô£à Conclu├¡do | Interface movida; implementa├º├Áes separadas por runtime |
| 4 | `EventBus.js` migrado | Ô£à Conclu├¡do | `EventBus.legacy.js` preservado; `sync_device_log` adicionado ao schema |
| 5 | Port "Tarefas de Campo" para mobile | ­ƒö▓ Pendente | ÔÇö |

---

## Refer├¬ncias

- `packages/core/src/ports/SqlitePort.ts` ÔÇö interface `SqlitePort`
- `packages/core/src/repositories/KanbanRepository.ts` ÔÇö interfaces + `SqliteSyncEventRepository`
- `mobile/www/js/adapters/CapacitorSqliteAdapter.js` ÔÇö adapter Capacitor
- `mobile/www/js/adapters/MobileSchemaBootstrap.js` ÔÇö schema mobile
- `mobile/www/js/adapters/IndexedDbMigration.js` ÔÇö migra├º├úo one-shot
- `mobile/www/js/adapters/MobileKanbanRepository.js` ÔÇö reposit├│rio mobile
- `mobile/www/js/sync/EventBus.js` ÔÇö pipeline migrado
- `mobile/www/js/sync/EventBus.legacy.js` ÔÇö backup IndexedDB
- `desktop/app/minhas-tarefas-campo/page.tsx` ÔÇö modelo conceitual (Fase 5)
- `desktop/docs/FIELD_TYPE_NORMALIZATION.md` ÔÇö normaliza├º├úo de campos
- ADR-018 ÔÇö Motor de agendamentos
- ADR-051 ÔÇö Commands backend
