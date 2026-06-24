# ADR-043: Gaps identificados no módulo Ecopontos

**Data:** 2026-05-29  
**Status:**Implementado** (2026-06-09)
**Autores:** Equipe EcoForms  
**Escopo da auditoria:** 21 arquivos do módulo ecopontos (domain, application, infrastructure, interface, pages, src-tauri)  
**ADRs relacionados:** ADR-031-desktop (QueryCatalog), ADR-034 (fila revisão caixas), ADR-036 (Kanban remoção), ADR-038 (BookingModal gaps), ADR-039 (Manifestações gaps)

---

## Contexto

Auditoria completa do módulo ecopontos em todas as camadas. O módulo é o único do sistema **sem domain layer** — não possui entidade, repositório, use cases, nem hook de interface. A lógica está distribuída entre: um comando Tauri (Rust), datasources CRM, hooks de analytics com SQL inline, e componentes de UI que leem JSON bruto de `registro_dados`. Existem também duas referências inconsistentes ao nome da tabela principal.

---

## Inventário por Camada

### Domain — 🔴 Inexistente

| Esperado | Status |
|---------|--------|
| `src/domain/ecoponto/Ecoponto.ts` | ❌ Não existe |
| `src/domain/ecoponto/EcopontoRepository.ts` | ❌ Não existe |

Único domínio do sistema sem entidade e sem repositório interface. A tabela `ecopontos` existe no banco mas não há contrato que a represente no código TypeScript.

### Application — 🔴 Inexistente

| Esperado | Status |
|---------|--------|
| `src/application/ecoponto/` | ❌ Não existe |
| Use cases (list, get, update, encaminharRemocao) | ❌ Não existem |

O único arquivo de application referente a ecopontos é `ecoponto.actions.ts`, que define uma action de encaminhamento — mas não é um use case: é um handler de UI que chama diretamente o Tauri runtime.

### Infrastructure — 🟡 Parcial (sem repositório)

| Arquivo | Status | Gap |
|---------|--------|-----|
| `crm-datasources.ts` → `ecopontos_crm` | ✅ | Datasource de leitura para EntityPicker |
| `SqliteEcopontoRepository.ts` | ❌ Não existe | Sem repositório CRUD |
| Migration de criação da tabela `ecopontos` | ❌ Não existe | |
| `ecopontos` em `schema_ddl.sql` | ❌ Ausente | Schema drift |

### Interface (Hooks) — 🟡 Fragmentado

| Arquivo | Status | Gap |
|---------|--------|-----|
| `useRemocaoAnalytics.ts` | ⚠️ | SQL inline via `getContainerAsync()` direto — viola camadas |
| `useCaixasData.ts` | ⚠️ | Re-exporta dados brutos de `registro_dados` sem tipagem de domínio |
| `useEcoponto()` hook | ❌ Não existe | Todos os outros domínios têm hook; ecopontos não |

### Pages / Components — 🟡 Funcional mas frágil

| Arquivo | Status | Gap |
|---------|--------|-----|
| `app/caixas/page.tsx` | ✅ Rota existe | |
| `app/remocao/page.tsx` | ✅ Rota existe | |
| `app/ecopontos/[id]/page.tsx` | ❌ Não existe | Sem página de detalhe |
| `PainelCaixas.tsx` | ⚠️ | Parsing de JSON frágil (ver Gap 4) |
| `BoardRemocao.tsx` | ⚠️ | String literal hardcoded no filtro Kanban |

### Tauri (Rust) — ✅ Funcional

| Arquivo | Status | Observação |
|---------|--------|-----------|
| `commands/actions.rs` → `ecoponto_agendar_remocao` | ✅ | Implementado e registrado em `lib.rs:94` |

---

## Gaps Detalhados

### Gap 1 — Ausência total de domain layer (Crítico)

O módulo ecopontos não possui entidade nem repositório interface. Todo o resto do sistema (task, suite, client, crm, ouvidoria, user, demanda, project, service…) segue Clean Architecture; ecopontos é a exceção.

