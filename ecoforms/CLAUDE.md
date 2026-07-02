# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Desktop** — run from `desktop/`:

```bash
npm run dev          # Next.js dev server on port 3001 (desktop web dev only)
npm run start:tauri  # Next.js (next start -p 3001) + Tauri dev concurrently
npm run build:tauri  # next build + npx tauri build (production Tauri binary)
npm run lint         # ESLint
```

For DB schema iteration: `npx ts-node scripts/ensure-columns.ts` (também roda automaticamente no boot via `container.ts`)

**Mobile** — run from `mobile/`:

```bash
npm run serve        # dev server on :5502 serving mobile/www/
npm run build        # build CSS + concat + sync-field-css
npm run debug-mobile # build + cap sync + open Android Studio
npm run build-debug  # build + cap sync + gradlew assembleDebug (APK)
npm run test:watch   # Vitest watch mode
```

**Monorepo root** — run from repo root:

```bash
npm run desktop      # alias for desktop npm run dev
npm run mobile:serve # alias for mobile npm run serve
npm run build:mobile:debug  # alias for mobile npm run build-debug
```

## Architecture

**Monorepo** com dois workspaces de produto:

```
ecoforms0/
├── desktop/                # workspace Tauri v2 + Next.js (Clean Architecture)
├── mobile/                 # workspace Capacitor v8 + Android APK
│   ├── www/                #   web source (HTML, JS, CSS)
│   ├── android/            #   Android native project
│   ├── styles/             #   Tailwind CSS source
│   ├── scripts/            #   build scripts (concat-css, sync-field-css)
│   ├── tests/              #   Vitest tests
│   ├── capacitor.config.json
│   └── package.json
├── packages/core/          # ecoforms-core — shared lib (permissions, sync, utils)
├── supabase/               # SQL migrations
├── docs/                   # documentação consolidada
└── package.json            # orquestrador raiz (workspaces: desktop, mobile, packages/core)
```

**Desktop** — Clean Architecture:

```
desktop/
├── app/                    # Next.js App Router pages (interface layer)
├── components/             # React UI components
├── contexts/               # React contexts (AuthContext, etc.)
├── src/
│   ├── domain/             # Entities, value objects, repository interfaces
│   ├── application/        # Use cases, ports (interfaces), DTOs, mappers
│   ├── infrastructure/     # Repository implementations, sync services, adapters
│   │   ├── persistence/sqlite/   # SqliteXxxRepository via Tauri invoke
│   │   │   └── queries/          #   pre-formatted SQL queries por domínio (tarefas, projetos, logistica, manifestacoes, etc.)
│   │   ├── persistence/supabase/ # supabaseClient.ts (anon key)
│   │   ├── sync/                 # EventSyncAdapter, TransportService, InboundService, SupabaseUserSyncService
│   │   │                         # _deprecated/ — StorageSync, OfflineQueue, indexeddb (código morto arquivado)
│   │   ├── storage/              # SupabaseFileStorage (bucket wrapper)
│   │   ├── container/modules/    # ModuleContainerModule — wiring de módulos no DI container
│   │   └── config/               # device-config.ts
│   └── interface/hooks/    # Custom React hooks (queries, tauri, utils)
├── src-tauri/src/          # Rust: database.rs (query/execute layer), commands, supabase_admin.rs (HTTP real via ureq)
├── supabase/migrations/    # SQL: 01-storage-rls-v2.sql (RLS dual-auth), 02-public-profiles.sql (Fase 5)
└── scripts/                # ensure-columns.ts — schema principal (CREATE TABLE IF NOT EXISTS + ADD COLUMN + seed)
```

## Auth model

**Local custom auth primary — Supabase Auth paralela (Fases C1 + 5 implementadas).**

