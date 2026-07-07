# Levantamento: Simplificação do Backend (2026-07-07)

> Levantamento completo do backend do monorepo ecoforms com o objetivo de **simplificar sem perder funcionalidade e sem mudar o paradigma** (local-first + event sync criptografado via Supabase Storage). Três frentes de análise: camadas Clean Architecture do desktop, backend Rust/scripts/servidores auxiliares, e sistema de sync/mobile/packages-core.

## Sumário executivo

| Área | Tamanho medido |
|---|---|
| Desktop TS (`desktop/src`) | 499 arquivos, ~40.400 linhas (domain 3.090 / application 5.669 / infrastructure 13.214 / interface 10.003) |
| Rust (`desktop/src-tauri/src`) | 34 arquivos, 8.174 linhas, **63 comandos Tauri registrados** |
| Sync mobile (`mobile/www/js/sync`) | 2.685 linhas |
| `packages/core` | 1.765 linhas |
| Legados na raiz do `ecoforms/` | ~9.000+ linhas mortas |

Conclusão geral: **é possível remover ~9-11 mil linhas de código morto comprovado sem tocar em funcionalidade**, e reduzir substancialmente a superfície de manutenção terminando a migração ADR-014 (packages/core) e consolidando boilerplate. O paradigma não muda.

---

## 1. Código morto comprovado (remoção zero-risco)

### 1.1 Regressão da ADR-057 (o "commit do zip")

O commit de 2026-06-24 ("Adicionar pasta ecoforms com conteúdo do zip enviado") **desfez a limpeza já executada pela ADR-057 em 2026-06-17** (que havia movido esses itens para `archive/`). Voltaram para a raiz do `ecoforms/`:

| Item | Linhas | Evidência de morte |
|---|---|---|
| `src/` (backend hexagonal paralelo) | 2.140 | Zero imports a partir de `desktop/` ou `mobile/`; fora dos workspaces do `package.json` raiz; contém a 3ª cópia do `HandlerRegistry` (564 linhas) |
| `logisticahtml/` | ~3.600 (sem contar sql-wasm.wasm) | Ferramenta browser standalone; nenhuma referência em código; ADR-057 já a havia arquivado |
| `server.js` | 142 | Express que serve pasta `www/` **que não existe** na raiz; nenhum `package.json` o referencia |
| `app/login/page.tsx` | 252 | Não há `next.config` na raiz (o único é `desktop/next.config.ts`) |
| `default/vitest.config.js` | 3 | Config stray, listada explicitamente na ADR-057 |
| `meu-supabase-mcp/` | ~120 | Autodescrito "Minimal MCP **test** server"; POC com bug latente (`mcp-server.js:82-84`); fora dos workspaces |

### 1.2 Dentro dos workspaces vivos

- **4 comandos Tauri com 0 referências no frontend** (grep por nome em todo `desktop/**/*.{ts,tsx}`): `db_execute_batch`, `network_write_parquet`, `supabase_admin_status`, `migrate_smtp_password` (migração one-shot já cumprida). Registrados em `lib.rs:378-442`.
- **5 use cases órfãos** em `desktop/src/application/views/ViewUseCases.ts:100-258` (~160 linhas): `CreateModuleDashboardUseCase`, `UpdateModuleDashboardUseCase`, `DeleteModuleDashboardUseCase`, `UpdateModuleDashboardWidgetsUseCase`, `GetModuleDashboardDataUseCase` — não importados por ninguém fora do próprio teste; o container só instancia os 4 getters.
- **Ruído no sync mobile**: `mobile/www/js/sync/test-*.mjs` (310 linhas) e `EventBus.legacy.js` (297 linhas, legado explícito).

### 1.3 Pendentes de confirmação (NÃO remover ainda)

- **Sync PostgreSQL legado** (~1.375 linhas Rust: `commands/legacy_sync.rs` 669 + `sync_roteiros.rs` 237 + `sync_residuos.rs` 205 + `sync_pesagens.rs` 264; mais `useLegacySyncData.ts` e as páginas `app/admin/legacy/` 503 + `app/admin/legacy-sync/` 440). Já marcado `deprecated` com plano de retirada em `desktop/docs/REGISTRO_INTEGRACOES_EXTERNAS.md`, **mas falta confirmar que a importação legada não roda mais em produção**.
- **PocketBase** (`desktop/src/infrastructure/pocketbase/`, 285 linhas, desligado por padrão via `getPocketBaseConfig().enabled`): **decisão 2026-07-07 — MANTER** (POC em andamento, ver `POC_POCKETBASE_OFFLINE_FIRST.md`).
- `CrmSnapshotPublisher.ts`: usado só em `container.ts` (fire-and-forget no boot); domínios `crm/`/`client/` já foram removidos — avaliar junto com a decisão do PocketBase/CRM.