**Consequências:**
- Lógica de negócio não pode ser testada sem banco
- Sem contrato de repositório, qualquer refactor de SQL quebra silenciosamente
- `crm-datasources.ts` e `useRemocaoAnalytics.ts` acessam SQL sem tipagem de domínio

**Decisão — arquivos a criar:**

```typescript
// src/domain/ecoponto/Ecoponto.ts
export interface Ecoponto {
  id: string;
  nome: string;
  endereco: string;
  setor_id: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

// src/domain/ecoponto/EcopontoRepository.ts
export interface EcopontoRepository {
  findAll(): Promise<Ecoponto[]>;
  findById(id: string): Promise<Ecoponto | null>;
  findAtivos(): Promise<Ecoponto[]>;
}
```

---

### Gap 2 — Tabela `ecopontos` ausente do schema rastreado (Crítico)

`crm-datasources.ts` consulta `SELECT id, nome, endereco FROM ecopontos WHERE ativo = 1`. A tabela existe no banco em produção, mas **não aparece em `schema_ddl.sql` nem em `schema_dump_clean.sql`**.

Além disso, `exportar-mobile/page.tsx` conta `tbl_ecopontos` (com prefixo `tbl_`), enquanto o datasource usa `ecopontos` sem prefixo — possivelmente duas tabelas distintas, ou renomeação inacabada.

**Decisão:**
1. Confirmar qual nome é canônico — `ecopontos` ou `tbl_ecopontos`
2. Adicionar DDL da tabela em `schema_ddl.sql`
3. Criar migration de criação em `/migrations/`
4. Unificar referências (ou documentar se são tabelas distintas com propósitos diferentes)

---

### Gap 3 — Bug no fieldMapping de `ecoponto.actions.ts` (Crítico)

**Arquivo:** `src/application/actions/builtin/ecoponto.actions.ts`

```typescript
// ❌ fieldMapping declara que ecopontoId vem de formData
fieldMapping: {
  ecopontoId: { from: "formData.ecopontoId" },
  ...
},

// ❌ Mas o handler lê de ctx.input — sempre undefined
handler: async (ctx: ActionContext): Promise<ActionResult> => {
  const ecopontoId = ctx.input?.ecopontoId as string;  // nunca populado via fieldMapping
  ...
  if (!ecopontoId || !setorRemocao) {
    return { success: false, message: "Dados incompletos para encaminhamento." };
  }
```

O `fieldMapping` resolve campos de `formData` para `ctx.input` apenas se o runtime de actions fizer o mapeamento explícito. Como `ecopontoId` não é um campo do `requiresInput.fields` (é dado do contexto, não do formulário de input), ele nunca chegará em `ctx.input`. O handler sempre retorna `"Dados incompletos"`.

**Decisão:** Ler `ecopontoId` de `ctx.formData`:

```typescript
// ✅ Corrigido
const ecopontoId = (ctx.formData?.ecopontoId ?? ctx.ecoponto?.id) as string;
```

---

### Gap 4 — `PainelCaixas.tsx` parsing de JSON frágil (Importante)

**Arquivo:** `components/remocao/PainelCaixas.tsx`

```typescript
// ❌ Cascata de fallbacks para localizar campos
const actualData = dados.campos || dados.data || dados;
const ecopontoId = actualData.ecoponto || actualData.ecopontoLabel;
const occupation = caixasList.ocupacao || {};
const removed    = caixasList.removidas || {};
```

Se o schema do formulário `ecopontoCaixasForm` mudar (renomear campo, reestruturar `caixas_list`), o parse falha silenciosamente produzindo dados zerados — sem erro visível, sem log.

**Decisão:** Criar um parser tipado com Zod ou validação explícita:

```typescript
// src/application/ecoponto/parsers/EcopontoCaixasFormParser.ts
export function parseEcopontoCaixasForm(raw: unknown): CaixasFormData | null {
  // validação com schema explícito; retorna null + console.warn em caso de falha
}
```

---

### Gap 5 — Evento `ecoponto.remocao.agendada` sem handler de sync (Importante)

