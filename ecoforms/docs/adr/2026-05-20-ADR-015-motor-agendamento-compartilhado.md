# ADR-015 — Motor de Agendamento Compartilhado: Unificação de Slots, Recorrência e Formulários por Tipo de Serviço

- **Status**: **Implementado** (mecânica core; UI dinâmica pendente)
- **Implementado em**: 2026-06-18 (auditoria de código)
- **Data**: 2026-05-20
- **Autor**: Engenharia reversa assistida (Claude Code)
- **Decisor**: Aceito (caminho incremental escolhido sobre ADR-017)
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Supersede**: ADR-015 anterior (Modularização por Plugin Registry — absorvido por esta decisão)
- **Relacionados**: ADR-014 (Adequação Arquitetural), ADR-016 (Workflow Ouvidoria), ADR-017 (Unified Service Engine — alternativa radical)

---

## Contexto

O sistema possui dois módulos com lógica de datas independentes e não comunicantes:

### Módulo de Agendamento (`desktop/src/domain/agendamento/`)

- `AgendamentoSlot`: janelas de tempo com `dataInicio`, `dataFim`, `capacidade`, `tipoId` (`museu | volumosos | evento`)
- `Agendamento`: reserva dentro de um slot; ciclo de vida `pendente → confirmado → realizado`
- `AgendamentoValidatorFactory`: Strategy Pattern — cada tipo (`museu`, `volumosos`, `evento`) tem seu validador
- Motor de capacidade: `countVagasOcupadas` + comparação com `capacidade` do slot
- Ator principal: **cidadão** (`clienteId`, `vagasSolicitadas`)

### Módulo de Tarefas (`desktop/src/domain/task/`)

- `Task`: item de trabalho interno com `recorrente`, `recorrencia`, `formRegistryId` (campo já existe)
- `TaskRecurrence.ts`: `calculateNextOccurrence` — cálculo de próxima ocorrência (diária/semanal/mensal/anual)
- Sem motor de slots nem controle de capacidade
- Ator principal: **equipe interna** (`atribuidoPara`, Kanban)

### Formbuilder existente (`desktop/`)

O sistema já possui um formbuilder funcional e DB-backed — não é necessário criá-lo:

| Peça | Localização | Responsabilidade |
|---|---|---|
| Definições de form | `registro_formularios` (SQLite) | JSON com `form_id`, `conteudo: FieldSchema[]`, `ativo` |
| Carregamento | `useFormTemplate(slug)` → `suiteRepository.getFormTemplate` | Busca e deserializa o form por slug |
| Schema de campos | `src/lib/registry-schema.ts` → `FieldSchema` | `{ key, label, type, required, options }` |
| Renderização | `components/runtime/FormFieldRenderer` + `DynamicFormEditor` | Renderiza `FieldSchema[]` dinamicamente |
| Visibilidade condicional | `useVisibilityEvaluator` | Avalia regras de exibição/habilitação de campos |
| Vínculo Task→form | `Task.formRegistryId` + `useAssignedActiveForms` | Já conecta Task ao form pelo slug |

### Problemas identificados

1. **Duplicação de lógica de datas**: `TaskRecurrence.ts` e `AgendamentoSlot` implementam conceitos de janela temporal de forma independente, sem reúso.
2. **Formulários de Agendamento não usam o formbuilder existente**: a UI de Agendamento tem `if (slot.tipoId === "...")` hardcoded em páginas React (22 ocorrências) em vez de buscar o form em `registro_formularios` como Task já faz.
3. **Barreira para novos serviços**: adicionar um novo tipo de serviço agendável exige editar múltiplas páginas React; não há caminho de extensão via `registro_formularios`.
4. **`formRegistryId` em Task sem conexão ao Agendamento**: Task já resolve seu form pelo slug, mas o domínio de Agendamento não usa o mesmo mecanismo.

---

## Decisão

**Não fundir as entidades `Agendamento` e `Task`** — elas têm semânticas de domínio distintas e incompatíveis (`clienteId`/`vagasSolicitadas` vs `atribuidoPara`/Kanban).

**Extrair o motor compartilhado para `packages/core/scheduling/`**, consumido por ambos os módulos:

