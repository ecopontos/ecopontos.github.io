# ADR-052 — Unificação do storage mobile: IndexedDB → SQLite

**Status:** Implementado (Fases 1–4) · Fase 5 pendente  
**Data:** 2026-06-03  
**Implementado em:** 2026-06-03  
**Autor:** Marcelo Luiz  
**Branch:** adr-051-commands-backend

---

## Contexto

### Divergência de stacks (estado antes da implementação)

| Aspecto | Desktop (Tauri v2) | Mobile (Capacitor v8) |
|---|---|---|
| Storage | SQLite via `invoke('db_query')` (Rust) | IndexedDB via `SyncEventDB` (browser API) |
| Schema | `ensure-columns.ts` — tabelas relacionais com FK e índices | Object stores planos (`syncEventQueue`, `usuarios`, `tarefas`, etc.) |
| Queries | Catálogo tipado em `queries/*.ts` | SQL inexistente — acesso direto por chave/cursor |
| Repositórios | `SqliteKanbanRepository`, `SqliteManifestacaoRepository`, etc. | Nenhum — lógica inline nos handlers JS |
| Tipagem | TypeScript estrito | JavaScript puro |

Essa divergência gerava três problemas concretos:

1. **Manutenção duplicada de schema.** Qualquer nova entidade exigia criação em `ensure-columns.ts` para o desktop e um novo object store para o mobile, sem garantia de consistência estrutural.
2. **Ausência de repositórios no mobile.** Lógica de acesso a dados espalhada em `HandlerRegistry.js`, `DataService.js` e `SyncAdapter.js`.
3. **Portabilidade zero de `ecoforms-core`.** O mobile não implementava `SqlitePort`, impossibilitando reaproveitamento de lógica de domínio.

### Paradigma form-centric vs task-centric

A tela **"Tarefas de Campo"** (`/minhas-tarefas-campo`) introduzida no desktop demonstrou um paradigma alternativo ao form-centric atual do mobile:

```
gestor agenda → tarefa criada (origem='booking') → worker vê roteiro do dia → confirma desfecho
```

A unificação de storage via SQLite é o pré-requisito técnico para portar esse modelo ao mobile — sem repositórios compartilhados, qualquer tela desenvolvida no desktop precisa ser reescrita do zero para o APK.

---

## Decisão

Substituir o IndexedDB do mobile por SQLite via `@capacitor-community/sqlite@8.1.0`, alinhando os dois runtimes em torno de:

- Uma **única fonte de verdade de schema**: `ensure-columns.ts` + `MobileSchemaBootstrap.js`
- Uma **interface de port compartilhada**: `SqlitePort` em `packages/core`
- **Repositórios em `ecoforms-core`**: interfaces e implementações compartilhadas

---

## Implementação — o que foi feito

### Fase 1 — `SqlitePort` em `ecoforms-core` ✅

**Arquivos criados/modificados:**

| Arquivo | Mudança |
|---|---|
| `packages/core/src/ports/SqlitePort.ts` | Interface criada (fonte canônica) |
| `packages/core/src/index.ts` | Re-exporta `SqlitePort` |
| `packages/core/package.json` | Export `"./ports"` adicionado |
| `desktop/src/application/ports/SqlitePort.ts` | Agora re-exporta de `ecoforms-core` |
| `desktop/tsconfig.json` | Path mapping `ecoforms-core/ports` adicionado |
| `mobile/www/js/adapters/CapacitorSqliteAdapter.js` | Adapter criado — API direta via `Capacitor.Plugins.CapacitorSQLite` |
| `mobile/package.json` | `@capacitor-community/sqlite@^8.1.0` adicionado |

**Desvio do plano:** plugin instalado como `^8.1.0` (não `^6.0.2`) — versão 6 incompatível com `@capacitor/core@8.x`. O adapter usa a API direta via `Capacitor.Plugins` (sem bundler/import ES module) adequada ao ambiente `www/` estático.

---

### Fase 2 — Schema mobile ✅

**Arquivos criados/modificados:**