**Arquivo:** `src/application/actions/builtin/ecoponto.actions.ts`

```typescript
await ctx.syncOutbox.write("ecoponto.remocao.agendada", { ... });
```

O evento é escrito no outbox, mas `HandlerRegistry` (sync) provavelmente não tem handler registrado para `ecoponto.remocao.agendada`. O evento ficará na fila sem ser processado.

Além disso, a memória do projeto define que **"outros domínios viram tasks antes do sync mobile"** — ou seja, o evento deveria ser convertido em tarefa *antes* de entrar no outbox, não depois. O Tauri command `ecoponto_agendar_remocao` já cria a tarefa, mas o evento de sync não referencia essa conversão.

**Decisão:**
1. Registrar handler em `HandlerRegistry` para `ecoponto.remocao.agendada`
2. Handler deve verificar se a tarefa já foi criada (via `taskId` no payload) antes de criar duplicata
3. Alternativamente: remover o `syncOutbox.write` da action e confiar apenas na tarefa criada pelo Tauri command + evento de tarefa existente

---

### Gap 6 — `useRemocaoAnalytics` viola separação de camadas (Importante)

**Arquivo:** `src/interface/hooks/queries/useRemocaoAnalytics.ts`

```typescript
// ❌ Hook de interface chama container diretamente com SQL
const c = await getContainerAsync();
const db = c.sqlite;
const [historicoRows, formRows] = await Promise.all([
  db.query(`SELECT conteudo, criado_em FROM registro_dados WHERE tipo = 'ecopontoCaixasForm' ...`),
  db.query(`SELECT conteudo, criado_em FROM registro_dados WHERE tipo = 'ecopontoForm' ...`),
]);
```

A camada de interface não deve conhecer SQL. Esse padrão foi identificado também em ADR-039 (gap 1) como violação sistêmica.

**Decisão:** Criar use case `GetEcopontoAnalyticsUseCase` que encapsula as queries. Hook passa a chamar o use case via `useEcoponto()`.

---

### Gap 7 — Sem página de detalhe do ecoponto (Importante)

Não existe rota `app/ecopontos/[id]/page.tsx`. O sistema tem:
- `app/caixas/page.tsx` — visão agregada de todos os ecopontos
- `app/remocao/page.tsx` — Kanban de tarefas de remoção

Mas não há página individual que mostre: dados cadastrais, histórico de ocupação, timeline de remoções, ações disponíveis (encaminhar remoção).

**Decisão:** Criar `app/ecopontos/[id]/page.tsx` com abas: Dados | Caixas | Histórico | Ações.

---

### Gap 8 — RBAC sem granularidade para ecopontos (Médio)

**Arquivo:** `src-tauri/src/commands/actions.rs:116`

```rust
check_permission(conn, &perfil, "activities.manage")?;
```

A permissão `activities.manage` é genérica — usada por demandas, tarefas e agendamentos. Não existe `ecoponto.view`, `ecoponto.manage` ou `ecoponto.remocao.agendar`.

O ADR-023 (RBAC, Fase 2 bloqueante) não cobre ecopontos.

**Decisão:** Incluir ecopontos no escopo do ADR-023 antes de implementar mais comandos Tauri de ecoponto. Permissões sugeridas:
- `ecoponto.view` — leitura de cadastro e caixas
- `ecoponto.manage` — edição de cadastro
- `ecoponto.remocao.agendar` — encaminhar remoção (hoje: `activities.manage`)

---

### Gap 9 — `BoardRemocao` filtra Kanban por string literal (Baixo)

**Arquivo:** `components/remocao/BoardRemocao.tsx`

```typescript
// ❌ String mágica hardcoded — sem constante, sem tipo
<p>Selecione o projeto <strong>caixas-ecoponto</strong> no seletor de projetos</p>
<KanbanBoard />  // filtro por 'caixas-ecoponto' implícito na UI, sem prop explícita
```

Se o slug do projeto Kanban mudar, o usuário não vê as tarefas de remoção mas também não vê erro.