```
packages/core/scheduling/
├── SlotEngine.ts       ← disponibilidade, capacidade, sobreposição de janelas
├── RecurrenceEngine.ts ← movido de desktop/src/domain/task/TaskRecurrence.ts
└── types.ts            ← SchedulingTypes compartilhados
```

**Não criar** um `ServiceFormRegistry` em código — o formbuilder já é DB-backed via `registro_formularios`. A integração de formulários por tipo de serviço usa a infraestrutura existente (ver seção abaixo).

### `SlotEngine.ts`

Cálculo de disponibilidade e capacidade, agnóstico de domínio:

```typescript
export interface SlotWindow {
    dataInicio: string;
    dataFim: string;
    capacidade?: number;
}

export function isSlotAvailable(slot: SlotWindow, vagasOcupadas: number, vagasSolicitadas: number): boolean;
export function slotsOverlap(a: SlotWindow, b: SlotWindow): boolean;
export function vagasRestantes(slot: SlotWindow, vagasOcupadas: number): number;
```

`AgendamentoSlot` e os validators (`MuseuValidator`, etc.) passam a consumir `SlotEngine` em vez de reimplementar a lógica.

### `RecurrenceEngine.ts`

`calculateNextOccurrence` e tipos de recorrência extraídos de `TaskRecurrence.ts`:

```typescript
export type Frequencia = 'diaria' | 'semanal' | 'mensal' | 'anual';

export interface RecurrenceConfig {
    frequencia: Frequencia;
    intervalo?: number;
    dias_semana?: number[];
    fim_recorrencia?: string;
}

export function calculateNextOccurrence(currentStartedAt: string, config: RecurrenceConfig): string | null;
```

`TaskRecurrence.ts` torna-se um re-export de `@ecosuite/core/scheduling`.

### Formulários por tipo de serviço via `registro_formularios`

O formbuilder existente é reutilizado sem modificação. A integração ocorre em duas camadas:

**1. Descritor de tipo** — `domain/agendamento/AgendamentoTipoConfig.ts`:

Além do slug do form, o descritor carrega flags comportamentais que eliminam os `if (tipoId === 'volumosos')` remanescentes na UI (exibir galeria, exigir bairro, etc.). É também o ponto de entrada para o validator — uma fonte de verdade por tipo.

```typescript
export interface AgendamentoTipoConfig {
    tipoId: TipoAgendamento;
    formSlug: string;                        // form_id em registro_formularios
    requerFotos: boolean;                    // exibe galeria e valida mínimo de fotos
    bairrosObrigatorios: boolean;            // exige seleção de bairro na UI
    validator: () => AgendamentoValidator;   // factory do validator de capacidade
}

export const AGENDAMENTO_TIPOS: Record<TipoAgendamento, AgendamentoTipoConfig> = {
    museu: {
        tipoId:              'museu',
        formSlug:            'form-agendamento-museu',
        requerFotos:         false,
        bairrosObrigatorios: false,
        validator:           () => new MuseuValidator(),
    },
    volumosos: {
        tipoId:              'volumosos',
        formSlug:            'form-agendamento-volumosos',
        requerFotos:         true,
        bairrosObrigatorios: true,
        validator:           () => new VolumososValidator(),
    },
    evento: {
        tipoId:              'evento',
        formSlug:            'form-agendamento-evento',
        requerFotos:         false,
        bairrosObrigatorios: false,
        validator:           () => new EventoValidator(),
    },
};
```

`AgendamentoValidatorFactory` passa a delegar para `AGENDAMENTO_TIPOS[tipo].validator()` — uma fonte de verdade.

**2. Override de formulário por slot** — `AgendamentoSlot` ganha campo opcional:

```typescript
// AgendamentoSlotProps (adição mínima)
formSlugOverride?: string;   // sobrescreve o formSlug do tipo para este slot específico
```

Resolução do slug na UI:
```typescript
const config = AGENDAMENTO_TIPOS[slot.tipoId];
const slug = slot.formSlugOverride ?? config.formSlug;
const { template } = useFormTemplate(slug);
```