---

## 2. Sync: 3 HandlerRegistry divergentes (maior fonte de risco)

A migração ADR-014 para `packages/core` **parou no meio**: o mobile já consome o core em runtime (bundle `mobile/www/js/ecoforms-core.js` gerado por `mobile/scripts/build-core.js`; shims de 2-7 linhas para `stableStringify`, `ConflictResolver`, `CycleCircuitBreaker`, `EventEnvelope`), mas o **desktop mantém cópias locais "⚠️ ESPELHO"**.

| Cópia | Linhas | Tipos de evento |
|---|---|---|
| `desktop/src/infrastructure/sync/HandlerRegistry.ts` | 542 | 33 |
| `mobile/www/js/sync/HandlerRegistry.js` | 431 | **47** |
| `src/infrastructure/sync/HandlerRegistry.ts` (raiz, morto) | 564 | — |

Divergências reais já instaladas:
- O mobile trata **14 tipos de evento que o desktop não registra** (`suite.*`, `client.*`, `module.publicado/arquivado`, `crm.coleta.registrada`, `ecoponto.remocao.agendada`, `org.config.atualizado`, `task.movida`).
- Nomenclatura divergiu: desktop usa `pacotes.aprovada`/`task.criada`; core/mobile usam `suite.aprovada`/`demanda.tarefa.criada`.
- `desktop/src/infrastructure/sync/EventEnvelope.ts` (141 linhas) redeclara `EcoFormsEventTypes` inteiro em vez de importar de `packages/core/src/sync/EventEnvelope.ts` (217 linhas, canônico).

**Recomendação**: unificar a lista canônica de `EcoFormsEventTypes` no core; trocar o espelho desktop por import do core; extrair a tabela de tipos+payloads do HandlerRegistry para o core, deixando em cada plataforma só o binding de I/O. Isso reduz 3 registries mantidos à mão para 1 fonte + 2 bindings.

O que já está bom: os "miolos" puros (`SyncEventIndexCore`, `ConflictResolver`, `EventEnvelope`, schemas JSON) já vivem no core e são importados por ambos os lados onde a migração foi concluída.

---

## 3. Boilerplate consolidável (desktop/src)

### 3.1 Repositories (28 implementações Sqlite, nenhuma classe base)

- **21 repos** reimplementam `findAll` idêntico (`SELECT ... ORDER BY ... .map(rowToEntity)`).
- **12 repos** repetem o mesmo upsert manual: `SELECT id FROM <tabela> WHERE id = ? LIMIT 1` → INSERT ou UPDATE. Exemplo canônico: `SqliteTipoResiduoRepository.ts:52-70`, onde a mesma query SELECT é repetida literalmente 4x no arquivo.
- **~7 repos de catálogo são quase clones** (só muda tabela/colunas): `SqliteTipoResiduoRepository`, `SqliteTipoPrazoRepository`, `SqliteSetorRepository`, `SqliteHierarquiaPerfilRepository`, `SqliteEmailConfigRepository`, `SqliteNotificacaoSolicitanteRepository`, `SqliteExecucaoClienteRepository`.
- Inconsistência de organização: parte do SQL mora em `persistence/sqlite/queries/` (27 arquivos), parte inline nos repos.

**Recomendação**: `BaseSqliteRepository<Entity, Row>` ou ao menos um helper `upsertById()` compartilhado.

### 3.2 Use cases passthrough (~15 classes)

Classes com um único `execute()` que só delega ao repository, sem lógica de domínio — o próprio CLAUDE.md já recomenda chamar o repo direto nesses casos:

- `application/decisions/DecisionUseCases.ts` — **todas as 5 classes** (41 linhas de puro passthrough)
- `application/views/ViewUseCases.ts:68-98` — os 4 getters (`GetViewUseCase`, `GetActiveViewsUseCase`, `GetViewsByModuleUseCase`, `GetViewsByPerfilUseCase`)
- `ListModulesUseCase`, `GetModuleRuntimeUseCase`, `ListTypesUseCase`, `ListAgendamentosUseCase`, `ListUsersUseCase`, `ListTasksByProjectUseCase`

Contraexemplos (manter — têm lógica real): `ListServiceTypesUseCase` (checa admin + setores), `CountByTypeUseCase` (agrega), e os `Create/Move/Accept/Close*` que emitem eventos.

### 3.3 container.ts (674 linhas, 2º maior arquivo do projeto)

