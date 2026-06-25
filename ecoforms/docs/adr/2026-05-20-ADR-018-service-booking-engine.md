# ADR-018 — Service Booking Engine: Agendamentos Dinâmicos via Kanban + FormBuilder

- **Status**: Implementado
- **Data**: 2026-05-20
- **Autor**: Marcelo Luiz + Claude Code
- **Decisor**: Marcelo Luiz
- **Ciclo de vida**: Aceito → Implementado (critérios de aceitação verificados) → Supersedido
- **Supersede**: ADR-015 (Motor de Agendamento Compartilhado), ADR-017 (Unified Service Engine)
- **Relacionados**: ADR-014 (Adequação Arquitetural), ADR-016 (Workflow Ouvidoria)
- **Pré-condição**: Aplicação **não está em produção** — apagar e recriar é preferível a migrar

---

## Contexto

O módulo de agendamentos atual tem dois problemas centrais:

1. **Tipos de serviço hardcoded** — `'museu' | 'volumosos' | 'evento'` espalhados em 38 condicionais em 5 arquivos. Adicionar um novo tipo exige editar código.
2. **Entidade separada desnecessária** — `tbl_agendamentos` é uma entidade própria que, ao final do fluxo, vira uma Task no Kanban via despacho manual. O resultado é duplicação de ciclo de vida e duas UIs para o mesmo conceito.

O sistema já tem:
- **FormBuilder** (`registro_formularios` + `FormRenderer`) — forms configuráveis sem código
- **Kanban/tasks engine** — motor maduro de itens de trabalho com métricas, atribuição, subtarefas
- **SlotEngine** (`ecoforms-core`) — validação de capacidade e janelas de tempo

A visão é: gerentes configuram tipos de serviço via admin (sem recodificar), operadores registram bookings preenchendo o form dinâmico do tipo, e a Task já entra no Kanban imediatamente.

---

## Decisão

**Substituir completamente o domínio `agendamento/` pelo Service Booking Engine**, que unifica tipos dinâmicos, FormBuilder e Kanban em um único fluxo sem entidade intermediária.

### Princípios

1. **Task é o booking** — ao confirmar um booking, uma Task é criada diretamente no Kanban. Não existe entidade de "agendamento" separada.
2. **Tipo de serviço é dado, não código** — `tbl_service_types` persiste no banco; gerentes gerenciam via admin sem PR.
3. **Form é o contrato do serviço** — cada tipo vincula um `form_id` do FormBuilder. A UI de booking renderiza esse form via `FormRenderer`.
4. **Slot é a janela** — `tbl_service_slots` define quando/quanto o serviço está disponível. O slot não contém lógica de tipo — delega para `tbl_service_types`.
5. **Operador é o único ator de booking** — sem portal público por ora.

### Fluxo

```
Gerente cria Tipo de Serviço (/admin/service-types)
  └── vincula form do FormBuilder (form_id)
  └── define flags: requer_fotos, bairros_obrigatorios, capacidade_padrao, validator_key

Gerente cria Slot (/admin/agendamentos/slots/novo)
  └── seleciona Tipo de Serviço
  └── define: data_inicio, data_fim, horario, capacidade (override), bairros, status

Operador registra Booking (/agendamentos/novo?slotId=...)
  └── FormRenderer carrega form do Tipo de Serviço do slot
  └── Operador preenche dados + identifica cliente
  └── CreateBookingUseCase:
        1. Valida capacidade (SlotEngine.assertCapacidade)
        2. Valida regras de tipo (ServiceValidator por validator_key)
        3. Cria Task no Kanban (status: a_fazer, form_registry_id, dados_formulario)
        4. Incrementa vagas_ocupadas no slot
        └── Task aparece no Kanban imediatamente
```

---

## Modelo de Dados

### `tbl_service_types`

