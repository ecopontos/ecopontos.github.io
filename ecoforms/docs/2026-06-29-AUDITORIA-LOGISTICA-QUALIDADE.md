# Auditoria de Qualidade — Módulo Logística

**Data:** 2026-06-29
**Escopo:** módulo Logística do desktop (Tauri v2 + Next.js) — camadas UI (`app/logistica/`,
`components/logistics/`), hooks (`src/interface/hooks/{queries,mutations,catalog}`), repositórios
(`SqliteLogisticsRepository`, `SqliteExecucaoClienteRepository`), catálogo de queries
(`queries/logistica.ts`), domínio (`ExecucaoColetaStateMachine`) e o pipeline de sync inbound
(`HandlerRegistry`).
**Fonte de verdade do schema:** `desktop/scripts/ensure-columns.ts`.
**Complementa:** `2026-06-25-AUDITORIA-MAPA-LOGISTICA-APROFUNDADA.md` (aba Mapa, itens N/G) — aqui o
foco é o módulo inteiro (roteiros, execuções, coleta, checklist, sync).

> Cada achado foi verificado contra `arquivo:linha` e cruzado com o `CREATE TABLE` correspondente.

## Sumário de severidade

| ID | Severidade | Achado | Status |
|----|-----------|--------|--------|
| L-11 | 🔴 Crítico | Handlers inbound de logística escrevem colunas inexistentes (`tipo_residuo`, `veiculo`) | ✅ RESOLVIDO |
| L-1 | 🔴 Alto (latente) | 5 queries de métrica mortas **e** quebradas (tabela/coluna/status inexistentes) | ✅ RESOLVIDO |
| L-2 | 🟡 Médio | Composição/ordem roteiro↔cliente não sincroniza | ✅ RESOLVIDO |
| L-3 | 🟡 Médio | Coleta de campo (`execucao_clientes`) não sincroniza | ✅ RESOLVIDO |
| L-4 | 🟡 Médio | Checklist de execução não sincroniza | ✅ RESOLVIDO |
| L-5 | 🟡 Médio | Deleções (roteiro/execução) não sincronizam | ✅ RESOLVIDO |
| L-6 | 🟡 Médio | `execucao_clientes` com 2 repositórios divergentes (um ignora `quantidade`) | 📋 DOCUMENTADO |
| L-7 | 🟢 Baixo | `atualizado_em` nunca atualizado em `execucao_coleta` | ✅ RESOLVIDO |
| L-8 | 🟢 Baixo | `useAuth()`/`user` morto em `RoteiroDetailPage` | ✅ RESOLVIDO |
| L-9 | 🟢 Baixo | Imports do catálogo fragmentados | 📋 DOCUMENTADO |
| L-10 | 🟢 Baixo | `handleMoveUp/Down` faz 2 UPDATEs sem transação | 📋 DOCUMENTADO |

---

## 🔴 L-11 — Handlers inbound de logística escrevem colunas inexistentes (classe CR-1)

**Arquivo:** `src/infrastructure/sync/HandlerRegistry.ts`
Mesma classe do CR-1 da auditoria de DB, porém **já em produção** no pipeline de sync de entrada:

- `roteiro.criado` / `roteiro.atualizado` escreviam a coluna **`tipo_residuo`**, que **não existe** em
  `roteiros`. As colunas reais são `residuo` (descrição livre, `ensure-columns.ts:651`/`667`) e
  `tipo_residuo_id` (FK). Toda criação/atualização de roteiro recebida via sync falhava com
  `no such column: tipo_residuo`. Pior: o lado emissor (`saveRoteiro` faz `SELECT *`) já enviava a chave
  `residuo`, então o handler lia `d.tipo_residuo` (undefined) **e** gravava em coluna inexistente — duplo erro.
- `execucao.criada` escrevia a coluna **`veiculo`**, inexistente em `execucao_coleta`. A real é
  **`veiculo_placa`** (`ensure-columns.ts:704`). O emissor envia `veiculo_placa`; o handler lia `d.veiculo`.

**Impacto:** sincronização inbound de roteiros e execuções quebrada no nível de coluna — toda a réplica de
logística entre dispositivos/nuvem falhava silenciosamente (erro engolido pelo pipeline).