Wiring 100% manual: ~155 linhas de imports, interface `Container` com ~60 campos, `buildContainer()` de ~210 linhas, e um `return` que re-lista ~60 propriedades. Cada novo repo/use case exige editar 3 lugares. O padrão para quebrar já existe no próprio projeto (`container/modules/ModuleContainerModule.ts`) — só foi aplicado a um domínio.

### 3.4 Registries in-memory

`WidgetRegistry` (47 linhas) e `ActionRegistry` (230 linhas) duplicam o padrão "Map global + register com warn de duplicata + getAvailable filtrado por role/VisibilityRule" — consolidável num `createRegistry<T>()` genérico. `ViewRegistry` e `DecisionRegistry` (entidades, 63 e 71 linhas) duplicam a serialização JSON coluna-a-coluna (`fromRow`/`toRow`).

Nota de nomenclatura: "Registry" tem 3 significados no projeto (entidade-config em DB, tabela genérica `registro_dados`, Map in-memory) — sem sobreposição funcional, mas confunde.

---

## 4. ensure-columns.ts e Rust

### 4.1 `desktop/scripts/ensure-columns.ts` (2.453 linhas)

- Uma única função `ensureColumns()` de ~2.360 linhas, dividida por comentários-banner em ~20 seções.
- **94 `CREATE TABLE IF NOT EXISTS` + 101 `ALTER TABLE ADD COLUMN ... .catch(() => {})`**.
- Os 101 ADD COLUMN **contradizem o cabeçalho do próprio arquivo** ("Banco novo — sem shims de ALTER TABLE"): como o banco nasce dos CREATEs, a maioria é redundante, e o `.catch(() => {})` engole erros reais silenciosamente.

**Recomendação**: fundir cada ADD COLUMN na definição do CREATE TABLE correspondente, eliminar os guards, e modularizar por domínio.

### 4.2 Rust — o que está bem e o que não está

- **`sql_guard.rs` (384 linhas, 18 testes) está bem feito** — sanitização centralizada com parsing real (strip de comentários/strings, single-statement, extração de tabela-alvo). NÃO é alvo de simplificação.
- Única duplicação real em `database.rs` (1.166 linhas): a constante `FORBIDDEN_COLUMNS` repetida 2-3x. A parte mais barroca são as 6 listas `BOOTSTRAP_*_TABLES` acopladas ao ensure-columns.
- Peso relevante em LAN (~1.900 linhas em 13 arquivos) e no sync legado (~1.375 linhas, ver §1.3).

---

## 5. Docs desatualizadas (corrigir)

- **`CLAUDE.md`**: ainda documenta `sync/_deprecated/` e `ports/_deprecated/` (StorageSync, OfflineQueue, indexeddb) — **não existem mais em lugar nenhum**.
- **`desktop/docs/BACKEND_NAO_EXPOSTO.md`**: diz "35 comandos registrados" (são 63) e classifica `get_session` como sem-invoke (há 1 `invoke('get_session')` real no frontend).

---

## 6. Plano de execução recomendado (fases)

| Fase | Escopo | Risco | Estimativa |
|---|---|---|---|
| **1** | Remoção de código morto (§1.1 + §1.2) | Zero (já sancionado pela ADR-057; 0 imports confirmados) | ~9-11 mil linhas |
| **2** | Terminar ADR-014: desktop importa EventEnvelope/EcoFormsEventTypes do core; extrair tabela de handlers para o core | Médio (coração do sync; exige unificar nomenclatura de eventos antes) | -600+ linhas, elimina divergência |
| **3** | BaseSqliteRepository/upsertById; remover use cases passthrough; quebrar container.ts em módulos; createRegistry genérico | Baixo-médio (refactor mecânico com testes) | -1.500+ linhas |
| **4** | ensure-columns.ts (fundir ADD COLUMNs) + corrigir CLAUDE.md e BACKEND_NAO_EXPOSTO.md | Baixo | -100+ linhas, remove mascaramento de erros |

**Gate de verificação por fase**: `npm run typecheck:desktop`, `npm run test:desktop`, `npm run test:mobile`, `cargo check` + `cargo test` em `desktop/src-tauri`. Nenhuma remoção sem grep confirmando 0 referências.

**Fora de escopo (preserva o paradigma)**: arquitetura de eventos criptografados via Supabase Storage, auth local-first com Supabase Auth paralela, RBAC em Rust, e a existência de pipelines separados desktop (TS/Tauri) e mobile (JS/Capacitor) — a duplicação entre eles se resolve pelo `packages/core`, não pela fusão dos runtimes.

## Decisões registradas (2026-07-07)

- Sync PostgreSQL legado: **manter até confirmação** de que a importação legada não roda mais em produção.
- PocketBase: **manter** (POC em andamento).
