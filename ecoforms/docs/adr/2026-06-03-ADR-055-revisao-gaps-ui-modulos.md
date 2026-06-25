# ADR-055 — Revisão de Gaps UI por Módulo

**Status:**Implementado**
**Concluído em:** 2026-06-03  
**Data:** 2026-06-03  
**Autor:** Marcelo Luiz  
**Branch:** adr-051-commands-backend  
**Contexto externo:** GLM 5.1 — comparação paralela do ADR-051 concluída; 3 pendências baixas adicionadas ao BACKEND_NAO_EXPOSTO.md

---

## Contexto

O app está em fase final antes do primeiro release. O branch `adr-051-commands-backend`
acumula mudanças em dezenas de arquivos cobrindo: commands Rust, módulo de agendamentos
(ADR-018), geoprocessamento (ADR-038/053/054), unificação mobile SQLite (ADR-052),
field factory, logistics e kanban.

O `docs/BACKEND_NAO_EXPOSTO.md` foi auditado em 2026-06-02 e reportou **0 gaps** de
backend sem UI. Porém, esse documento rastreia apenas a direção backend→frontend.
Não cobre:

1. **UI sem backend** — telas que existem mas chamam dados fictícios, queries diretas
   ou TODOs silenciosos.
2. **Fluxos incompletos** — tela existe, backend existe, mas o fluxo ponta-a-ponta
   (ex: criar → confirmar → feedback ao usuário) tem buracos.
3. **Módulos novos sem cobertura de navegação** — rotas registradas mas não acessíveis
   via sidebar/menu.
4. **Regressões de integração** — mudanças recentes quebraram silenciosamente algo
   que funcionava.

---

## Decisão

Executar uma **revisão de gaps UI por módulo** em duas etapas:

### Etapa 1 — Varredura estática (sem rodar o app)

Para cada módulo listado na tabela abaixo, verificar:

| Check | Critério de gap |
|---|---|
| Rota acessível via sidebar | Link presente em `AppSidebar.tsx` ou menu contextual |
| Hook de dados conectado | Usa `getContainerAsync()` → repositório ou use case real (não mock/hardcode) |
| Mutações com feedback | Submit, delete e status-change têm loading state + toast/erro |
| Permissão RBAC aplicada | `HideForRole` ou guard presente onde necessário |
| Comando Tauri com invoke | Todo `invoke(...)` referenciado tem handler registrado em `lib.rs` |

### Etapa 2 — Verificação de fluxo (rodar o app)

Para os módulos marcados com gap na Etapa 1, rodar o app Tauri e testar o fluxo
crítico (golden path) documentado por módulo.

---

## Módulos no escopo

| # | Módulo | Rota principal | Prioridade | Responsável |
|---|---|---|---|---|
| 1 | Agendamentos | `/admin/agendamentos` | Alta | ADR-018 recente |
| 2 | Minhas Tarefas de Campo | `/minhas-tarefas-campo` | Alta | ADR-052 + booking |
| 3 | Logística / Itinerários | `/logistica` | Alta | ADR-038/054 recente |
| 4 | Kanban / Tarefas | `/kanban` | Média | EditTaskModal atualizado |
| 5 | Remoção / Ecopontos | `/remocao` | Média | PainelCaixas + agendar_remocao |
| 6 | Service Types | `/admin/service-types` | Média | CreateServiceTypeUseCase atualizado |
| 7 | Manifestações / Ouvidoria | `/manifestacoes` | Baixa | Estável |
| 8 | Admin / Usuários | `/admin` | Baixa | Estável |
| 9 | Dashboard | `/` | Baixa | Widgets resolvidos em ADR-051 |

---

## Resultado (2026-06-03)

Varredura completa executada. **1 gap real encontrado e corrigido:**

| Gap | Severidade | Arquivo | Correção |
|---|---|---|---|
| PainelCaixas sem toast/refetch após `ecoponto_agendar_remocao` | Alta | `components/remocao/PainelCaixas.tsx:67` | Adicionado `toast.success`, `toast.error` substituiu `alert()`, `refetch()` chamado no sucesso |

**4 gaps descartados após investigação:**
- GAP 2 (invoke incompleto) — falso alarme; demais invokes estão em `SqlitePort.ts` e actions, já auditados no BACKEND_NAO_EXPOSTO.md
- GAP 3 (logística roteiros) — usa hooks catalog com toast completo; correto
- GAP 4 (nomenclatura Roteiro) — `RoteiroMap/RoteiroModal` ativos em `admin/agendamentos/slots/[id]`
- GAP 5 (`/modulo/agendamento`) — página válida de gestão de slots com hooks catalog corretos

---

## Critérios de encerramento

- Todos os módulos de prioridade Alta revisados na Etapa 1.
- Módulos com gap documentado têm issue aberta ou fix aplicado.
- `docs/BACKEND_NAO_EXPOSTO.md` atualizado com resultado final.
- Nenhum `TODO` ou `// mock` silencioso nos hooks de dados dos módulos Alta.

---

## Alternativas consideradas

**Rodar auditoria `/reversa-audit` completa** — descartado: exige artefatos `.reversa/`
(requirements.md, actions.md) que não existem. Overhead desproporcional para o estágio atual.

**Revisão apenas pelo GLM 5.1** — insuficiente isoladamente: comparação de ADR cobre
decisões arquiteturais, não fluxos de UI nem estado de hooks.

---

## Consequências

- **Positivo:** Identifica regressões antes do release sem exigir QA manual completo.
- **Positivo:** Produz um checklist auditável por módulo, reutilizável em releases futuros.
- **Negativo:** Etapa 2 requer build Tauri funcional — se o build estiver quebrado, bloqueia.
- **Risco:** Módulos de baixa prioridade podem esconder gaps; aceito conscientemente para
  focar no que mudou neste branch.