**Correção:** `tipo_residuo → residuo` (lê `d.residuo`), `veiculo → veiculo_placa` (lê `d.veiculo_placa`,
com fallback `?? d.veiculo` para envelopes legados em fila).

---

## 🔴 L-1 — Queries de métrica mortas e quebradas

**Arquivo:** `src/infrastructure/persistence/sqlite/queries/logistica.ts`
Cinco `QueryDef` de dashboard/medida sem **nenhum** consumidor (grep negativo em todo o repo) e
simultaneamente quebradas — uma armadilha: o primeiro widget que as ligar quebra em runtime.

| Query | Defeito | Correção |
|-------|---------|----------|
| `ROTEIROS_POR_STATUS` | `GROUP BY r.status` — `roteiros` só tem **`situacao`** | `r.situacao` |
| `EXECUCOES_RESUMO` | tabela **`execucoes`** não existe + status `em_andamento`/`pendente` fantasmas | `execucao_coleta` + remapeio para a state machine real |
| `EXECUCOES_POR_ROTEIRO` | `LEFT JOIN execucoes` | `LEFT JOIN execucao_coleta` |
| `INTERCORRENCIAS_POR_TIPO` | tabela **`intercorrencias`** + coluna `tipo` inexistentes | `intercorrencias_coleta` + `LEFT JOIN tipos_intercorrencia` p/ o nome |
| `EXECUCOES_TENDENCIA_MENSAL` | `FROM execucoes` | `execucao_coleta` |

**Decisão:** corrigir em vez de remover — as queries passam a refletir corretamente o schema e a state
machine (`agendada → em_transito → em_execucao → concluida` / `cancelada`), prontas para um dashboard de
logística. Por não terem consumidor, a correção não altera comportamento atual (risco zero), apenas remove a
armadilha.

---

## 🟡 L-2..L-5 — Sincronização event-sourcing parcial

O repositório emitia 6 eventos (roteiro criado/atualizado, execução criada/status, intercorrência
registrada/resolvida), todos com handler inbound. Mas **quatro fluxos não emitiam nada** — dados ficavam
presos no SQLite local do desktop, sem replicar:

- **L-2 — Composição/ordem roteiro↔cliente.** `addClienteToRoteiro` / `removeClienteFromRoteiro` /
  `updateClienteOrdem` / `updateClienteOrdemBatch` (sem `sync.write`). A ordem do itinerário — inclusive o
  botão **"Otimizar rota"** (nearest-neighbor) — nunca propagava.
- **L-3 — Coleta de campo.** `saveExecucaoCliente` (`execucao_clientes`) sem evento. É o payload operacional
  central (quem foi coletado, `quantidade`, ocorrência).
- **L-4 — Checklist.** `saveChecklistItem` / `completeChecklistItem` sem evento.
- **L-5 — Deleções.** `deleteRoteiro` (soft-delete `situacao=inativo`) e `deleteExecucao` (hard-delete) sem
  evento.

**Correção (emit + inbound):** novos tipos de evento registrados em `EventEnvelope.ts` (desktop) e
`packages/core/src/sync/EventEnvelope.ts` (união + array; o mobile reusa via bundle de core):

| Evento | Emissor | Handler inbound (colunas verificadas) |
|--------|---------|----------------------------------------|
| `roteiro_cliente.vinculado` | `addClienteToRoteiro` | `INSERT … ON CONFLICT(roteiro_id,cliente_id)` |
| `roteiro_cliente.desvinculado` | `removeClienteFromRoteiro` | `UPDATE … SET ativo=0` |
| `roteiro_cliente.reordenado` | `updateClienteOrdem[Batch]` | `UPDATE ordem` por item |
| `execucao_cliente.registrado` | `saveExecucaoCliente` | `INSERT … ON CONFLICT(execucao_id,cliente_id)` (com `quantidade`) |
| `checklist.atualizado` | `saveChecklistItem`/`completeChecklistItem` | `INSERT … ON CONFLICT(id)` |
| `execucao.excluida` | `deleteExecucao` | `DELETE FROM execucao_coleta` (filhos por CASCADE) |
| `roteiro.atualizado` (reuso) | `deleteRoteiro` | handler existente (já corrigido em L-11) |