**Decisão:** Exportar constante `KANBAN_PROJECT_REMOCAO = 'caixas-ecoponto'` e passar como prop ao `KanbanBoard`.

---

### Gap 10 — Sem testes (Baixo)

Nenhum arquivo de teste cobre:
- Threshold de ocupação 75% que dispara criação de tarefa
- Parsing de `ecopontoCaixasForm`
- Logic de `useRemocaoAnalytics` (histórico, médias)
- `ecoponto_encaminhar_remocao` action (incluindo o bug do Gap 3)

---

## Resumo Executivo

| # | Gap | Severidade | Arquivo(s) | Esforço |
|---|-----|-----------|-----------|---------|
| 1 | Ausência de domain layer (entity + repository) | Crítico | `src/domain/ecoponto/` — criar | Médio |
| 2 | Tabela `ecopontos` fora do schema rastreado + inconsistência `tbl_` | Crítico | `schema_ddl.sql`, migration | Baixo |
| 3 | Bug fieldMapping → handler lê fonte errada; sempre falha | Crítico | `ecoponto.actions.ts:49` | Baixo |
| 4 | Parsing JSON frágil em PainelCaixas | Importante | `PainelCaixas.tsx` | Médio |
| 5 | Evento sync sem handler + violação padrão mobile | Importante | `HandlerRegistry`, `ecoponto.actions.ts` | Médio |
| 6 | ~~SQL inline em hook de interface~~ → ✅ **RESOLVIDO** em `567bb92` (P3 batch 6a) | Importante | `useRemocaoAnalytics.ts` | Médio | `REGISTRO_DADOS_BY_TIPO_ECOPONTO` (catalog `registro_dados.ts`, NOVO) via `fetchRegistroDadosByTipoEcoponto` (`lookups.ts`); `getContainerAsync` removido |
| 7 | Sem página de detalhe do ecoponto | Importante | `app/ecopontos/[id]/` — criar | Alto |
| 8 | RBAC genérico sem permissões `ecoponto.*` | Médio | `actions.rs:116`, ADR-023 | Médio |
| 9 | String literal hardcoded no filtro Kanban | Baixo | `BoardRemocao.tsx` | Baixo |
| 10 | Sem testes | Baixo | — | Alto |

**Gap 3 é correção de uma linha — deve ser feito imediatamente.**  
**Gaps 1 e 2 são pré-requisitos para qualquer novo desenvolvimento no módulo.**  
**Gap 5 é bloqueante para o sync mobile funcionar corretamente.**  
**Gap 8 deve ser coordenado com a implementação do ADR-023 Fase 2.**

---

## O que está bem (não tocar)

- `ecoponto_agendar_remocao` (Rust) — implementado, registrado, com audit log
- `ecopontos_crm` datasource — query correta, LAN-aware
- `EntityPickerRenderer` → `ecoponto` → `ecopontos_crm` — mapeamento correto
- `PainelCaixas` e `BoardRemocao` — UX funcional para o fluxo principal
- `useRemocaoAnalytics` — lógica de parsing de histórico e médias é correta, só a camada está errada

## Relação com ADRs Existentes

- **ADR-023 (RBAC):** gap 8 — incluir `ecoponto.*` no escopo antes da Fase 2
- **ADR-031-desktop (QueryCatalog):** gap 6 (`useRemocaoAnalytics` SQL inline) ~~entra na lista de migrações~~ → **RESOLVIDO** em `567bb92` (P3 batch 6a) — `REGISTRO_DADOS_BY_TIPO_ECOPONTO` no catalog `registro_dados.ts` + `fetchRegistroDadosByTipoEcoponto` na fachada `lookups.ts`
- **ADR-034 (fila revisão caixas):** gap 5 (evento sem handler) é diretamente relacionado ao fluxo de despacho de remoção descrito no ADR-034
- **ADR-036 (Kanban remoção):** gap 9 (string literal) e gap 7 (ausência de detail page)
- **ADR-038/039 (gaps sistêmicos):** gaps 3, 5 e 6 seguem padrões já identificados — catch silencioso, `getContainerAsync` direto, SQL em interface layer