Permite que um slot específico (ex: "Museu — Turma Escolar") use um formulário diferente do padrão do tipo, sem alterar o descritor global.

**3. Seed de definições** — migration/seed insere os forms em `registro_formularios`:

```sql
INSERT INTO registro_formularios (form_id, conteudo, ativo) VALUES
  ('form-agendamento-museu',     '{"fields":[...]}', 1),
  ('form-agendamento-volumosos', '{"fields":[...]}', 1),
  ('form-agendamento-evento',    '{"fields":[...]}', 1);
```

**4. Renderização na UI** — páginas de agendamento usam os hooks existentes:

```typescript
// antes: if (slot.tipoId === "museu") { ... } — 22 ocorrências
// depois:
const config = AGENDAMENTO_TIPOS[slot.tipoId];
const slug   = slot.formSlugOverride ?? config.formSlug;
const { template } = useFormTemplate(slug);

// campos de dados dinâmicos:
// <DynamicFormEditor schema={template.fields} ... />

// comportamento de página via flags — sem ifs de tipoId:
// {config.requerFotos         && <GaleriaFotos ... />}
// {config.bairrosObrigatorios && <SeletorBairro ... />}
```

**Task** já usa `useFormTemplate(task.formRegistryId)` — sem alteração necessária.

Novo tipo de serviço = inserir uma linha em `registro_formularios` + adicionar entrada em `AGENDAMENTO_TIPOS`. Nenhuma página React editada.

---

## Estrutura Final dos Consumidores

### Desktop — Agendamento

```
desktop/src/
├── domain/agendamento/
│   ├── AgendamentoSlot.ts        ← + formSlugOverride?: string
│   └── AgendamentoTipoConfig.ts  ← NOVO: descritor com formSlug + flags + validator factory
├── application/agendamento/
│   └── validators/               ← AgendamentoValidatorFactory delega para AGENDAMENTO_TIPOS
└── interface/agendamento/
    └── NovoAgendamentoForm.tsx   ← config = AGENDAMENTO_TIPOS[tipoId]; sem ifs de tipoId
```

### Desktop — Task

```
desktop/src/
├── domain/task/
│   └── TaskRecurrence.ts        ← re-export de @ecosuite/core/scheduling
└── interface/task/
    └── TaskForm.tsx             ← useFormTemplate(task.formRegistryId) — já funciona assim
```

### Extensão para novo tipo de serviço

```
1. Inserir em registro_formularios: form_id='form-agendamento-poda_urbana', conteudo={fields:[...]}
2. Adicionar entrada em AGENDAMENTO_TIPOS:
   poda_urbana: { formSlug: 'form-agendamento-poda_urbana', requerFotos: true,
                  bairrosObrigatorios: true, validator: () => new PodaValidator() }
3. Adicionar em TipoAgendamento union: 'museu' | 'volumosos' | 'evento' | 'poda_urbana'
   (opcional: relaxar para string se preferir extensão sem alteração de tipo)
4. Criar PodaValidator se tiver regras de capacidade específicas; senão reutilizar um existente.
```

Nenhuma página React editada.

### Despacho como ponte explícita (Agendamento → Task)

O `DispatchAgendamentoUseCase` já existe e cria Tasks no Kanban. Com o formbuilder integrado, os dados preenchidos no agendamento viajam para a Task:

```typescript
// DispatchAgendamentoUseCase — adição ao mapeamento existente
function toTaskFromAgendamento(agendamento: Agendamento, slot: AgendamentoSlot): CreateTaskInput {
    const config = AGENDAMENTO_TIPOS[slot.tipoId];
    return {
        titulo:          `[${slot.tipoId}] ${agendamento.clienteId}`,
        formRegistryId:  slot.formSlugOverride ?? config.formSlug, // herda o form do agendamento
        demandaId:       agendamento.id,
        prazo:           slot.dataFim,
        atribuidoPara:   null, // atribuído após despacho
    };
}
```

Isso fecha o ciclo: o cidadão preenche o form no agendamento; o operador vê os mesmos dados na Task do Kanban via `formRegistryId` herdado.

---

## Consequências

### Positivas

