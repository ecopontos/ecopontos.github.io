# Plano de reorganizacao — backend local, integracoes externas e SQL lusofono

**Data:** 2026-06-30
**Origem:** ADR-063, auditorias de nomenclatura SQL, codigo morto e UUID v7.
**Objetivo:** transformar os achados arquiteturais em fases pequenas, verificaveis e sem quebrar a operacao offline-first.

## Principios de execucao

- SQLite local continua sendo a autoridade operacional do CRUD.
- Backends externos entram por ports/adapters explicitos.
- UI nao chama SDK externo, query pack ou adapter de infraestrutura para fluxo sensivel.
- Tabelas fisicas novas devem ser lusofonas.
- Como o app nunca entrou em producao, renomeacoes de schema podem convergir direto para o nome canonico sem camada de compatibilidade retroativa.
- Mudancas de schema devem ser feitas por modulo, nao por varredura global.

## Fase A — Inventario executavel

**Objetivo:** criar uma linha de base mensuravel antes de renomear ou mover codigo.

### Acoes

- [x] Gerar relatorio com imports de `src/infrastructure/**` a partir de `app/**`, `components/**` e `src/interface/**`.
- [x] Gerar relatorio com nomes de tabelas nao lusofonos em `ensure-columns.ts`, query packs, Rust e migrations ativas.
- [x] Separar os achados em quatro classes: `crud-local`, `integracao-externa`, `hub-lan` e `legado/compatibilidade`.
- [x] Registrar excecoes aceitas temporariamente com prazo de remocao.

### Evidencias iniciais

- UI/interface ainda importa `infrastructure/container` em varios hooks.
- `useSupabaseAdmin`, `useSupabaseClient`, `FirstRunSetupModal` e `GalleryGrid` ainda conhecem Supabase diretamente.
- `src/application/persistence/sqlite/queries/service.ts` ainda referencia `tbl_service_types`, `tbl_service_slots`, `tbl_agendamentos` e `tbl_agendamento_notificacoes`.
- `geo_layers`, `sync_salt_history`, `tbl_email_config`, `tbl_configuracoes_sistema`, `tbl_suite`, `suite_fts` e `app_config` seguem como desvios de nomenclatura.

### Validacao

```bash
rg -n "src/infrastructure|@/src/infrastructure|\\.\\./.*infrastructure" app components src/interface -S
rg -n "tbl_|geo_layers|sync_salt_history|suite_fts|app_config|service_types|service_slots" scripts src src-tauri migrations -S
```

## Fase B — Consolidar nomenclatura SQL lusofona

**Objetivo:** convergir tabelas fisicas e colecoes de hub para nomes canonicos em portugues.

### Ordem recomendada

1. Service Booking:
   - `tbl_service_types` -> `tipos_servico`;
   - `tbl_service_slots` -> `janelas_agendamento`;
   - `tbl_agendamentos` -> `agendamentos`;
   - `tbl_agendamento_notificacoes` -> `notificacoes_agendamento`.
2. Configuracoes:
   - `tbl_configuracoes_sistema` -> `configuracoes_sistema`;
   - `tbl_email_config` -> `configuracao_email`;
   - avaliar fusao ou rename de `app_config`.
3. Sync security:
   - `sync_salt_history` -> `historico_sal_sync`.
4. Geo:
   - `geo_layers` -> `camadas_geo`.
5. Suite auxiliar:
   - revisar se `tbl_suite` ainda e necessario;
   - se mantido, convergir `suite_fts` para nome canonico coerente com `pacotes`.

### Acoes por tabela

- [x] Remover nomes nao canonicos do bootstrap de schema em `scripts/ensure-columns.ts`.
- [x] Atualizar query packs em `src/application/persistence/sqlite/queries` e `src/infrastructure/persistence/sqlite/queries`.
- [x] Atualizar repositories SQLite.
- [x] Atualizar handlers de sync e LAN.
- [x] Atualizar comandos Rust quando houver referencia direta.
- [x] Atualizar testes e fixtures afetados.
- [x] Eliminar aliases temporarios e codigo de compatibilidade, ja que nao ha base instalada para migrar.

### Validacao

```bash
npx tsc --noEmit
npm run lint
node scripts/audit-db-consistency.js
```

Quando Rust mudar:

```bash
cd src-tauri
cargo check
cargo test --lib
```

**Lote aplicado em 2026-06-30 — sync security + geo**

- `sync_salt_history` foi migrada para `historico_sal_sync` em `ensure-columns.ts`, `migrations/011_add_key_escrow.sql` e `src-tauri/src/commands/key_rotation.rs`.
- `geo_layers` foi migrada para `camadas_geo` em `ensure-columns.ts` e no query pack SQLite correspondente.
- A auditoria de arquitetura caiu de **193** para **173** referencias SQL fora da convencao, reduzindo 20 ocorrencias neste lote.

