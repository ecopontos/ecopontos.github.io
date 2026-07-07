# Backend pronto, não exposto no frontend

> Auditoria em 2026-06-02 - Re-verificado e corrigido em 2026-06-02 (pós-ADR-051).
> Re-auditoria em 2026-06-03: corrigidos gaps de documentação, adicionado `demanda_encerrar`,
> esclarecido estado de `useVisualViewMutations` e dead code Rust.
> **Varredura UI por módulo em 2026-06-03 (ADR-055):** 9 módulos verificados. 1 gap corrigido
> (PainelCaixas: toast+refetch após `ecoponto_agendar_remocao`). 0 gaps de backend sem UI.
> Cruzamento de `src/application/**` (use cases/services/jobs) contra consumidores
> em `app/`, `components/`, `src/interface/` e `contexts/`.

## Resumo

**0 pendências.** Nenhum gap funcional - o backend está operacional e conectado. Varredura UI concluída em 2026-06-03 (ADR-055).

| # | Feature | Estado | Nota |
|---|---|---|---|
| 1 | CRUD de Views personalizadas | [OK] Container + uso direto via `c.visuals.*` | Hook `useVisualViewMutations` existe mas não é importado por nenhum componente (dead code) |
| 2 | Dashboard customizável (widgets por usuário) | [OK] Container + hook + UI presentes | - |
| 3 | `demanda_encerrar` (comando Tauri) | Registrado, sem `invoke` | Contexto histórico; ver matriz autoritativa de 2026-07-07. |

---

## 1. CRUD de Views personalizadas - [OK] RESOLVIDO

**Arquivo:** `src/application/visuals/VisualViewUseCases.ts`

Os 6 use cases (`CreateViewUseCase`, `UpdateViewUseCase`, `DeleteViewUseCase`,
`SetDefaultViewUseCase`, `CopyViewToPersonalUseCase`, `SyncPersonalViewUseCase`)
estão instanciados via `buildModuleContainer` em `container.ts` e expostos em
`container.visuals.*`.

Hook de mutations: `useVisualViewMutations` - **removido** (não existia consumo por nenhum componente).
A UI acessa `c.visuals.*` diretamente via `getContainerAsync()` (ex.: `ViewSyncAlert.tsx` usa `c.visuals.copyViewToPersonal`, `useModuleVisuals.ts` usa `c.visuals.getModuleVisuais`).

---

## 2. Dashboard customizável por usuário (widgets) - [OK] RESOLVIDO

**Arquivo:** `src/application/widgets/WidgetUseCases.ts`

Container: `widgets.{list,add,update,remove}` instanciados via `SqliteUserWidgetInstanceRepository`.
Hook: `useWidgetMutations.ts` - add/remove conectados ao container.
UI: `app/page.tsx` - painel "Personalizar" com add/remove/editMode completo via `DynamicDashboard`.

---

## 3. Comandos Tauri - estado atual

Histórico: a auditoria de 2026-06-03 registrava uma contagem de 35 comandos e uma lista parcial
de comandos chamados via `invoke`. Esse número não deve mais ser usado como estado atual.

Fonte autoritativa atual: `docs/backend/2026-07-07-tauri-command-matrix.md`.

Em 2026-07-07, o `generate_handler!` de `src-tauri/src/lib.rs` tem 63 comandos registrados:
45 classificados como `frontend-invoked`, 6 como `rust-internal`, 12 como
`reserved-documented` e 0 como `candidate-remove`.

As notas históricas abaixo continuam relevantes apenas como contexto de auditorias anteriores.

### 3b. Comandos sem invoke JS mantidos como contexto histórico

| Comando | Contexto |
|---|---|
| `get_session` | Complemento de `set_session`/`clear_session`; reservado para validação cruzada Rust/frontend na auditoria de 2026-06-03. |
| `network_write_parquet` | Export de parquet; `useNetworkParquet` já fazia probe/list, e write era feature planejada na auditoria de 2026-06-03. |
| `supabase_admin_status` | Health check para painel admin; tratado como gap de UI, não código morto, na auditoria de 2026-06-03. |
| `load_crypto_key` | Usado internamente pelo Rust na camada de sync/SMTP crypto; não requer `invoke` do JS. |
| `demanda_encerrar` | Frontend atual usa action id via DI, não invoke direto; continua registrado como Tauri command reservado/documentado. |

### 3c. Removidos do `generate_handler!` (eram duplicatas ou nunca usados)

