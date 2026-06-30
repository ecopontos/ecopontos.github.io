# Plano de reorganizacao — backend local, integracoes externas e SQL lusofono

**Data:** 2026-06-30
**Origem:** ADR-063, auditorias de nomenclatura SQL, codigo morto e UUID v7.
**Objetivo:** transformar os achados arquiteturais em fases pequenas, verificaveis e sem quebrar a operacao offline-first.

## Principios de execucao

- SQLite local continua sendo a autoridade operacional do CRUD.
- Backends externos entram por ports/adapters explicitos.
- UI nao chama SDK externo, query pack ou adapter de infraestrutura para fluxo sensivel.
- Tabelas fisicas novas devem ser lusofonas.
- Renomeacao de tabela existente exige compatibilidade idempotente para bancos antigos.
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

- [ ] Adicionar migracao idempotente `ALTER TABLE ... RENAME TO ...` quando a tabela antiga existir e a nova nao.
- [ ] Atualizar `scripts/ensure-columns.ts`.
- [ ] Atualizar query packs em `src/application/persistence/sqlite/queries` e `src/infrastructure/persistence/sqlite/queries`.
- [ ] Atualizar repositories SQLite.
- [ ] Atualizar handlers de sync e LAN.
- [ ] Atualizar comandos Rust quando houver referencia direta.
- [ ] Atualizar testes e fixtures.
- [ ] Documentar aliases temporarios, se algum for inevitavel.

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
- A compatibilidade para bancos antigos ficou no bootstrap via `renameTableIfNeeded(...)` e no `migrate-ptbr.ts`.
- A auditoria de arquitetura caiu de **193** para **173** referencias SQL fora da convencao, reduzindo 20 ocorrencias neste lote.

**Lote aplicado em 2026-06-30 — service booking**

- `tbl_service_types` foi migrada para `tipos_servico` em `ensure-columns.ts`, query packs SQLite, repositories locais e regras de bootstrap Rust.
- `tbl_service_slots` foi migrada para `janelas_agendamento` em `ensure-columns.ts`, query packs SQLite e repository local.
- `tbl_agendamentos` foi migrada para `agendamentos` em `ensure-columns.ts`, query packs SQLite, repositories locais e handlers de sync/LAN.
- `tbl_agendamento_notificacoes` foi migrada para `notificacoes_agendamento` em `ensure-columns.ts`, query packs SQLite e repository local.
- A compatibilidade para bancos antigos ficou no bootstrap via `renameTableIfNeeded(...)` e no `migrate-ptbr.ts`.
- A auditoria de arquitetura caiu de **173** para **67** referencias SQL fora da convencao, reduzindo mais 106 ocorrencias neste lote.

## Fase C — Reduzir adapters chamados diretamente pela UI

**Objetivo:** fazer a UI depender de hooks/use cases/ports, nao de implementacoes de infraestrutura.

### Acoes

- [x] Criar hooks de aplicacao para Supabase Admin, galeria/storage e configuracao de first-run.
- [x] Mover chamadas diretas a `supabaseClient` dos fluxos de galeria, patches Kanban e sync admin para hooks/adapters dedicados.
- [ ] Remover imports diretos de query packs de `src/infrastructure/persistence/sqlite/queries/**` em componentes e hooks de UI, usando catalogos da interface ou use cases.
- [ ] Substituir usos diretos de `getContainer`/`getContainerAsync` na UI por hooks especificos quando o fluxo for de dominio.
- [ ] Manter `getContainer` apenas em pontos de composicao ou hooks catalogados como ponte temporaria.

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

- [ ] Criar lista formal de integracoes em doc/runtime config.
- [ ] Para cada integracao, declarar: finalidade, disponibilidade exigida, credencial, autoridade, fallback e dono tecnico.
- [ ] Marcar integracoes obsoletas como `deprecated` com plano de retirada.
- [ ] Garantir que falha externa nao invalida CRUD local ja aceito, exceto em fluxos explicitamente externos.

## Fase E — Transformar auditorias em epicos de limpeza

**Objetivo:** sair de auditorias estaticas para backlog revisavel.

### Epicos

- [ ] `schema-lusofono`: executar Fase B por modulo.
- [~] `ui-sem-infra-direta`: executar Fase C por fluxo.
- [ ] `integracoes-classificadas`: executar Fase D.
- [ ] `codigo-morto-alta-confianca`: remover arquivos inteiros listados na auditoria em lotes pequenos.
- [ ] `dependencias-sem-uso`: testar remocao de `@tauri-apps/plugin-shell`, `@types/bcryptjs`, `@types/proj4` quando o gate passar.
- [ ] `validacao-real`: cobrir instalador Windows/NSIS, LAN real, login/logout/cold start, sync externo e deep links.

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
- desvios restantes estiverem documentados como compatibilidade ou excecao tecnica;
- UI nao chamar SDK externo sensivel diretamente;
- integracoes legadas tiverem classificacao explicita;
- auditorias tiverem virado epicos fechados ou pendencias assumidas.