1. **Motor único de datas**: `SlotEngine` e `RecurrenceEngine` em `packages/core` evitam divergência futura entre os módulos.
2. **Formulários extensíveis via DB + código**: novo tipo = uma entrada em `AGENDAMENTO_TIPOS` (TypeScript, versionado) + seed em `registro_formularios`. Nenhuma página React editada.
3. **Formbuilder reutilizado sem duplicação**: `DynamicFormEditor`, `useFormTemplate` e `useVisibilityEvaluator` servem tanto Task quanto Agendamento — zero código novo de renderização.
4. **Flags comportamentais eliminam `if (tipoId)` na UI**: `requerFotos` e `bairrosObrigatorios` no descritor substituem as 22 condicionais de tipoId nas páginas React.
5. **Override por slot**: um slot específico pode usar form diferente do padrão do tipo via `formSlugOverride` — extensibilidade sem alterar o descritor global.
6. **Despacho fecha o ciclo**: dados do form do agendamento chegam à Task no Kanban via `formRegistryId` herdado — operador vê o mesmo contexto que o cidadão preencheu.
7. **Consistência Mobile/Desktop**: `packages/core/scheduling` é compartilhado — o app mobile pode consumir `RecurrenceEngine` diretamente.

### Negativas / Custos

1. **Migração de `TaskRecurrence.ts`**: `calculateNextOccurrence` precisa ser extraído e todos os imports atualizados.
2. **Build de `packages/core`**: novo módulo no monorepo requer configuração de build (TypeScript path alias, eventual publicação interna).
3. **Seed de formulários**: as definições de form para museu/volumosos/evento precisam ser criadas em `registro_formularios` — requer traduzir as seções React hardcoded atuais para `FieldSchema[]`.
4. **Validators permanecem separados dos forms**: `MuseuValidator` etc. continuam existindo — são validação de negócio (capacidade), não de campos de formulário. `AGENDAMENTO_TIPOS` os une conceitualmente mas não os funde.

### Não muda

- Schema do banco (`tbl_agendamento_slots`, `tbl_agendamentos`, `tbl_tasks`) — inalterado.
- Ciclo de vida de `Agendamento` (`pendente → confirmado → realizado`) — inalterado.
- State machine de `Task` — inalterada.
- Use cases genéricos de agendamento (`CreateSlot`, `ConfirmAgendamento`, etc.) — inalterados.

---

## Ordem de Execução Recomendada

```
Fase 1 — Criar packages/core/scheduling com SlotEngine + RecurrenceEngine + tipos       ~1 dia
Fase 2 — Migrar TaskRecurrence.ts para re-export de @ecosuite/core                      ~2 horas
Fase 3 — Refatorar validators de agendamento para usar SlotEngine                       ~4 horas
Fase 4 — Criar AgendamentoFormSlugs.ts + seed FieldSchema[] em registro_formularios     ~1 dia
Fase 5 — Refatorar páginas React de agendamento para useFormTemplate + DynamicFormEditor ~1 dia
Fase 6 — Testes de regressão (todos os tipos, ambos módulos)                            ~1 dia
```

**Estimativa total**: ~5 dias de trabalho focado (1 dia a menos — sem fase de ServiceFormRegistry).

---

## Critérios de Aceitação

1. `grep -r 'slot\.tipoId ===' desktop/app/` retorna **zero resultados** nas páginas de agendamento.
2. `grep -r "from.*domain/task/TaskRecurrence"` retorna apenas o arquivo de re-export de `@ecosuite/core/scheduling`.
3. `SELECT COUNT(*) FROM registro_formularios WHERE form_id LIKE 'form-agendamento-%' AND ativo = 1` retorna **3** (museu, volumosos, evento).
4. `AgendamentoValidatorFactory` delega para `AGENDAMENTO_TIPOS[tipo].validator()` — sem switch/case duplicado.
5. Adicionar novo tipo = seed em `registro_formularios` + entrada em `AGENDAMENTO_TIPOS`; nenhum `page.tsx` editado.
6. Task criada via despacho carrega `formRegistryId` herdado do slot — operador vê o form do serviço no Kanban.
7. Todos os testes de agendamento (museu, volumosos, evento) e tarefas passam após a migração.