- Login: `invoke('db_query')` to fetch user → `invoke('verify_password')` (bcrypt in Rust)
- Após login local bem-sucedido, `AuthContext.login()` chama `supabase.auth.signInWithPassword({ email, password })` em background
- Se usuário não existe no Supabase Auth, auto-provisiona via `supabase.auth.signUp()`
- Após Supabase Auth estabelecida, `syncUsersFromSupabase()` busca `public.profiles` e faz upsert no SQLite local via `SupabaseUserSyncService`
- Falha no Supabase Auth ou no sync é **non-fatal** — login local continua funcional mesmo offline
- Logout chama `supabase.auth.signOut()` além de `invoke('clear_session')`
- Session local stored in `localStorage` (user JSON), re-validated against SQLite on reload
- `PermissionGuards` enforces role-based access on the frontend
- **Rust SessionState**: backend holds `user_id` + `perfil` in memory; every protected command re-validates against `usuarios`
- Email sintético para Supabase Auth: `{username}@ecoforms.local` (temporário até campo email real ser adicionado)
- Admin panel: `useSupabaseAdmin` hook expõe sync manual + CRUD Supabase Auth via `invoke('supabase_admin_query')` (requer `perfil=admin`)

## RBAC & Commands Dedicados

**Tabelas dinâmicas** (`scripts/ensure-columns.ts`):
- `tbl_perfis` — perfis master (admin, gerente, coordenador, encarregado, operador, campo)
- `tbl_role_hierarchy` — níveis numéricos (admin=0, gerente=1, ...)
- `tbl_permissions` — matriz de permissões seedeada no boot

**Sanitização em commands genéricos** (`database.rs`):
- `db_query`: bloqueia `SELECT` com `password_hash`
- `db_execute` / `db_execute_batch`: bloqueia `INSERT/UPDATE/DELETE` em `usuarios`, `tbl_perfis`, `tbl_role_hierarchy`, `tbl_permissions` para não-admin
- Isso força o uso de commands dedicados para mutações sensíveis

**Commands protegidos críticos** (validam sessão + permissão + logam audit):
- `demanda_aceitar` / `demanda_encerrar` — requer `activities.manage`
- `ecoponto_agendar_remocao` — requer `activities.manage`
- `set_session` / `clear_session` / `get_session` — gerenciamento de sessão Rust

## Auditoria

- `tbl_audit_log` — log de segurança local (actor_id, action, target_table, target_id, old/new values)
- `log_audit()` no Rust insere em `tbl_audit_log` + emite evento `audit.registro` na `sync_event_queue`
- `TransportService.pushPending()` envia criptografado para nuvem automaticamente
- `action_log` (existente) continua como log operacional de workflow (ActionRegistry)

## Runtime targets

Dois runtimes compartilham este codebase:

- **Desktop**: Tauri v2 + Next.js — RBAC enforced em Rust (commands protegidos validam sessão + perfil)
- **Mobile**: Capacitor v8 + Android APK — `mobile/www/` é o `webDir`; RBAC enforced **frontend-only** (sem commands Rust)

## Database

- **Tauri/desktop**: SQLite via `invoke('db_query')` / `invoke('db_execute')` Rust commands
- **Schema migrations**: `scripts/ensure-columns.ts` — única fonte de verdade do schema. Contém `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN` + seed de dados. Chamado automaticamente no boot pelo `container.ts` (`ensureColumnsIfNeeded`) e manualmente via `npx ts-node scripts/ensure-columns.ts`
- **`src-tauri/src/database.rs`**: camada de execução Rust pura — abre conexão, executa queries, não contém DDL
- A interface SQL generica aceita bootstrap sem sessao apenas para metadata/DDL e seeds idempotentes nao sensiveis; criacao de usuarios, LAN path inicial e RBAC inicial passam por comandos Rust dedicados.
- **Supabase PostgreSQL**: apenas `public.profiles` (espelho de `auth.users` para sync de usuários na Fase 5). Tráfego de dados operacionais continua via Storage.
- **`supabase_user_map`**: tabela SQLite que mapeia `local_id` ↔ `supabase_id` para sync de usuários (Fase 5)

## Supabase Storage