| Arquivo | Mudança |
|---|---|
| `mobile/www/js/adapters/MobileSchemaBootstrap.js` | Cria 12 tabelas + índices via `sqliteAdapter` — idempotente |
| `mobile/www/js/adapters/IndexedDbMigration.js` | Migração one-shot IndexedDB → SQLite; marcada em `localStorage('idb_migration_v1')` |
| `mobile/www/js/auth-manager.js` | Chama bootstrap + migração antes de `SyncAdapter.start()` — ambos non-fatal |

**Tabelas criadas no mobile:**
`perfis`, `escalas`, `setores`, `usuarios`, `usuarios_setores`, `registro_formularios`, `registro_dados`, `pacotes`, `tbl_suite`, `tarefas`, `tarefas_eventos`, `demandas`, `demanda_eventos`, `fila_eventos_sync`, `log_eventos_aplicados`

**Desvio do plano:** `ensure-columns.ts` não foi executado diretamente no mobile (é TypeScript com dependências Tauri). Em vez disso, criado `MobileSchemaBootstrap.js` com o subset relevante extraído manualmente — abordagem mais segura e sem acoplamento ao toolchain desktop.

---

### Fase 3 — Repositórios compartilhados em `ecoforms-core` ✅

**Arquivos criados/modificados:**

| Arquivo | Mudança |
|---|---|
| `packages/core/src/repositories/KanbanRepository.ts` | Interface `KanbanRepository` + todos os tipos de input + `Interessado` + `SqliteSyncEventRepository` (implementação concreta) |
| `packages/core/src/repositories/index.ts` | Barrel de exportação |
| `packages/core/package.json` | Export `"./repositories"` adicionado |
| `desktop/src/domain/kanban/KanbanRepository.ts` | Re-exporta de `ecoforms-core` — zero breaking change |
| `desktop/types/index.ts` | `Interessado` agora vem de `ecoforms-core` |
| `desktop/tsconfig.json` | Path mapping `ecoforms-core/repositories` adicionado |
| `mobile/www/js/adapters/MobileKanbanRepository.js` | Implementa subset de `KanbanRepository` para mobile (`findBookingTasksForUser`, `updateTask`, `insertTaskEvent`); stubs explícitos para métodos não suportados |

**Desvio do plano:** `SqliteKanbanRepository` e `SqliteManifestacaoRepository` não foram movidos fisicamente para `ecoforms-core` — o desktop usa o `SqlitePort` via Tauri (Rust `invoke`) que não existe no contexto do pacote core. Em vez disso, a **interface** foi movida para `ecoforms-core` e o mobile ganhou `MobileKanbanRepository.js` como implementação separada. Isso é arquiteturalmente mais correto — o core define o contrato, cada runtime fornece sua implementação.

---

### Fase 4 — Migração do pipeline de sync mobile ✅

**Arquivos criados/modificados:**

| Arquivo | Mudança |
|---|---|
| `mobile/www/js/sync/EventBus.js` | Reescrito: IndexedDB removido, usa `SqliteSyncEventRepository` + `sqliteAdapter` |
| `mobile/www/js/sync/EventBus.legacy.js` | Backup do original IndexedDB (preservado para rollback) |
| `mobile/www/js/adapters/MobileSchemaBootstrap.js` | `sync_device_log` adicionado ao schema |

**Mapeamento de operações:**

| Operação | IndexedDB (antes) | SQLite (depois) |
|---|---|---|
| `publish()` | `store.put()` em `syncEventQueue` IDB | `syncRepo.enqueue()` → `fila_eventos_sync` |
| `getPendingEnvelopes()` | Cursor em IDBIndex `statusSeq` | `syncRepo.getPending()` → SQL `WHERE situacao='pending'` |
| `markAsSent()` | `store.put()` + `logStore.put()` IDB | `syncRepo.markSent()` + INSERT `sync_device_log` |
| `markAsFailed()` | `store.put()` com `attempts++` | `syncRepo.markFailed()` → UPDATE SQLite |
| `_nextSeq()` | Cursor em `syncDeviceLog` IDB | `MAX(seq)` em `sync_device_log` |
| `_isProcessed()` | `index.get(eventId)` IDB | `SELECT 1 WHERE event_id = ?` |
| `dispatch()` handlers | Recebiam `(envelope, idb)` | Recebem `(envelope, sqliteAdapter)` |
| `purgeOld*()` | Cursor + delete IDB | DELETE com `datetime('now', '-N days')` |

**API pública 100% preservada** — `TransportService`, `InboundService` e `SyncAdapter` sem nenhuma alteração.

