# ADR-078 — Auditoria do Contrato Frontend ↔ Backend Local

**Status:** Decidido
**Data:** 2026-06-24
**Relacionado:** ADR-076 (auditoria backend local), ADR-077 (auditoria complementar sync), ADR-075 (sessão autenticada e ingestão confiável)

---

## Contexto

O ADR-076 e o ADR-077 auditaram o backend local (schema SQLite, commands Rust, queries, repositórios, sessão/auth e sync) sob a ótica do próprio backend. Esta auditoria complementar foi realizada sob a **ótica do contrato** entre o frontend (Next.js + React Query) e o backend local (Tauri + Rust + SQLite), com o objetivo de responder a uma pergunta simples:

> *O frontend conhece bem o backend local?*

Para responder, foram cruzados de forma sistemática três inventários:

- **Backend:** 38 commands Rust registrados em `tauri::generate_handler!` em `src-tauri/src/lib.rs:97-136`.
- **Frontend invoke:** 44 call sites de `invoke()` com literal de comando, em 33 comandos distintos, distribuídos por `src/`, `lib/`, `components/`, `contexts/`, `app/`, `scripts/`.
- **Persistência FE:** 29 arquivos de queries em `src/infrastructure/persistence/sqlite/queries/` e ~35 repositórios em `src/infrastructure/persistence/sqlite/`, consumindo ~75 tabelas/views/virtual tables.

A análise buscou, em ordem: (a) comandos invocados pelo FE que não existem no BE; (b) comandos registrados no BE que não têm nenhum caller no FE; (c) divergências de tipos/parâmetros entre assinaturas Rust e chamadas TS; (d) divergências de schema entre o que queries/repositórios assumem e o que `scripts/ensure-columns.ts` cria de fato; (e) inconsistências arquiteturais nos wrappers de `invoke`.

---

## Veredicto

O contrato é **razoavelmente coeso**: nenhum `invoke` aponta para um comando inexistente, e os parâmetros batem com as assinaturas Rust em todos os call sites auditados. Porém há **2 bugs ativos de schema (CRÍTICO)**, **5 commands órfãos no backend (ALTO)** e uma série de divergências estruturais que o ADR-076 não cobriu porque olhava só para o lado Rust.

### Pontos fortes confirmados

| Área | Veredicto |
|---|---|
| Cobertura de commands | 100% dos `invoke()` do FE resolvem para um comando registrado no BE |
| Paridade de parâmetros | Todos os 44 call sites passam argumentos compatíveis com as assinaturas Rust (camelCase ↔ snake_case via serialização Tauri) |
| Orphanos Rust | Zero — todo `#[tauri::command]` está registrado no `generate_handler!` |
| Estado gerenciado | States (`DbState`, `SessionState`, `CryptoState`, `SmtpCryptoState`, `SupabaseAdminState`) são todos injetados pelo Tauri, não pelo FE |
| Repositórios | ~35 repositórios passam por `SqlitePort` (adapter pattern) — separação limpa |
| Sem Tauri v1 | Zero imports de `@tauri-apps/api/tauri`; tudo em v2 (`@tauri-apps/api/core` + plugins) |

---

## Achados

### CRÍTICO (bugs ativos — provavelmente quebrando features hoje)

#### C1 — Query `KANBAN_TAREFAS` referencia tabela `comentarios` inexistente

**Arquivo:** `src/infrastructure/persistence/sqlite/queries/kanban.ts:11`
**Problema:** A subconsulta `(SELECT COUNT(*) FROM comentarios c WHERE c.tarefa_id = t.id)` assume a tabela `comentarios`, mas o schema só cria `tarefas_comentarios` (`scripts/ensure-columns.ts:1430`). Em SQLite, consultar uma tabela inexistente **lança erro**, não retorna 0 — ou seja, todo carregamento do Kanban deve falhar a query ou ser capturado por fallback silencioso.
**Agravante:** o restante do arquivo e os repositórios usam `tarefas_comentarios` corretamente; este é um typo isolado na primeira query.
**Correção:** Trocar `comentarios` por `tarefas_comentarios` (e o alias `c` se mantém).

#### C2 — Query `DATA_REGISTRY_TIPOS_COUNT` referencia tabela `data_registry` inexistente

**Arquivo:** `src/infrastructure/persistence/sqlite/queries/data-registry.ts:26`
**Problema:** A consulta `SELECT tipo, COUNT(*) as count FROM data_registry GROUP BY tipo` assume a tabela `data_registry`, mas o schema só cria `registro_dados` (`scripts/ensure-columns.ts:1160`). As outras 5 queries do mesmo arquivo usam `registro_dados` corretamente — divergência interna ao próprio arquivo.
**Correção:** Trocar `data_registry` por `registro_dados`.