- Bucket: `sync-bucket` (private, dual-auth access via 8 RLS policies — 4 authenticated desktop + 4 anon mobile)
- **Active paths (desktop)**: `orgs/{orgId}/eventos/{routingId}/evt_{seq}_{id}.enc`, `orgs/{orgId}/manifests/manifest_{routingId}.json`, `shared/org_config.json`
- **Active paths (mobile / `www/`)**: `shared/users.json`, `shared/form_field_registry.json`, `shared/data_registry.json`, `shared/tasks.json`, `shared/ecoponto_caixas.json`, `shared/inbox/users/{userId}/`, `users/{userId}/images/`, `shared/adhoc/`
- **Legacy paths** (StorageSync — archived, not instantiated): `users/{deviceId}/outbox/`, `archive/YYYY-MM/`
- All uploads go through `SupabaseFileStorage` which wraps `@supabase/supabase-js` storage
- `ensureBucket()` verifies bucket access on boot before bootstrap
- RLS policies defined in `desktop/supabase/migrations/01-storage-rls-v2.sql`

## Sync system

**Active**: `EventSyncAdapter` orchestrates:
1. `StorageBootstrapService` — downloads/creates `org_config.json` on first online boot
2. `TransportService` — encrypts and pushes events to `orgs/{orgId}/eventos/{routingId}/`
3. `InboundService` — pulls remote events, checks manifest, feeds `HandlerRegistry`
4. `CryptoLayer` — AES-256-GCM via Rust; encryption key never exposed to JS
5. Offline queue — handled by `EventBus` writing to SQLite table `sync_event_queue`

**Container integration**: `LazySyncAdapter` (implements `SyncPort`) is registered in the DI `container.ts`. It delegates to `EventSyncAdapter` once configured with runtime params (`deviceId`, `routingId`) by `SyncContext`. `NullSyncAdapter` remains as a safe fallback before configuration.

**Key Derivation (PBKDF2)**:
- **Desktop**: `CryptoLayer.ts` — `deriveAndStoreKey(password, userSalt)` is called from `AuthContext.tsx` after login; the key is re-derived from the user's password using PBKDF2 (600k iterations, SHA-256, per-user salt from `usuarios.sal_sync`), kept only in memory, and any legacy `org_crypto_key` entry in `.ecoforms-keys.dat` is purged on load/logout.
- **Mobile (Capacitor)**: `mobile/www/js/sync/CryptoLayer.js` mirrors the same PBKDF2 parameters (600k iterations, SHA-256, per-user salt) for cross-platform compatibility.
- **Rust side**: `load_crypto_key` accepts the 32-byte raw key after successful login, requires a valid Rust session, and keeps the AES-256-GCM material only in backend memory.

**Legacy (archived)**: `StorageSync.ts` and related artifacts (`sync-types.ts`, `strip-to-raw.ts`, `indexeddb.ts`, `OfflineQueue.ts`, `StorageSyncPort.ts`) moved to `sync/_deprecated/` and `ports/_deprecated/`. They are excluded from compilation and no longer part of the runtime.

## Mobile Sync (mobile/www/js/sync/)

The mobile (Capacitor Android APK, `webDir: mobile/www`) uses an identical event pipeline to the desktop:

| Desktop (TypeScript) | Mobile (JavaScript) | Notes |
|---------------------|---------------------|-------|
| `CryptoLayer.ts` | `mobile/www/js/sync/CryptoLayer.js` | PBKDF2 + AES-GCM |
| `stable-stringify.ts` | `mobile/www/js/sync/stable-stringify.js` | Checksum-compatible |
| `EventEnvelope.ts` | `mobile/www/js/sync/EventEnvelope.js` | v2 format, bit-identical |
| `EventBus.ts` | `mobile/www/js/sync/EventBus.js` | IndexedDB-backed |
| `TransportService.ts` | `mobile/www/js/sync/TransportService.js` | Push to Storage |
| `InboundService.ts` | `mobile/www/js/sync/InboundService.js` | Pull from Storage |
| `Manifest.ts` | `mobile/www/js/sync/Manifest.js` | Routing manifests |
| `StorageBootstrapService.ts` | `mobile/www/js/sync/SyncBootstrap.js` | Org config bootstrap |
| `HandlerRegistry.ts` | `mobile/www/js/sync/HandlerRegistry.js` | 10 essential handlers |
| `EventSyncAdapter.ts` | `mobile/www/js/sync/SyncAdapter.js` | Orchestrator |

