# Auditoria de Profundidade — Module Registry

**Módulo:** Registro declarativo de módulos operacionais dinâmicos (ADR-010)
**Data:** 2026-06-26
**Escopo:** `src/domain/module/*`, `src/application/module/*`, `src/infrastructure/persistence/sqlite/SqliteModule*`, `src/infrastructure/sync/module/*`, `src/infrastructure/container/modules/ModuleContainerModule.ts`, `migrations/010_*`, `migrations/018_*`, `scripts/ensure-columns.ts`, `src/interface/hooks/queries/useModule*.ts`

---

## Veredito

Arquitetura DDD bem layerizada e tipada, **porém com falhas estruturais graves**: schema duplicado e desconectado (migrations mortas), autorização não enforceada no backend e operações de escrita não-atômicas.

**Status: não pronto para produção sem correção dos itens P0/P1.**

Severidade: **P0** Crítico (corrompe dados/segurança) · **P1** Maior (risco real em runtime) · **P2** Menor (qualidade/manutenibilidade).

---

## Progresso de Execução

| Etapa | Itens resolvidos | Data | Arquivos |
|-------|------------------|------|----------|
| **Etapa 1 — Hardening de escrita** | ✅ P1-1 · ✅ P1-2 · ✅ P1-5 | 2026-06-26 | `src/infrastructure/persistence/sqlite/SqliteModuleRepository.ts`, `src/infrastructure/persistence/sqlite/__tests__/SqliteModuleRepository.test.ts` |
| **Etapa 2 - Unificacao de schema** | OK P0-1 - OK P0-2 - OK P1-3 | 2026-06-26 | `scripts/ensure-columns.ts`, `scripts/migrate-ptbr.ts`, `src/infrastructure/sync/module/ModuleSyncHandler.ts`, `src/infrastructure/sync/__tests__/sync-protocol.test.ts` |
| **Etapa 3 - Hydration runtime** | ✅ P1-6 | 2026-06-26 | `src/infrastructure/persistence/sqlite/SqliteModuleRepository.ts`, `src/infrastructure/persistence/sqlite/__tests__/SqliteModuleRepository.test.ts` |
| **Etapa 4 - Identidade e versionamento** | ✅ P1-4 · ✅ P2-1 | 2026-06-26 | `src/application/module/CreateModuleUseCase.ts`, `src/application/module/UpdateModuleConfigUseCase.ts`, `src/infrastructure/persistence/sqlite/SqliteModuleRepository.ts`, `src/infrastructure/sync/module/ModuleSyncHandler.ts`, `src/infrastructure/sync/__tests__/sync-protocol.test.ts` |

**Verificação Etapa 1:** `vitest run` → 11/11 testes passam (3 novos de regressão + 8 existentes). `tsc --noEmit` sem erros nos arquivos tocados.

### Proximos passos candidatos
- **P1-6** Resolvido: `views`/`decisions` agora sao hidratados no runtime DTO a partir de `registro_visualizacoes` e `registro_decisoes`.
- **P2-2 / P2-4** Batch de catalogos e sync com conflito.

---

## P0 — Crítico

### P0-1 - Resolvido - schema unificado no bootstrap canonico

- Fonte unica de verdade para o schema SQLite local do Module Registry: `scripts/ensure-columns.ts`.
- `migrations/010_add_module_registry.sql` e `migrations/018_create_module_visual_views.sql` foram removidas porque criavam tabelas em ingles que o runtime nao consome.
- `registro_modulos` recebeu `UNIQUE` em `tipo_entidade` e indice unico em `prefix`; `permissoes_modulos` recebeu `CHECK (can_create = 0 OR can_view = 1)` e indice por `module_id`.
- `scripts/migrate-ptbr.ts` preserva os nomes fisicos canonicos consumidos pelo runtime (`profile`, `can_view`, `visual_type`, `name`, `config`, etc.) ao renomear tabelas legadas para PT-BR.
- `ModuleSyncHandler` passou a gravar `visuais_modulos` usando o mesmo contrato fisico do repositorio SQLite.

### P0-2 - Resolvido - `loadRuntimeDto` enforce `can_view`

- `SqliteModuleRepository.loadRuntimeDto` retorna `null` antes de hidratar formularios, catalogos, views e decisoes quando o perfil nao tem `can_view`.
- `admin` mantem bypass explicito, consistente com a hierarquia de perfil nivel 0.
- `InMemoryModuleRepository` foi alinhado ao mesmo contrato para testes de use case.

---

## P1 — Maior

### P1-1 · `setPermissions` não-atômico
- `SqliteModuleRepository.ts:142-153`: `DELETE` seguido de loop de `INSERT`s **sem** `this.db.transaction`.
- Falha no meio do loop = permissões zeradas com substituição parcial.
- **Inconsistente** com `SqliteModuleVisualViewRepository.setDefault`, que faz uso correto de `this.db.transaction`.

### P1-2 · `save()` é SELECT-then-INSERT/UPDATE (race TOCTOU)
- `SqliteModuleRepository.ts:67-99`: dois callers concorrentes podem ambos ver "não existe" e tentar `INSERT` (a `UNIQUE`/PK estoura, mas sem tratamento).
- Deveria ser `INSERT ... ON CONFLICT(id) DO UPDATE` (UPSERT atômico).
- Mesmo anti-padrão em `SqliteModuleVisualViewRepository.save`.

### P1-3 - Resolvido - constraints restauradas no DDL runtime