---

### ALTO (corrigir antes de produção)

#### A1 — `get_session` nunca é chamado pelo frontend

**Arquivos:** `contexts/AuthContext.tsx` (usa `set_session` em `:105` e `clear_session` em `:74`, mas nunca `get_session`)
**Problema:** A sessão Rust é **escreve-e-esquece** do ponto de vista do FE: depois de `set_session` no login, o FE mantém o estado só em memória JS via `AuthContext`. Em restart do app (recarregar janela, reabrir desktop) a sessão Rust persiste em `SessionState` mas o FE perde a referência, forçando novo login — ou pior, abrindo brecha para comandos não-protegidos serem chamados com a sessão Rust "ainda logada" que o FE acha que não está.
**Agravante:** torna o item A4 do ADR-076 (TTL de sessão) parcialmente inócuo: de nada serve expirar `validated_at` se o FE nunca pergunta.
**Correção:** `AuthContext` deve chamar `get_session()` no boot do app; se vier `Some`, hidratar o estado JS a partir dele. Em conjunto com A4 do ADR-076, o FE passa a re-validar periodicamente.

#### A2 — Command `demanda_encerrar` é morto; action homônima usa path JS

**Arquivos:** `src-tauri/src/commands/actions.rs:44` (command) vs `src/application/actions/builtin/demanda.actions.ts:38` (action FE)
**Problema:** O command Rust `demanda_encerrar` existe, valida sessão/permissão e emite auditoria + evento sync — mas a action FE de mesmo id **não o invoca**. Em vez disso, ela chama `ctx.container.demandas.close.execute(...)` (UseCase JS puro) e grava só em `log_acoes` (`demanda.actions.ts:57`). Resultado:
- Perde-se o registro em `log_auditoria` (o log estruturado do Rust);
- Não é emitido o evento sync correspondente;
- A violação de política de conclusão fica a cargo do UseCase JS, fora do enforcement Rust.

Contraste direto: a action `demanda_aceitar` (mesmo arquivo, linha 21) faz o caminho certo via `ctx.commands.invoke("demanda_aceitar", ...)`.
**Correção:** Substituir a chamada do UseCase JS por `ctx.commands.invoke("demanda_encerrar", { id: demanda.id })` — ou decidir explicitamente qual é o path canônico e remover o outro. Se mantido o path JS, remover o command Rust do `generate_handler!`.

#### A3 — `network_write_parquet` sem nenhum caller

**Arquivo:** `src-tauri/src/network.rs:168`
**Problema:** O command está registrado (`lib.rs:115`) mas o único hook de rede (`src/interface/hooks/utils/useNetworkParquet.ts`) só chama `network_probe_path` e `network_list_parquet`. A escrita de parquet pela rede está disponível no BE mas sem UI.
**Correção:** Ou ligar a UI de export (provavelmente em `app/admin/exportar-mobile/`) ou remover do handler para reduzir superfície de ataque.

#### A4 — `supabase_admin_status` sem nenhum caller

**Arquivo:** `src-tauri/src/supabase_admin.rs:327`
**Problema:** Mesmo após o ADR-076 item M8 recomendar proteção por sessão+admin, o command continua sem nenhum caller no FE. A página de admin de Supabase (`useSupabaseAdmin.ts`) só usa `supabase_admin_query`. Status exposto no backend mas nunca exibido.
**Correção:** Decidir se a UI de status é necessária; se não, remover do handler. Se sim, expor em `app/admin/`.

#### A5 — `migrate_smtp_password` sem nenhum caller

**Arquivo:** `src-tauri/src/commands/email.rs:237`
**Problema:** Command de migração de senha SMTP está registrado mas nunca disparado pela UI. Possivelmente pensado para rodar manualmente uma única vez.
**Correção:** Ou expor como botão one-shot em `app/admin/email/` (com proteção admin), ou converter em script de maintenance (fora do `generate_handler!`).

---

### MÉDIO (corrigir antes de produção ou aceitar risco documentado)

#### M1 — Pasta `migrations/` está desatualizada e desalinhada com o schema real

**Arquivos:** `migrations/010_add_module_registry.sql`, `018_create_module_visual_views.sql`, `019_user_widget_instances.sql`, `012_idRota_uuid.sql`
**Problema:** A pasta `migrations/` (arquivos 007–021, com buracos) cria tabelas em **inglês** que **não batem** com o que repositórios e queries efetivamente consomem:

| Migration cria | FE espera (e `ensure-columns.ts` cria) |
|---|---|
| `module_registry` / `module_permissions` | `registro_modulos` / `permissoes_modulos` |
| `module_visual_views` | `visuais_modulos` |
| `user_widget_instances` | `instancias_widgets_usuario` |
| `view_registry` (ALTER em 019) | `registro_visualizacoes` |
| `rotas` / `pjuridicas` (012) | Não referenciadas em nenhum lugar do FE atual |

A fonte de verdade canônica é `scripts/ensure-columns.ts` (Português). As migrations parecem **resquícios de uma tentativa antiga** que foi substituída pelo `ensure-columns.ts`, mas nunca removidas.
**Agravante:** migrations 020 (`ALTER TABLE roteiros ADD COLUMN residuo`) e 021 (`ALTER TABLE tipos_residuo ...`) **são ativas e necessárias**, então não dá pra "deletar a pasta inteira" sem revisão.
**Correção:** Revisar arquivo por arquivo; mover as órfãs (010, 012, 018, 019) para `docs/legacy/` ou deletar. Manter 007, 011, 020, 021. Documentar em `migrations/README.md` que a fonte canônica é `ensure-columns.ts`.

#### M2 — Wrappers de `invoke('db_*')` divergem em camada e em shape de retorno

**Arquivos:** `src/infrastructure/persistence/sqlite/tauriSqliteAdapter.ts:17,29`, `src/interface/hooks/tauri/useTauriQuery.ts:30`, `src/interface/hooks/tauri/useTauriMutation.ts:26,47,64`, `src/interface/hooks/queries/useAgendamentoMapData.ts:25`
**Problema:** O `src/infrastructure/README.md` estabelece que `invoke('db_*')` só deve aparecer em `tauriSqliteAdapter.ts`. Há pelo menos 4 bypassers. Pior: o shape de retorno diverge:

- `tauriSqliteAdapter.all()` retorna **objetos** `{ coluna: valor, ... }` (faz o pivot de `rows[][]` por `columns[]`).
- `useTauriQuery` retorna `QueryResult` cru, ou seja, **`rows` como `unknown[][]` indexado por coluna**.

Qualquer dev novo que consumir `useTauriQuery` esperando objetos (o formato idiomático) terá bug silencioso de "undefined em todos os campos".
**Correção:** Padronizar. Opção A: `useTauriQuery`/`useTauriMutation` passam a chamar o `SqlitePort` (adapter), extinguindo o bypass. Opção B: ambos expõem o mesmo shape `{ columns, rows[], objects[] }`. Documentar o tipo em `packages/core/src/ports/SqlitePort.ts`.

#### M3 — Contrato de retorno de `db_query` não está tipado compartilhado

**Arquivo:** `packages/core/src/ports/SqlitePort.ts`
**Problema:** O Rust retorna `{ columns: Vec<String>, rows: Vec<Vec<Value>>, rows_affected?: usize }` (estrutura `QueryResult` em `database.rs`), mas o tipo `QueryResult` não está publicado no `ecoforms-core`. Cada consumer do FE redeclara o shape ou o assume implicitamente.
**Correção:** Exportar `TauriQueryResult` (ou similar) em `packages/core`, mapeando 1:1 com o struct Rust. Repositórios e hooks consomem esse tipo.

#### M4 — `bootstrap: Option<bool>` em `db_execute` não é propagado por todos os callers

**Arquivo:** `src-tauri/src/database.rs:181`, `tauriSqliteAdapter.ts:29`, `useTauriMutation.ts:26`
**Problema:** `db_execute` aceita `bootstrap` para bypass de guards de inicialização. O adapter repassa (`bootstrap: options?.bootstrap ?? false`); o `useTauriMutation` **não repassa**. Se algum fluxo de boot do app usa o hook em vez do adapter, será bloqueado pelos guards.
**Correção:** Ou remover o parâmetro (se bootstrap via hook não é necessário) ou expor option no hook.

#### M5 — ActionRegistry é um "escape hatch" dinâmico para invoke