**Lote aplicado em 2026-06-30 — service booking**

- `tbl_service_types` foi migrada para `tipos_servico` em `ensure-columns.ts`, query packs SQLite, repositories locais e regras de bootstrap Rust.
- `tbl_service_slots` foi migrada para `janelas_agendamento` em `ensure-columns.ts`, query packs SQLite e repository local.
- `tbl_agendamentos` foi migrada para `agendamentos` em `ensure-columns.ts`, query packs SQLite, repositories locais e handlers de sync/LAN.
- `tbl_agendamento_notificacoes` foi migrada para `notificacoes_agendamento` em `ensure-columns.ts`, query packs SQLite e repository local.
- A auditoria de arquitetura caiu de **173** para **67** referencias SQL fora da convencao, reduzindo mais 106 ocorrencias neste lote.

**Lote aplicado em 2026-06-30 — configuracoes**

- `tbl_configuracoes_sistema` foi migrada para `configuracoes_sistema` em `ensure-columns.ts`, query packs SQLite, adapters LAN e comandos Rust de setup/sync.
- `tbl_email_config` foi migrada para `configuracao_email` em `ensure-columns.ts`, repository SQLite e comandos Rust de e-mail.
- O desvio `app_config` foi eliminado do runtime: `useNetworkParquet` e o catalogo `queries/system.ts` passaram a usar `configuracoes_sistema` com a chave `network.parquet_path`.
- A auditoria de arquitetura caiu de **67** para **24** referencias SQL fora da convencao, reduzindo mais 43 ocorrencias neste lote.

**Ajustes complementares em 2026-06-30 — geo residual + FTS**

- O modulo de queries `geo_layers.ts` foi renomeado para `camadas_geo.ts`, removendo o vazamento do nome legado na camada de interface.
- `suite_fts` foi convergida para `pacotes_fts` no bootstrap e nas consultas do inbox.
- A auditoria de arquitetura caiu de **24** para **20** referencias SQL fora da convencao.
- O residuo restante da Fase B ficou concentrado em compatibilidade explicita (`tbl_*`, `geo_layers`, `suite_fts`, `sync_salt_history`) usada apenas para transicao de bancos antigos.

**Fechamento do lote de compatibilidade em 2026-06-30**

- A decisao operacional foi convergir o schema direto para os nomes canonicos, sem manter `renameTableIfNeeded(...)`, renames legacy no `migrate-ptbr.ts` ou aliases antigos apenas para transicao do lote principal.
- `scripts/ensure-columns.ts` e `scripts/migrate-ptbr.ts` deixaram de carregar referencias a `tbl_service_*`, `tbl_agendamentos`, `tbl_agendamento_notificacoes`, `tbl_configuracoes_sistema`, `tbl_email_config`, `geo_layers`, `sync_salt_history`, `suite_fts` e `app_config` no runtime principal.
- A tela [page.tsx](/root/ecopontos.github.io/ecoforms/desktop/app/admin/exportar-mobile/page.tsx:1) tambem foi alinhada aos nomes canonicos em portugues.
- A auditoria foi ampliada para varrer SQL embutido em UI e distinguir substring/comentario de referencia real.
- A auditoria ampliada e os lotes subsequentes eliminaram o saldo residual; o estado atual e **0** referencias fora da convencao lusofona.
- O lote final convergiu `cursores_sync_lan`, removeu `tbl_suite` legado do bootstrap, alinhou scripts/testes remanescentes e zerou os desvios nominais detectados pela auditoria.
- `npx tsc --noEmit` passou, `npx vitest run src/infrastructure/sync/__tests__/lan-pull-service.test.ts src/application/visuals/__tests__/VisualUseCases.test.ts` passou, `cargo test sql_guard --lib` passou e a auditoria atualizada foi persistida em [AUDITORIA_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md](/root/ecopontos.github.io/ecoforms/desktop/docs/AUDITORIA_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md:1) com **0 achados SQL**.

## Fase C — Reduzir adapters chamados diretamente pela UI

**Objetivo:** fazer a UI depender de hooks/use cases/ports, nao de implementacoes de infraestrutura.

### Acoes

- [x] Criar hooks de aplicacao para Supabase Admin, galeria/storage e configuracao de first-run.
- [x] Mover chamadas diretas a `supabaseClient` dos fluxos de galeria, patches Kanban e sync admin para hooks/adapters dedicados.
- [x] Remover imports diretos de query packs de `src/infrastructure/persistence/sqlite/queries/**` em componentes e hooks de UI, usando catalogos da interface ou use cases.
- [x] Substituir usos diretos de `getContainer`/`getContainerAsync` na UI por hooks especificos quando o fluxo for de dominio.
- [x] Manter `getContainer` apenas em pontos de composicao ou hooks catalogados como ponte temporaria.