**SyncEventDB**: IndexedDB database with object stores: `syncEventQueue`, `syncDeviceLog`, `usuarios`, `suite`, `tbl_demandas`, `tarefas`, `data_registry`.

**AuthManager integration**: `login()` starts `SyncAdapter` with password; `logout()` stops and clears it.

**DataService integration**: `saveFormData()` publishes `ecoforms.registro.criado` events via `_publishFormEvent()`.

## packages/core (`ecoforms-core`)

Monorepo shared library at `packages/core/`, aliased as `ecoforms-core` in desktop's tsconfig/package.json and in mobile's `vitest.config.js`.

Modules:
- `ecoforms-core/permissions` — `PermissionActionRegistry`, `globalPermissionRegistry`, `UniversalAction`, `UserRole`, `ActionContext` (ADR-009)
- `ecoforms-core/sync` — `EventEnvelope` (v2 format), `ConflictResolver` (LWW+hash), `CycleCircuitBreaker` + JSON schemas for event validation (task, suite, demanda, user, client, module)
- `ecoforms-core/utils` — `stableStringify`, `uuidv7`

IDs persistidos novos devem usar UUID v7. No desktop TypeScript use `uuidv7()` de `ecoforms-core`; no Rust use `uuid_v7::uuid_v7_string()`. UUID v4 remanescente deve ficar restrito a tokens/sessoes/paths temporarios ou ser documentado como excecao.

**`PermissionActionAdapter.ts`** bridges legacy `usePermissions` hooks into `globalPermissionRegistry` via `initializePermissionRegistry()`, called at app boot.

## Domain Events

**`InMemoryDomainEventBus`** in `domain/shared/DomainEventBus.ts` — in-process pub/sub injected via DI container.

Event constants live alongside their domain:
- `domain/task/TaskEvents.ts` — `TaskArquivada`, `TaskConcluida`, `TaskMovedToInProgress`
- `domain/demanda/DemandaEvents.ts` — `DemandaEncerrada`
- `domain/suite/SuiteEvents.ts`, `domain/module/ModuleEvents.ts`, `domain/visual/ModuleViewEvents.ts`
- `domain/logistics/LogisticsEvents.ts` — eventos do módulo de logística
- `domain/ouvidoria/ManifestacaoEvents.ts` — eventos de manifestações/ouvidoria

**Handlers** (registered in `container.ts`):
- `CloseTasksOnDemandaEncerradaHandler` — cancels pending tasks when demanda closes
- `CloseDemandaOnAllTasksArchivedHandler` — closes demanda when all tasks archived
- `CloseDemandaOnAllTasksConcludedHandler` — closes demanda when all tasks concluded
- `DemandaSynchronizationHandler` — syncs demanda state on task transitions

Use cases **emit** events instead of calling sync logic inline; handlers react asynchronously.

## Module Registry (ADR-010)

`tbl_module_registry` — dynamic module definitions stored in SQLite. Each module has a `slug`, `entity_type`, `config` (forms, data_catalogs, views, decisions), `suite_config`, and RBAC permissions per profile.

- Route `/modulo/[slug]` — generic dynamic page that loads module runtime config and renders forms/views
- Use cases: `CreateModuleUseCase`, `PublishModuleUseCase`, `ListModulesUseCase`, `GetModuleRuntimeUseCase`, `UpdateModuleConfigUseCase`
- `SqliteModuleRepository` in `infrastructure/persistence/sqlite/`

## Views & Decisions Registries