**Arquivo:** `src/application/actions/ActionRegistry.ts:6`, `src/interface/hooks/tauri/useTauriInvoke.ts:14`
**Problema:** `ActionCommands.invoke(command: string, ...)` aceita string arbitrária, e a implementação é o `useTauriInvoke` genérico. Qualquer handler de ação pode invocar qualquer command Rust sem checagem estática. Hoje os consumers passam literais (superfície auditável), mas nada impede chamadas dinâmicas.
**Correção:** Aceitar como risco documentado (escape hatch intencional) OU tipar o catálogo de commands permitidos via union type gerado a partir do inventário Rust.

---

### BAIXO (dívida técnica aceitável)

| # | Problema | Arquivo |
|---|---|---|
| B1 | `WebviewWindow` importado mas nunca usado em `window-utils.ts` | `lib/window-utils.ts:1` |
| B2 | `scripts/migrate_adhoc.js` importa `invoke` via `require` mas nunca chama — script morto | `scripts/migrate_adhoc.js:1` |
| B3 | `convertFileSrc` importado em `lib/offline-storage.ts:8` (não é invoke, mas vale documentar como URL converter usado em `:93`) | `lib/offline-storage.ts` |

---

## Lacunas do ADR-076 endereçadas por este ADR

O ADR-076 olhou exclusivamente o lado Rust. Estes itens não foram capturados lá e só ficam visíveis ao cruzar FE ↔ BE:

| Lacuna | Impacto | Item deste ADR |
|---|---|---|
| Queries quebradas por tabela errada | Bugs ativos hoje | C1, C2 |
| `get_session` sem uso no FE | TTL proposto no A4 do ADR-076 fica parcialmente inócuo | A1 |
| `demanda_encerrar` Rust órfão | Perda de auditoria e evento sync no encerramento | A2 |
| `migrations/` desatualizada | Falsa fonte de verdade, confusão em onboarding | M1 |
| Shape de `db_query` divergente | Bug latente para novos consumers | M2, M3 |
| `supabase_admin_status` protegido no M8 mas sem UI | Proteção sem efeito prático | A4 |

---

## Ordem de correção recomendada

### Bloco 1 — Bugs ativos (correção imediata)

| Prioridade | Item | Esforço |
|---|---|---|
| 1 | C1 — `comentarios` → `tarefas_comentarios` em `queries/kanban.ts:11` | Trivial (1 token) |
| 2 | C2 — `data_registry` → `registro_dados` em `queries/data-registry.ts:26` | Trivial (1 token) |

Esforço total estimado: **~15 minutos** (incluindo teste manual de Kanban + dashboard de registry).

### Bloco 2 — Contrato de comandos (antes de produção)

| Prioridade | Item | Esforço |
|---|---|---|
| 3 | A1 — `AuthContext` chamar `get_session()` no boot e hidratar estado JS | Médio |
| 4 | A2 — Decidir path canônico para `demanda_encerrar` (Rust vs JS) e alinhar | Médio (decisão + impl) |
| 5 | A3/A4/A5 — Remover do `generate_handler!` OU ligar UI faltante | Baixo cada |

Esforço total estimado: **~4-6 horas**. A maior parte é a decisão em A2 e a hidratação de sessão em A1.

### Bloco 3 — Fundação do contrato (antes de produção ou logo após)

| Prioridade | Item | Esforço |
|---|---|---|
| 6 | M2 — Padronizar wrappers de `invoke('db_*')` ( extinguir bypass ou unificar shape) | Médio |
| 7 | M3 — Publicar tipo `TauriQueryResult` em `ecoforms-core` | Baixo |
| 8 | M1 — Revisar `migrations/`, mover órfãs para legacy, documentar fonte canônica | Baixo |
| 9 | M4 — Decidir destino do `bootstrap` em `db_execute` | Trivial |
| 10 | M5 — Documentar `ActionRegistry` como escape hatch intencional ou tipar | Baixo |

Esforço total estimado: **~6-8 horas**.

### Bloco 4 — Dívida menor

| Prioridade | Item | Esforço |
|---|---|---|
| 11 | B1/B2 — Remover imports mortos | Trivial |

Esforço total estimado: **~15 minutos**.

### Total estimado: ~11-15 horas de trabalho

---

## Nota sobre dependências

- As correções de **A1** (`get_session` no boot) e **M2/M3** (padronização do shape) são **pré-requisitos** para o ADR-075 implementar de forma confiável a re-validação periódica de sessão e o TTL.
- A correção de **A2** (`demanda_encerrar`) é **pré-requisito** para confiabilidade do sync de demandas (ADR-075): se o evento de encerramento não é emitido pelo Rust, ele nunca entra no pipeline de sync.
- Os items **A3/A4/A5** são ortogonais — podem ser resolvidos independentemente.
