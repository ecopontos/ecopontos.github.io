# Epicos de limpeza — Fase E

**Data:** 2026-06-30
**Contexto:** consolidacao da Fase E do `PLANO_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md`.

## Estado atual

- `schema-lusofono`: concluido
- `ui-sem-infra-direta`: concluido
- `integracoes-classificadas`: concluido
- `codigo-morto-alta-confianca`: concluido
- `dependencias-sem-uso`: concluido
- `validacao-real`: pendente

## Codigo morto — lotes

### Lote 1 — concluido em 2026-06-30

Removidos com `npx tsc --noEmit` e `npm run lint` passando:

- `components/lan/LanStatusBadge.tsx`
- `src/interface/hooks/mutations/useSaveTipoResiduo.ts`
- `src/interface/hooks/queries/useTiposResiduo.ts`
- `src/infrastructure/storage/InMemoryStorageAdapter.ts`
- `src/infrastructure/persistence/SQLiteDBWrapper.ts`

### Lote 2 — concluido em 2026-06-30

Removidos com `npx tsc --noEmit` e `npm run lint` passando:

- `src/application/ports/SyncRepository.ts`
- `src/application/service/RealizarAgendamentoUseCase.ts`
- `src/application/task/CompleteTaskUseCase.ts`
- `src/application/widgets/SchemaDiscoveryService.ts`
- `src/domain/task/TaskEvents.ts`
- `src/infrastructure/sync/base64.ts`
- `src/infrastructure/sync/UserWidgetInboundHandler.ts`
- `src/interface/presenters/toDemandaViewModel.ts`
- `src/interface/presenters/toTaskViewModel.ts`

### Lote 3 — concluido em 2026-06-30

Removidos apos revisao manual, com `npx tsc --noEmit` passando e `npm run lint` reduzindo o baseline para `0 erros / 146 warnings`:

- `app/admin/agendamentos/slots/[id]/SlotDetailClient.tsx`
- `app/admin/service-types/[id]/EditServiceTypeClient.tsx`
- `src/application/kanban/KanbanDto.ts`

### Lote 4 — concluido em 2026-06-30

Removidos apos triagem dos itens duvidosos, mantendo apenas `src/lib/logger.ts` como falso positivo confirmado:

- `src/domain/project/Project.ts`
- `src/infrastructure/persistence/sqlite/queries/inbox.ts`
- `src/infrastructure/persistence/sqlite/queries/ouvidoria.ts`

## Dependencias sem uso

### Lote 1 — concluido em 2026-06-30

Removidas do `package.json`/`package-lock.json`:

- `@tauri-apps/plugin-shell`
- `@types/bcryptjs`
- `@types/proj4`

## Itens duvidosos remanescentes

- `src/lib/logger.ts`: falso positivo confirmado; manter.

## Gate ampliado local — concluido em 2026-06-30

- `npm test`: passou com 34 arquivos e 255 testes.
- `node scripts/audit-db-consistency.js`: passou, 0 issues.
- `cargo check`: passou.
- `cargo test --lib`: passou com 72 testes.
- `npm run build`: passou e gerou `out/`.
- `npm run build:tauri`: passou e gerou `src-tauri/target/release/app`.

## Validacao real — checklist pendente

### Windows/instalacao
- validar instalador Windows/NSIS em maquina limpa
- validar cold start apos instalacao

### Offline/auth

- login/logout/cold start
- rederivacao de chave criptografica apos restart
- fallback offline sem rede externa

### LAN/hub

- pareamento real entre duas maquinas
- pasta LAN compartilhada real
- LAN server com token invalido e token valido
- bootstrap first-run via LAN

### Sync externo

- snapshots/storage Supabase
- operacoes admin Supabase
- importacao PostgreSQL legado enquanto a superficie ainda existir

### Deep links/export

- rotas estaticas exportadas de task/modulo
- export mobile para `appdata`
- export mobile para pasta LAN

## Gate minimo por lote

```bash
npx tsc --noEmit
npm run lint
```

Gate ampliado conforme risco:

```bash
npm test
node scripts/audit-db-consistency.js
npm run build
cd src-tauri && cargo check && cargo test --lib
```