- `tbl_view_registry` / `ViewRegistryRepository` — stores view definitions (context: dashboard, mapa, relatorio, modal)
- `tbl_decision_registry` / `DecisionRegistryRepository` — stores decision trees/rules per entity type and profile
- Use cases: `GetViewUseCase`, `GetActiveViewsUseCase`, `GetViewsByModuleUseCase`, `GetViewsByPerfilUseCase`, `GetDecisionUseCase`, `GetDecisionsByTargetTypeUseCase`, etc.

## Widget & Visual System

- `WidgetRegistry` — registers built-in widgets; `UserWidgetInstance` / `UserWidgetInstanceRepository` — per-user widget instances on dashboards
- `DashboardVisualResolver` — resolves widget bindings to data queries
- `SchemaDiscoveryService` + `ImplicitCalcEngine` — derive computed fields and aggregations from module schema
- `ModuleVisualView` / `ModuleVisualViewRepository` — visual view definitions attached to modules
- `VisualQueryCache` (`application/visuals/`) — TTL cache for visual query results

## Key conventions

- Supabase client (`supabaseClient.ts`) uses anon key — após login, sessão Supabase Auth é estabelecida em paralelo (`syncSupabaseAuth`), dando `auth.uid()` válido para políticas RLS authenticated
- Storage upload overload: `upload(path, data)` 2-arg OR `upload(bucket, path, data)` 3-arg — check `typeof pathOrData === 'string'` to disambiguate
- New SQLite columns must be added in `scripts/ensure-columns.ts` (CREATE TABLE IF NOT EXISTS block + ADD COLUMN guard) — the single source of truth for schema. `database.rs` is query-only — never add DDL there. (There is no separate `docs/db/schema_consolidado_corrigido.sql` reference doc in this repo — don't reference it or attempt to update it.)
- `tbl_setores` requires `descricao TEXT`, `criado_em TEXT`, `atualizado_em TEXT` — added in Fase 6 fixes
- **Do NOT use `useSQLiteQuery`/`useSQLiteMutation` directly in business hooks** — these are deprecated; use `getContainerAsync()` → repository or use case. For simple queries with no domain logic, calling the repository directly (`c.xxxRepository.findAll()`) is correct and preferred over wrapping in a trivial use case.
- `KanbanRepository` (`SqliteKanbanRepository`) encapsulates all kanban SQL — hooks must not embed raw SQL
- Domínios `client/` e `crm/` foram removidos — suas entidades foram consolidadas em `cliente/` (domínio PT-BR); rotas `app/clients/` e `app/crm/` não existem mais
- Ouvidoria UI (`app/ouvidoria/`) foi removida e substituída pelo módulo de Manifestações (`app/manifestacoes/`)
- Crypto Tauri command `load_crypto_key` é invocado pelo frontend apenas no login bem-sucedido, para entregar ao backend a chave PBKDF2 recém-derivada; o comando valida a sessão Rust antes de aceitar a chave e a mantém apenas em memória. (`encrypt_payload`/`decrypt_payload` e todo o subsistema `CentralCrypto` foram removidos na simplificação criptográfica de 2026-06-13)
- `docs/BACKEND_NAO_EXPOSTO.md` — gap tracker: lista os 2 gaps reais não conectados (Views CRUD mutations, Dashboard widget UI) e documenta commands intencionalmente registrados mas ainda sem UI (`get_session`, `network_write_parquet`, `supabase_admin_status`)


---

# Reversa

> Framework de Engenharia Reversa instalado neste projeto.

## Como usar

Digite `/reversa` para ativar o Reversa e iniciar ou retomar a análise do projeto.

## Comportamento ao ativar

Quando o usuário digitar `/reversa` ou a palavra `reversa` sozinha em uma mensagem:

1. Ative o skill `reversa` disponível em `.claude/skills/reversa/SKILL.md`
2. Se não encontrar em `.claude/skills/`, tente `.agents/skills/reversa/SKILL.md`
3. Leia o SKILL.md na íntegra e siga exatamente as instruções do Reversa

## Regra não-negociável

Nunca apague, modifique ou sobrescreva arquivos pré-existentes do projeto legado.
O Reversa escreve **apenas** em `.reversa/` e `_reversa_sdd/`.