Todos os handlers são idempotentes (upsert/INSERT OR IGNORE/UPDATE) e usam apenas colunas confirmadas no
schema — sem repetir a classe de bug L-11. Hard-delete de execução não gera órfãos: as filhas
(`execucao_clientes`, `checklist_execucao`, `execucao_coleta_historico`, `execucao_pesagens`,
`intercorrencias_coleta`) têm `ON DELETE CASCADE` e `PRAGMA foreign_keys=ON` está ativo
(`database.rs:52`).

> **Nota de paridade:** os handlers inbound foram adicionados no **desktop**. O mobile (`mobile/www/`) é o
> app de campo e origina a coleta pelo seu próprio pipeline; handlers inbound mobile para estes eventos ficam
> como follow-up se houver necessidade de réplica desktop→mobile.

---

## 🟡 L-6 — `execucao_clientes` com dois repositórios divergentes (DOCUMENTADO)

Duas implementações escrevem a mesma tabela `execucao_clientes` com colunas diferentes:

- `SqliteLogisticsRepository.{findExecucaoClientes,saveExecucaoCliente}` — colunas completas **com
  `quantidade`**, upsert `ON CONFLICT(execucao_id,cliente_id)`. É o caminho usado pela UI principal
  (`ColetaRegistroPanel` via `useExecucaoClientes`/`useExecucaoClientesMutations`) — **`quantidade`
  preservada, sem bug hoje**.
- `SqliteExecucaoClienteRepository` (`domain/execucao-cliente/`) — subconjunto **sem `quantidade`**, upsert
  por `id`; segundo domain-type para a mesma entidade. Lido por `useExecucoesClientes` (plural).

**Risco latente:** qualquer escrita via o segundo repositório descarta `quantidade` silenciosamente, e o
`ExecucaoClienteRow` dele nem inclui a coluna. **Recomendação:** consolidar num único repositório/domain-type
(refactor — fora do escopo deste PR por ser invasivo). Documentado para não reabrir como bug.

---

## 🟢 Baixo

- **L-7 — `atualizado_em` congelado.** `saveExecucao` (UPDATE) e `updateExecucaoStatus` não atualizavam
  `execucao_coleta.atualizado_em` — ficava no valor do INSERT. **Corrigido** (setam `atualizado_em = now`).
- **L-8 — `user` morto.** `RoteiroDetailPage.tsx:46` destruturava `useAuth()` sem uso (o consumidor real está
  no sub-componente `ColetaRegistroPanel`, que tem o seu próprio). **Removido** (o import `useAuth` permanece,
  ainda usado pelo sub-componente).
- **L-9 — Imports fragmentados (DOCUMENTADO).** `RoteiroDetailPage` faz ~6 `import … from
  '@/…/catalog/logistica'` separados; poderiam ser um só. Estético, sem impacto funcional.
- **L-10 — Reordenação sem transação (DOCUMENTADO).** `handleMoveUp/Down` faz 2 `updateClienteOrdem`
  sequenciais; se o 2º falhar, duas linhas ficam com a mesma `ordem`. Baixo risco (mesmo device, rápido).
  `updateClienteOrdemBatch` numa transação única seria mais seguro.

---

## Pontos fortes do módulo

State machine (`ExecucaoColetaStateMachine`) limpa e validada no repositório antes de cada transição;
deep-linking por URL (`?tab=mapa&roteiro=…&exec=…`, `?exec=…&panel=coleta`); otimização de rota
nearest-neighbor com aviso de pontos sem coordenada; entrada rápida de coleta por ordem/nome; `htmlEscape`
no print do itinerário; `NovaExecucaoDialog` dual-mode (roteiro fixo vs seletor); handlers inbound cobrindo
agora 100% dos eventos emitidos.

## Verificação

- Cada nome de tabela/coluna nos handlers e queries novos foi cruzado com o `CREATE TABLE` em
  `ensure-columns.ts` (roteiros:645, execucao_coleta:693, roteiro_clientes:676, execucao_clientes:766,
  checklist_execucao:788, intercorrencias_coleta:827).
- Scan de imports quebrados (`find-missing`) — 0 ocorrências.
- ⚠️ Não foi possível rodar `tsc`/`lint`/testes neste ambiente (sem `node_modules` instalável). Verificação
  por revisão estática + cruzamento de schema.