### Ordem recomendada

1. Supabase Admin e Storage, por risco de credencial/SDK externo.
2. First-run setup, por misturar bootstrap local, LAN e Supabase.
3. Query packs importados diretamente pela interface.
4. Hooks genericos que expoem container inteiro.

### Validacao

```bash
rg -n "supabaseClient|from ['\"]@/src/infrastructure|from ['\"].*infrastructure/container|from ['\"].*infrastructure/persistence" app components src/interface -S
npx tsc --noEmit
npm run lint
```

**Lote aplicado em 2026-06-30 — query packs fora da infraestrutura na interface**

- Os catalogos consumidos pela interface foram promovidos para `src/application/persistence/sqlite/queries`, cobrindo `forms`, `system`, `solicitacoes`, `classificacao`, `kanban`, `projetos`, `data-registry`, `tarefas_anexos`, `escalas`, `registro_dados`, `terrenos`, `camadas_geo`, `execucao_clientes`, `logistica` e `inbox_view`.
- Hooks como `lookups.ts`, `useNetworkParquet`, `useCEP`, `useSQLiteSchema`, `useDebugHealth`, `useProjectDetail`, `useSolicitacoesList`, `useClassificacaoAdmin`, `useKanban` e `useUsersByForm` deixaram de importar query packs da infraestrutura diretamente.
- A verificacao por grep em `src/interface/**` passou a retornar apenas `src/interface/hooks/utils/useContainer.ts` como ponte intencional para `src/infrastructure/container`.
- `npx tsc --noEmit` passou e `npm run lint` terminou com **0 erros / 147 warnings**. A auditoria ampla segue em **111** imports de infraestrutura na UI porque ainda contabiliza pontes de `container`, Supabase e helpers legados fora do subescopo deste lote; o saldo SQL permaneceu em **0**.

**Lote aplicado em 2026-06-30 — reducao do residual de container e adapters de suporte**

- Hooks de leitura e manutencao como `useAssignedTasks`, `useCaixasData`, `useHistoryData`, `useAnalysisData`, `useClientePerfil`, `useFormRegistryData` e `useAssignedActiveForms` deixaram de importar infraestrutura diretamente, passando a usar `useSqlite`, `useTauriQuery`, catalogos em `src/application/persistence/sqlite/queries` e use cases da camada de interface.
- Os imports remanescentes de `@/src/infrastructure/container` em `src/interface/hooks/**` foram redirecionados para a ponte `src/interface/hooks/utils/useContainer.ts`.
- `AccessFilterBuilder` e `supabaseClient` ficaram concentrados em `useAccessFilters.ts` e `useSupabaseClient.ts`, removendo chamadas diretas desses adapters na maior parte dos hooks consumidores.
- A auditoria de arquitetura caiu de **111** para **81** e, depois deste lote, para **15** imports de infraestrutura na UI; o saldo SQL permaneceu em **0**.
- `npx tsc --noEmit` passou e `npm run lint` terminou com **0 erros / 147 warnings**.
- O residual atual de Fase C ficou concentrado em utilitarios de borda (`useContainer.ts`, `useAccessFilters.ts`, `useSupabaseClient.ts`, `useCrmDataSource.ts`, `useDeviceConfig.ts` e `useDataRegistryAggregated.ts`), sem retorno de query packs ou imports diretos de `container` nos hooks consumidores.

**Fechamento da Fase C em 2026-06-30**

- `ActionBar` e `app/admin/settings/page.tsx` deixaram de importar `src/infrastructure/**` diretamente, passando a consumir hooks/utilitarios da interface e `lanFileStorage` via container encapsulado.
- As pontes finais de borda foram movidas para `src/interface/gateways`, preservando a regra de boundary que impede `src/application/**` de importar `src/infrastructure/**`.
- `node scripts/audit-architecture-boundaries.js` voltou a reportar **0** imports de infraestrutura na UI e **0** desvios SQL, tratando `src/interface/gateways/**` como bridge interno catalogado.
- `npx tsc --noEmit` passou e `npm run lint` terminou com **0 erros / 147 warnings**.

## Fase D — Classificar integracoes externas legadas

**Objetivo:** impedir que integracoes antigas parecam backend principal do app.

### Classificacao inicial

| Integracao | Classe | Autoridade operacional | Acao |
| --- | --- | --- | --- |
| PostgreSQL legado | `legado/importacao-sync` | Nao | manter comandos Rust, credenciais fora do WebView e gravacao final no SQLite local |
| Supabase Auth/Admin | `externo-admin` | Nao para CRUD local | passar por port/backend local; remover SDK direto da UI sensivel |
| Supabase Storage | `externo-storage` | Nao | encapsular em storage port; UI opera por casos de uso |
| PocketBase | `hub-lan-opcional` | Nao | manter best-effort e colecoes lusofonas |
| ViaCEP/Nominatim | `api-publica-consulta` | Nao | manter sem credencial; fallback local/erro claro |
| LAN server | `backend-local-exposto-na-rede` | Sim para dados locais do host | manter autenticado, restrito e governado pelo backend local |