---

### Fase 5 — Port de "Tarefas de Campo" para mobile 🔲 pendente

Com repositórios compartilhados disponíveis (Fase 3), portar `MinhasTarefasCampoPage` para o mobile como tela nativa do APK:

- Adicionar `offline-first`: fila local de desfechos pendentes sincronizados quando conectividade restaurada
- Adicionar suporte a câmera via `@capacitor/camera` para anexos em intercorrências
- Essa tela passa a ser o ponto de entrada principal do perfil `campo` no mobile

**Critério de conclusão:** quando ≥80% dos acessos do perfil `campo` no mobile passarem pela tela de tarefas em vez de formulários avulsos.

---

## Alternativas consideradas

### Opção B — `SqlitePort` abstrato com IndexedDB mapeado
**Rejeitada.** IndexedDB não é SQL — mapeamento de queries relacionais para cursores de object store é frágil, não suporta JOINs reais e acumula dívida estrutural.

### Opção C — Manter divergência, adicionar geração de código
**Rejeitada.** Resolve apenas sync de schema, não elimina duplicidade de lógica de repositório.

---

## Consequências

### Positivas

- `ensure-columns.ts` (desktop) e `MobileSchemaBootstrap.js` (mobile) compartilham estrutura — divergências são detectáveis por diff
- `KanbanRepository`, `SqliteSyncEventRepository` e tipos de input definidos uma única vez em `ecoforms-core`
- `EventBus.js` opera sobre SQL puro — queries debugáveis, sem cursor API IndexedDB
- `Interessado` e demais tipos de domínio têm fonte canônica em `ecoforms-core`
- Habilita a transição do mobile de **form-centric → task-centric** (Fase 5)

### Negativas / Riscos

- **Migração de dados**: `IndexedDbMigration.js` cobre os stores principais; stores não mapeados (`syncDeviceLog`, `tbl_clientes`, `tbl_roteiros`) não são migrados — dados históricos desses stores são perdidos na transição
- **`@capacitor-community/sqlite` v8.1.0**: API sem bundler depende de `Capacitor.Plugins.CapacitorSQLite` disponível em runtime — falha silenciosa em ambiente web puro (dev server sem Capacitor)
- **Handlers do EventBus**: recebiam `db` (IDB) como segundo argumento — agora recebem `sqliteAdapter`. Handlers que usavam `db` diretamente precisam ser auditados

---

## Plano de implementação — status final

| Fase | Entregável | Status | Desvio do plano original |
|---|---|---|---|
| 1 | `SqlitePort` em `ecoforms-core` + `CapacitorSqliteAdapter` | ✅ Concluído | Plugin v8.1.0 (não v6); API direta sem bundler |
| 2 | Schema mobile + migração de dados | ✅ Concluído | `MobileSchemaBootstrap.js` separado (não `ensure-columns.ts` direto) |
| 3 | Repositórios compartilhados | ✅ Concluído | Interface movida; implementações separadas por runtime |
| 4 | `EventBus.js` migrado | ✅ Concluído | `EventBus.legacy.js` preservado; `sync_device_log` adicionado ao schema |
| 5 | Port "Tarefas de Campo" para mobile | 🔲 Pendente | — |

---

## Referências

- `packages/core/src/ports/SqlitePort.ts` — interface `SqlitePort`
- `packages/core/src/repositories/KanbanRepository.ts` — interfaces + `SqliteSyncEventRepository`
- `mobile/www/js/adapters/CapacitorSqliteAdapter.js` — adapter Capacitor
- `mobile/www/js/adapters/MobileSchemaBootstrap.js` — schema mobile
- `mobile/www/js/adapters/IndexedDbMigration.js` — migração one-shot
- `mobile/www/js/adapters/MobileKanbanRepository.js` — repositório mobile
- `mobile/www/js/sync/EventBus.js` — pipeline migrado
- `mobile/www/js/sync/EventBus.legacy.js` — backup IndexedDB
- `desktop/app/minhas-tarefas-campo/page.tsx` — modelo conceitual (Fase 5)
- `desktop/docs/FIELD_TYPE_NORMALIZATION.md` — normalização de campos
- ADR-018 — Motor de agendamentos
- ADR-051 — Commands backend