- `registro_modulos.tipo_entidade` agora e `UNIQUE`.
- `registro_modulos.prefix` agora possui indice unico canonico.
- `permissoes_modulos` agora possui `CHECK (can_create = 0 OR can_view = 1)`.
- A PK composta `(module_id, profile)` foi mantida como decisao canonica do runtime.

### P1-4 - Resolvido - geracao de ID documentada e testada

- `CreateModuleUseCase` gera IDs via `uuidv7()` e o teste de use cases fixa esse contrato com mock deterministico.
- O schema canonico continua sem default para `id`; o banco nao gera identificador sozinho.

### P1-5 · `criado_em` sobrescrito silenciosamente no INSERT
- `SqliteModuleRepository.ts:79`: o INSERT usa `datetime('now')` para `criado_em`, **descartando** o `module.criado_em` definido por `CreateModuleUseCase` (`new Date().toISOString()`).
- O objeto in-memory diverge do que está no banco.
- No UPDATE, `criado_em` é (corretamente) preservado por não constar do `SET`.

### P1-6 - Resolvido - views e decisions hidratados no runtime DTO

- `SqliteModuleRepository.loadRuntimeDto` agora consulta `registro_visualizacoes` e `registro_decisoes` quando o config referencia `view_id` e `decision_id`.
- `definition` deixa de ser `null` e passa a carregar o payload canonico do registro correspondente; ids ausentes continuam mapeando para `null`.

---

## P2 — Menor

| # | Item | Localização |
|---|------|-------------|
| P2-1 | ✅ Resolvido - `config_version` incrementa em updates de config/metadata/permissões e é persistido no SQLite. | `CreateModuleUseCase.ts`, `UpdateModuleConfigUseCase.ts`, `SqliteModuleRepository.ts`, `ModuleSyncHandler.ts`, `sync-protocol.test.ts` |
| P2-2 | N+1 no load de data-catalogs: loop com `SELECT * FROM registro_dados WHERE tipo = ?` por catálogo. Deveria usar batch `IN (...)` como já faz para forms. `SELECT *` também retorna colunas não delimitadas. | `SqliteModuleRepository.ts:194-206` |
| P2-3 | Erros de domínio genéricos (`new Error('Módulo não encontrado')`) — não tipificados, difíceis de distinguir de erros de infra na camada de interface. | `PublishModuleUseCase.ts`, `ArchiveModuleUseCase.ts`, `UpdateModuleConfigUseCase.ts` |
| P2-4 | `ModuleSyncHandler.onPublicado` usa `INSERT OR REPLACE` — sobrescrita cega que descarta drafts locais. Sem detecção de conflito (o mecanismo `sync_status` existe para visual views mas é ignorado aqui). | `ModuleSyncHandler.ts` |
| P2-5 | `unregister()` é no-op documentado. Aceitável para lifetime do processo, mas problemático para isolamento de testes e hot-reload. | `ModuleSyncHandler.ts` |
| P2-6 | `safeJsonParse` engole erro de parse retornando o fallback (`{}`/`null`) sem log. Config corrompido vira silenciosamente vazio — diagnóstico difícil. | `SqliteModuleRepository.ts:30-33` |

---

## Pontos fortes

- **DDD bem layerizado** e idiomático ao codebase: `domain` (interfaces) → `application` (use cases) → `infrastructure` (repositórios + DI) → `interface` (hooks React).
- **Separação de tipos correta:** `ModuleRegistry` (entidade persistida) × `ModuleRuntimeDto` (payload hidratado para runtime).
- Queries **parametrizadas** em todo lugar (sem injeção de SQL); parsing JSON **defensivo**.
- **Batch** real no load de forms (`IN (...)`, linhas 168-190) — padrão correto.
- Use cases **finos e single-responsibility**, bem conectados no `ModuleContainerModule`.
- **Bootstrap idempotente** (`CREATE TABLE IF NOT EXISTS`).
- **Testes existem** (`src/test/fakes/__tests__/ModuleUseCases.test.ts`) cobrindo create/publish/list/runtime em repos em memória.
- Migração (mesmo morta) define índices sensatos.

---

## Recomendacoes (ordem de prioridade)

1. **Batch na query de data-catalog (P2-2):** usar `IN (...)`; substituir `SELECT *` por lista de colunas.
2. **Sync com consciencia de conflito (P2-4):** reusar `sync_status` em vez de `INSERT OR REPLACE` cego.

---

## Mapa de arquivos auditados

| Camada | Arquivo |
|--------|---------|
| Domain | `src/domain/module/ModuleRegistry.ts`, `src/domain/module/ModuleRepository.ts` |
| Application | `src/application/module/{Create,Publish,Archive,List,GetRuntime,UpdateConfig}ModuleUseCase.ts` |
| Infra — persistência | `src/infrastructure/persistence/sqlite/SqliteModuleRepository.ts`, `SqliteModuleVisualViewRepository.ts`, `queries/modules.ts` |
| Infra — sync | `src/infrastructure/sync/module/ModuleSyncHandler.ts` |
| Infra — DI | `src/infrastructure/container/modules/ModuleContainerModule.ts` |
| Interface | `src/interface/hooks/queries/useModuleRuntime.ts`, `useModules.ts` |
| Schema | `scripts/ensure-columns.ts`, `scripts/migrate-ptbr.ts` |
| Testes | `src/test/fakes/__tests__/ModuleUseCases.test.ts`, `src/application/views/__tests__/ModuleDashboardUseCases.test.ts` |