### Acoes

- [x] Criar lista formal de integracoes em doc/runtime config.
- [x] Para cada integracao, declarar: finalidade, disponibilidade exigida, credencial, autoridade, fallback e dono tecnico.
- [x] Marcar integracoes obsoletas como `deprecated` com plano de retirada.
- [x] Garantir que falha externa nao invalida CRUD local ja aceito, exceto em fluxos explicitamente externos.

**Fechamento da Fase D em 2026-06-30**

- O catalogo runtime [ExternalIntegrationsCatalog.ts](/root/ecopontos.github.io/ecoforms/desktop/src/application/config/ExternalIntegrationsCatalog.ts:1) passou a ser a fonte de verdade para classificacao, status, fallback, credenciais e dono tecnico das integracoes externas/legadas.
- O registro humano [REGISTRO_INTEGRACOES_EXTERNAS.md](/root/ecopontos.github.io/ecoforms/desktop/docs/REGISTRO_INTEGRACOES_EXTERNAS.md:1) consolida a leitura operacional e marca `postgres_legacy_sync` como `deprecated` com plano explicito de retirada.
- O boundary operacional ficou explicito: nenhuma integracao catalogada bloqueia o CRUD local; apenas fluxos explicitamente externos podem falhar de forma localizada.

## Fase E — Transformar auditorias em epicos de limpeza

**Objetivo:** sair de auditorias estaticas para backlog revisavel.

### Epicos

- [x] `schema-lusofono`: Fase B concluida; auditoria SQL zerada no runtime e nos scripts/testes rastreados.
- [x] `ui-sem-infra-direta`: Fase C concluida no boundary atual; bridges internos ficaram catalogados em `src/interface/gateways` e monitorados pela auditoria.
- [x] `integracoes-classificadas`: Fase D concluida com catalogo runtime, registro documental e status `deprecated` para a sync PostgreSQL legada.
- [x] `codigo-morto-alta-confianca`: lotes 1, 2, 3 e 4 concluidos; backlog logico de codigo morto foi eliminado, restando apenas falso positivo confirmado em `src/lib/logger.ts`.
- [x] `dependencias-sem-uso`: `@tauri-apps/plugin-shell`, `@types/bcryptjs` e `@types/proj4` removidos com `tsc`/`lint` mantendo o baseline.
- [ ] `validacao-real`: cobrir instalador Windows/NSIS, LAN real, login/logout/cold start, sync externo e deep links.

**Lote aplicado em 2026-06-30 — Fase E / limpeza inicial**

- O backlog executavel da fase foi consolidado em [EPICOS_LIMPEZA_FASE_E.md](/root/ecopontos.github.io/ecoforms/desktop/docs/EPICOS_LIMPEZA_FASE_E.md:1), separando codigo morto, dependencias sem uso e validacao real.
- Os lotes 1, 2, 3 e 4 removeram vinte arquivos mortos/órfãos, cobrindo hooks antigos, wrappers, use cases, presenters, handlers, queries legadas e remanescentes substituidos por `page.client.tsx`.
- O mesmo lote removeu `@tauri-apps/plugin-shell`, `@types/bcryptjs` e `@types/proj4` do frontend desktop.
- `npx tsc --noEmit` passou e `npm run lint` fechou em **0 erros / 146 warnings**.
- O gate ampliado local tambem foi fechado em 2026-06-30: `npm test`, `node scripts/audit-db-consistency.js`, `cargo check`, `cargo test --lib`, `npm run build` e `npm run build:tauri` passaram; o binario release foi gerado em `src-tauri/target/release/app`. Com isso, resta apenas `validacao-real` fora do ambiente local.

### Regra de lote

Cada lote deve alterar um unico tema e terminar com:

```bash
npx tsc --noEmit
npm run lint
```

Adicionar conforme o risco:

```bash
npm test
node scripts/audit-db-consistency.js
npm run build
cd src-tauri && cargo check && cargo test --lib
```

## Criterio de saida

Este plano pode ser considerado concluido quando:

- nao houver CRUD local dependendo de backend externo para concluir;
- tabelas fisicas novas e migradas dos modulos priorizados estiverem em portugues;
- nao houver nomes de tabela legacy ativos no runtime atual, exceto se uma excecao tecnica futura for documentada explicitamente;
- UI nao chamar SDK externo sensivel diretamente;
- integracoes legadas tiverem classificacao explicita;
- auditorias tiverem virado epicos fechados ou pendencias assumidas.