`db_disconnect`, `db_get_path` (sem consumidor, conexão gerenciada pelo runtime),
`save_email_config`, `get_email_config` (duplicatas - hooks usam `emailConfigRepository` via DI),
`suite_approve`, `suite_reject` (duplicatas - frontend usa `ReviewSuiteUseCase`; os commands Rust bypassavam o domínio).

**Nota:** As funções Rust desses 6 comandos foram removidas dos arquivos fonte - já limpas.

---

## 4. Use cases e jobs - estado atual

### 4a. Corretamente conectados

| Caso | Caminho |
|---|---|
| `VerificarPrazosVencidosJob` | Chamado em `contexts/SyncContext.tsx:265` via import dinamico |
| `initializeActions` | Chamado em `components/ClientLayout.tsx:38` no boot |
| `EliminacaoTitularUseCase` / `ExportacaoDadosTitularUseCase` | Expostos em `/admin/users/[id]/eliminar` e `/exportar` |

### 4b. Removidos na auditoria anterior (wrappers triviais sem lógica - código morto)

Os 6 use cases abaixo eram wrappers de 3-10 linhas que apenas delegavam ao repositório.
Nenhum foi instanciado no container. Os hooks correspondentes já vão direto ao repositório
via `getContainerAsync()` - padrão correto.

- `GetEmailConfigUseCase` -> `useEmailConfig` usa `c.emailConfigRepository.get()`
- `ListExecucoesClientesUseCase` -> `useExecucaoClientes` usa `c.logisticsRepository.findExecucaoClientes()`
- `ListHierarquiaPerfisUseCase` -> `useHierarquiaPerfis` usa `c.hierarquiaPerfilRepository.findAll()`
- `ListNotificacoesSolicitanteUseCase` -> `useNotificacoesSolicitante` usa `c.notificacaoSolicitanteRepository`
- `ListTiposPrazoUseCase` -> `useTiposPrazo` usa `c.tipoPrazoRepository`
- `ListTiposResiduoUseCase` -> removido em auditorias anteriores; a listagem de tipos de resíduo segue direto pelos hooks/repositórios ativos.

---

## 5. Pendências conhecidas

> Re-verificado em 2026-06-03 (pós-ADR-055): todas as 3 pendências abaixo estão resolvidas.

| # | Item | Severidade | Estado |
|---|---|---|---|
| 1 | `useVisualViewMutations.ts` dead code | Baixa | [OK] Arquivo inexistente - já removido anteriormente |
| 2 | `demanda_encerrar` registrado sem `invoke` JS | Baixa | Resolvido como pendência funcional; continua registrado como Tauri command reservado/documentado. O frontend atual usa action id via DI, não invoke direto. Ver matriz autoritativa de 2026-07-07. |
| 3 | 6 funções Rust removidas do handler ainda no fonte | Baixa | [OK] Não encontradas no fonte - já limpas |

---

## 6. Modelo de dados: vínculo Execução/Despacho (`idDespacho`) - decisão pendente

> Identificado em 2026-06-12, durante unificação dos modais "Nova Execução" (Logística).

`sync_pesagens_externas` (`src-tauri/src/commands/sync_pesagens.rs`) casa/cria `execucao_coleta`
por `roteiro_id + date(data_execucao)`, **não** por `id_despacho`. Após sincronizar todas as
pesagens do período, grava em `execucao_coleta.id_despacho`/`codigo_despacho` os valores da
pesagem **mais recente** (`ORDER BY data_pesagem DESC LIMIT 1`) - `peso_total`/`numero_viagens`
agregam corretamente todas as pesagens do dia, mas o "despacho pai" exibido na execução é só o
último.

**Impacto**: se um roteiro tiver 2+ despachos no mesmo dia, eles são fundidos em uma única
`execucao_coleta` local; o vínculo com despachos anteriores daquele dia não fica explícito na
execução (mas fica preservado por pesagem em `execucao_pesagens.id_despacho`).

**Decisão pendente** (não bloqueia o uso atual):
- (a) manter "1 execução/dia por roteiro" como modelo aceito, documentando que
  `idDespacho`/`codigoDespacho` em `execucao_coleta` representam "o despacho mais recente do
  dia"; ou
- (b) migrar para "1 execução por despacho" - exigiria `UNIQUE` em `execucao_coleta.id_despacho`
  e nova lógica de matching/criação no sync, além de repensar como uma execução "agendada"
  criada manualmente (via `NovaExecucaoDialog`) se reconcilia com despachos que chegam depois.