```sql
CREATE TABLE IF NOT EXISTS tbl_service_types (
    id          TEXT PRIMARY KEY,
    nome        TEXT NOT NULL,
    descricao   TEXT,
    form_id     TEXT,                       -- FK registro_formularios.form_id
    validator_key TEXT,                     -- 'museu' | 'volumosos' | 'evento' | null
    requer_fotos      INTEGER NOT NULL DEFAULT 0,
    bairros_obrigatorios INTEGER NOT NULL DEFAULT 0,
    capacidade_padrao INTEGER,
    icone       TEXT,
    cor         TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `tbl_service_slots`

```sql
CREATE TABLE IF NOT EXISTS tbl_service_slots (
    id              TEXT PRIMARY KEY,
    service_type_id TEXT NOT NULL REFERENCES tbl_service_types(id),
    titulo          TEXT NOT NULL,
    descricao       TEXT,
    data_inicio     TEXT NOT NULL,
    data_fim        TEXT NOT NULL,
    horario_inicio  TEXT,
    horario_fim     TEXT,
    capacidade      INTEGER,                -- override; null = sem limite
    bairros         TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
    local           TEXT,
    vagas_ocupadas  INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'rascunho',
    criado_por      TEXT NOT NULL,
    criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**`tarefas`** — nenhuma coluna nova obrigatória. O booking usa colunas existentes:
- `form_registry_id` — form_id do tipo de serviço
- `carga` — JSON com dados preenchidos no FormRenderer
- `origem` — `'booking'`
- `titulo` — `[NomeTipo] · NomeCliente · DataSlot`

> `tbl_agendamento_slots` e `tbl_agendamentos` são **deletadas**.

---

## Estrutura de Código

### O que é deletado

```
src/domain/agendamento/
src/application/agendamento/
src/infrastructure/persistence/sqlite/SqliteAgendamentoRepository.ts
src/infrastructure/persistence/sqlite/SqliteAgendamentoSlotRepository.ts
src/infrastructure/persistence/sqlite/queries/agendamento/
src/interface/hooks/queries/useAgendamentoSlots.ts
src/interface/hooks/queries/useAgendamentoSlotById.ts
src/interface/hooks/queries/useAgendamentos.ts
src/interface/hooks/queries/useAgendamentoFotos.ts
src/interface/hooks/mutations/useAgendamentoMutations.ts
src/interface/hooks/mutations/useAgendamentoFotoUpload.ts
src/interface/hooks/catalog/agendamentos.ts
app/agendamentos/              (todas as páginas atuais)
app/admin/agendamentos/        (todas as páginas atuais)
```

> `packages/core/src/scheduling/SlotEngine.ts` — **mantido** (reutilizado)
> `packages/core/src/scheduling/RecurrenceEngine.ts` — **mantido** (reutilizado)
> Validators (MuseuValidator, VolumososValidator, EventoValidator) — **migrados** para `src/domain/service/validators/`

### O que é criado

```
src/domain/service/
  ServiceType.ts               — entidade tipo (id, nome, formId, flags, validatorKey)
  ServiceSlot.ts               — entidade slot (dataInicio, dataFim, capacidade, bairros, vagasOcupadas)
  ServiceSlotRepository.ts     — interface
  ServiceTypeRepository.ts     — interface
  ServiceEvents.ts             — SlotCriado, SlotPublicado, BookingCriado

src/application/service/
  CreateServiceTypeUseCase.ts
  UpdateServiceTypeUseCase.ts
  ListServiceTypesUseCase.ts
  CreateServiceSlotUseCase.ts
  PublishServiceSlotUseCase.ts
  CancelServiceSlotUseCase.ts
  CreateBookingUseCase.ts      — valida + cria Task
  validators/
    ServiceValidator.ts        — interface
    ServiceValidatorFactory.ts — validator_key → implementação
    MuseuValidator.ts          — migrado (usa assertCapacidade do core)
    VolumososValidator.ts      — migrado (usa isBairroAtendido do core)
    EventoValidator.ts         — migrado (usa assertCapacidade do core)

src/infrastructure/persistence/sqlite/
  SqliteServiceTypeRepository.ts
  SqliteServiceSlotRepository.ts
  queries/service/
    index.ts
    service-type-queries.ts
    service-slot-queries.ts

src/interface/hooks/queries/
  useServiceTypes.ts
  useServiceSlots.ts

src/interface/hooks/mutations/
  useServiceMutations.ts

src/interface/hooks/catalog/
  service.ts                   — re-export unificado

app/agendamentos/
  page.tsx                     — lista slots publicados; tabs dinâmicos por tipo (sem hardcode)
  novo/page.tsx                — FormRenderer carregado por slot.serviceType.formId; zero if(tipoId)

app/admin/agendamentos/
  page.tsx                     — lista slots com filtros
  slots/
    novo/page.tsx              — cria slot: seleciona Tipo de Serviço, define janela
    [id]/page.tsx              — detalhe slot + tasks vinculadas no Kanban

app/admin/service-types/
  page.tsx                     — lista tipos ativos
  novo/page.tsx                — cria tipo: nome, form_id, flags, validator_key
  [id]/page.tsx                — edita tipo
```

---

## CreateBookingUseCase — lógica central

```typescript
// Pseudocódigo
async execute(input: CreateBookingInput): Promise<string> {
    const slot = await slotRepo.findById(input.slotId);
    // guard: slot publicado e não vencido
    if (slot.status !== 'publicado') throw new Error('Slot indisponível');
    if (new Date(slot.dataFim) < new Date()) throw new Error('Slot encerrado');

    const serviceType = await typeRepo.findById(slot.serviceTypeId);
    const validator = ServiceValidatorFactory.create(serviceType.validatorKey);

    // valida regras do tipo (capacidade, fotos, bairro, etc.)
    await validator.validate(slot, input);

    // cria Task no Kanban
    const taskId = uuidv7();
    const titulo = `[${serviceType.nome}] ${input.clienteNome} · ${formatDate(slot.dataInicio)}`;
    await db.execute(
        `INSERT INTO tarefas (id, titulo, status, form_registry_id, carga, origem, ...)
         VALUES (?, ?, 'a_fazer', ?, ?, 'booking', ...)`,
        [taskId, titulo, serviceType.formId, JSON.stringify(input.dadosFormulario), ...]
    );

    // incrementa vagas
    await db.execute(
        `UPDATE tbl_service_slots SET vagas_ocupadas = vagas_ocupadas + ? WHERE id = ?`,
        [input.vagasSolicitadas ?? 1, slot.id]
    );

    await eventBus.publish(BookingCriado, { taskId, slotId: slot.id, criadoPor: input.userId });
    return taskId;
}
```

---

## UI de Booking — sem if(tipoId)

```tsx
// app/agendamentos/novo/page.tsx — depois
const { slot } = useServiceSlotById(slotId);
const serviceType = slot?.serviceType;
const { template } = useFormTemplate(serviceType?.formId ?? null);

// renderização inteiramente dinâmica
<FormRenderer
    content={template}
    formType={serviceType.formId}
    customSubmit={async (dados) => {
        await createBooking({ slotId, dadosFormulario: dados, clienteId, ... });
        router.push('/agendamentos');
    }}
/>
```

---

## Ordem de Execução

```
Fase 1 — Schema e dados base                           ~0,5 dia
  ├── Adicionar tbl_service_types + tbl_service_slots em ensure-columns.ts
  └── Seed dos 3 tipos iniciais (museu, volumosos, evento) + seus form_ids

Fase 2 — Domínio + use cases                           ~1 dia
  ├── ServiceType.ts, ServiceSlot.ts, interfaces de repo
  ├── CreateBookingUseCase (validação + task creation)
  ├── Migrar validators para src/domain/service/validators/
  └── ServiceValidatorFactory

Fase 3 — Infraestrutura                                ~0,5 dia
  ├── SqliteServiceTypeRepository
  ├── SqliteServiceSlotRepository
  └── Queries SQL centralizadas

Fase 4 — Hooks                                         ~0,5 dia
  ├── useServiceTypes, useServiceSlots
  └── useServiceMutations (createSlot, publishSlot, createBooking)

Fase 5 — Admin de tipos de serviço                     ~1 dia
  └── /admin/service-types — CRUD com seletor de form_id

Fase 6 — Admin de slots                                ~1 dia
  └── /admin/agendamentos — lista + criar slot (seleciona Tipo, define janela)
  └── /admin/agendamentos/slots/[id] — detalhe com tasks vinculadas

Fase 7 — UI de booking                                 ~1 dia
  ├── /agendamentos — lista slots disponíveis (tabs dinâmicos por tipo)
  └── /agendamentos/novo — FormRenderer dinâmico; zero hardcode

Fase 8 — Limpeza                                       ~0,5 dia
  ├── Deletar domínio agendamento/ legado
  ├── Deletar páginas legadas
  └── Remover tbl_agendamento_slots + tbl_agendamentos de ensure-columns.ts
```

**Estimativa total: ~6 dias de trabalho focado**

---

## Critérios de Aceitação

1. `grep -r "tipoId ===" desktop/app/` retorna **zero resultados**
2. `grep -r "tipoId ===" desktop/src/` retorna **zero resultados** (exceto ServiceValidatorFactory)
3. Adicionar novo tipo de serviço = criar form no FormBuilder + inserir linha em `tbl_service_types` via admin; **nenhum arquivo TypeScript editado**
4. Booking cria Task no Kanban com `form_registry_id` e `carga` preenchidos
5. `SELECT * FROM tbl_agendamento_slots` e `SELECT * FROM tbl_agendamentos` retornam erro de tabela inexistente
6. `SELECT COUNT(*) FROM tbl_service_types WHERE ativo = 1` retorna ≥ 3 (museu, volumosos, evento seedados)
7. `/admin/service-types` permite criar, editar e desativar tipos sem deploys
8. Kanban exibe tasks de booking com dados do formulário visíveis no detalhe da task
9. TypeScript type-check: zero erros (`tsc --noEmit`)
