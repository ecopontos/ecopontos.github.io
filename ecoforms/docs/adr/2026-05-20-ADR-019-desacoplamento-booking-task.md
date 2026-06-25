# ADR-019 — Desacoplamento Booking/Task via Entidade Agendamento + Handler de Ponte

- **Status**: Implementado
- **Data**: 2026-05-20
- **Autor**: Marcelo Luiz + Claude Code
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Amenda**: ADR-018 (Service Booking Engine) — reverte o princípio "Task é o booking"
- **Relacionados**: ADR-014 (Adequação Arquitetural), ADR-015 (Motor de Agendamento), ADR-018

---

## Contexto

ADR-018 estabeleceu o princípio **"Task é o booking"**: ao confirmar um agendamento, uma Task é criada diretamente no Kanban e nenhuma entidade de booking separada é persistida. Isso foi intencional para eliminar duplicação de ciclo de vida.

Na prática, a fusão gerou cinco lacunas operacionais que bloqueiam funcionalidades básicas de qualquer sistema de booking:

| Lacuna | Causa raiz |
|---|---|
| Sem cancelamento individual de booking | Cancelar o booking = cancelar a Task; `vagasOcupadas` nunca diminui |
| Sem controle de dupla reserva por cliente | `CreateBookingUseCase` não tem `clienteId` rastreável separado da Task |
| Sem histórico de bookings por cliente | Não há tabela com `(cliente_id, slot_id)` consultável |
| `/minhas-solicitacoes` usa status de Task | Semântica errada — usuário vê `a_fazer`/`em_progresso` em vez de `confirmado`/`cancelado` |
| Vagas nunca são devolvidas | Sem entidade de booking, não há o que cancelar individualmente |

O problema não é a Task em si — o problema é que **o pedido do cliente** (Agendamento) e **a ordem de trabalho** (Task) têm ciclos de vida diferentes e foram colapsados em um.

---

## Decisão

**Introduzir `Agendamento` como entidade de primeira classe** e manter a criação da Task como efeito colateral acionado por evento de domínio, usando o mesmo padrão já existente no projeto (`CloseTasksOnDemandaEncerradaHandler`, etc.).

### Princípio central

```
Agendamento = o que o cliente pediu     (lifecycle: pendente → confirmado → realizado | cancelado)
Task        = o que a equipe executa    (lifecycle: a_fazer → em_progresso → concluido | cancelado)
```

A Task continua sendo criada automaticamente. O que muda é **quem a cria e quando**: não mais o `CreateBookingUseCase` diretamente, mas um handler reativo ao evento `AGENDAMENTO_CONFIRMADO`.

### Fluxo

```
CreateBookingUseCase
  → valida slot (capacidade, tipo, bairro)
  → persiste Agendamento {status: 'pendente'}
  → incrementa vagas_ocupadas no slot
  → emite AGENDAMENTO_CRIADO

  [se confirmação automática — padrão inicial]
  → confirma Agendamento imediatamente
  → emite AGENDAMENTO_CONFIRMADO

CriarTaskParaAgendamentoHandler   ← novo, registrado no DomainEventBus
  → escuta AGENDAMENTO_CONFIRMADO
  → cria Task via TaskRepository
      titulo  = [ServiceType.nome] ClienteNome · DataSlot
      carga   = Agendamento.dadosFormulario
      origem  = 'booking'
      agendamento_id = Agendamento.id

CancelarAgendamentoUseCase        ← novo
  → transiciona Agendamento para 'cancelado'
  → decrementa vagas_ocupadas no slot
  → NÃO altera a Task (segue fluxo próprio de cancelamento de task se necessário)
  → emite AGENDAMENTO_CANCELADO
```

---

## Ciclos de Vida

### `Agendamento`

```
pendente ──→ confirmado ──→ realizado
    │              │
    └──────────────┴──→ cancelado
```

- `pendente`: booking registrado, aguarda confirmação (manual ou automática)
- `confirmado`: operador/sistema confirmou; Task já foi criada pelo handler
- `realizado`: serviço executado (transição opcional, pode vir de webhook/Task concluída)
- `cancelado`: booking cancelado; vaga devolvida ao slot

### `Task` (inalterada)

```
aguardando_aprovacao → a_fazer → em_progresso → concluido
                                                     │
                                            cancelado (qualquer estado)
```

---

## Formulário Único: Booking e Execução

`ServiceType.formId` aponta para **um único formulário** que serve os dois momentos do processo:

| Momento | Ator | O que acontece com o form |
|---|---|---|
| Booking (agendamento) | Operador / solicitante | Preenche o formulário — dados ficam em `Agendamento.dadosFormulario` |
| Execução (atendimento) | Operador de campo | Vê o mesmo formulário pré-preenchido, confirma ou corrige dados, registra resultado |

O handler passa `carga = agendamento.dadosFormulario` ao criar a Task. O `FormRenderer` da task já usa `carga` para pré-popular campos — nenhuma lógica nova necessária.

```
Task aberta pelo operador:
  formRegistryId → carrega template do formulário (ServiceType.formId)
  carga          → pré-preenche campos com dados do agendamento
  agendamento_id → identifica o booking de origem

  Operador confirma, corrige ou registra intercorrência
  → resultado salvo como nova versão de carga ou action_log
```

Isso elimina a necessidade de `formExecucaoId` separado: o conteúdo a confirmar ou alterar **é o mesmo** que foi solicitado no booking. A identidade do agendamento (`agendamento_id`) na task garante rastreabilidade completa do processo.

---

## Modelo de Dados

### `tbl_agendamentos` — nova tabela

```sql
CREATE TABLE IF NOT EXISTS tbl_agendamentos (
    id              TEXT PRIMARY KEY,
    slot_id         TEXT NOT NULL REFERENCES tbl_service_slots(id),
    service_type_id TEXT NOT NULL REFERENCES tbl_service_types(id),
    cliente_id      TEXT NOT NULL,
    cliente_nome    TEXT NOT NULL,
    vagas_solicitadas INTEGER NOT NULL DEFAULT 1,
    bairro          TEXT,
    dados_formulario TEXT NOT NULL DEFAULT '{}',  -- JSON
    status          TEXT NOT NULL DEFAULT 'pendente',  -- pendente|confirmado|realizado|cancelado
    task_id         TEXT,                          -- preenchido pelo handler após AGENDAMENTO_CONFIRMADO
    responsavel_id  TEXT,
    criado_por      TEXT NOT NULL,
    criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_slot    ON tbl_agendamentos(slot_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON tbl_agendamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status  ON tbl_agendamentos(status);
```

### `tarefas` — adição de coluna

```sql
ALTER TABLE tarefas ADD COLUMN agendamento_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tarefas_agendamento ON tarefas(agendamento_id);
```

> `tbl_service_types` e `tbl_service_slots` — **sem alterações**

---

## Conformidade com Clean Architecture e Catálogos

Esta seção é normativa para o refatorador. Qualquer desvio é um bug de arquitetura.

### Regras de camada

```
domain/          → entidades, interfaces de repositório, eventos, value objects
                   NUNCA importa de application/, infrastructure/ ou interface/

application/     → use cases, handlers, ports (interfaces)
                   importa APENAS de domain/ e ports/
                   NUNCA importa de infrastructure/ ou interface/

infrastructure/  → implementações de repositório, SQL, adapters externos
                   importa de domain/ e application/ports/
                   NUNCA importa de interface/

interface/hooks/ → consome use cases via DI container (getContainerAsync)
                   NUNCA chama useSQLiteQuery / useSQLiteMutation diretamente
                   NUNCA embute SQL inline
                   NUNCA importa de infrastructure/ diretamente

app/ (Next.js)   → importa hooks APENAS via catálogo (catalog/service)
                   NUNCA importa de queries/ ou mutations/ diretamente
```

### Catálogo de hooks — `catalog/service.ts`

Arquivo existente recebe as novas exportações do domínio de agendamento:

```typescript
// src/interface/hooks/catalog/service.ts  (versão final)
export { useServiceTypes }           from '../queries/useServiceTypes';
export { useServiceSlots,
         useServiceSlotById }        from '../queries/useServiceSlots';
export { useServiceMutations }       from '../mutations/useServiceMutations';
export { useBookingTasks }           from '../queries/useBookingTasks';
// --- novos ---
export { useAgendamentos,
         useAgendamentoById }        from '../queries/useAgendamentos';
export { useAgendamentoNotificacoes} from '../queries/useAgendamentoNotificacoes';
export { useAgendamentoMutations }   from '../mutations/useAgendamentoMutations';
export { useMinhasTarefasCampo }     from '../queries/useMinhasTarefasCampo';
```

O `catalog/index.ts` já faz `export * from './service'` — nenhuma alteração no index necessária.

### Catálogo de queries SQL — `queries/service/agendamento-queries.ts`

Todas as queries do domínio de agendamento vivem neste arquivo e são exportadas para o `QUERY_CATALOG`. Nenhum SQL aparece em repositórios, hooks ou componentes.

```typescript
// src/infrastructure/persistence/sqlite/queries/service/agendamento-queries.ts

export const AGENDAMENTOS_RESUMO: QueryDef = {
  sql: `SELECT status, COUNT(*) AS total FROM tbl_agendamentos GROUP BY status`,
  description: 'Resumo de agendamentos por status',
  params: [], use: 'dashboard',
  returns: '{ status, total }[]',
};

export const AGENDAMENTOS_POR_SLOT: QueryDef = {
  sql: `SELECT a.*, u.nome AS responsavel_nome
        FROM tbl_agendamentos a
        LEFT JOIN usuarios u ON u.id = a.responsavel_id
        WHERE a.slot_id = ?
        ORDER BY a.criado_em ASC`,
  description: 'Lista de agendamentos de um slot com responsável',
  params: ['slot_id'], use: 'operacional',
  returns: 'AgendamentoRow[]',
};

export const AGENDAMENTOS_POR_CLIENTE: QueryDef = {
  sql: `SELECT a.*, st.nome AS tipo_nome, ss.data_inicio, ss.data_fim
        FROM tbl_agendamentos a
        JOIN tbl_service_slots  ss ON ss.id = a.slot_id
        JOIN tbl_service_types  st ON st.id = a.service_type_id
        WHERE a.cliente_id = ?
        ORDER BY ss.data_inicio DESC`,
  description: 'Histórico de agendamentos de um cliente',
  params: ['cliente_id'], use: 'operacional',
  returns: 'AgendamentoComSlotRow[]',
};

export const AGENDAMENTOS_VAGAS_OCUPACAO: QueryDef = {
  sql: `SELECT ss.id, ss.titulo, ss.capacidade, ss.vagas_ocupadas,
               ROUND(CAST(ss.vagas_ocupadas AS REAL) / ss.capacidade, 2) AS ocupacao_pct
        FROM tbl_service_slots ss
        WHERE ss.status = 'publicado' AND ss.capacidade IS NOT NULL
        ORDER BY ocupacao_pct DESC`,
  description: 'Ocupação percentual dos slots publicados com capacidade',
  params: [], use: 'dashboard',
  returns: '{ id, titulo, capacidade, vagas_ocupadas, ocupacao_pct }[]',
};

export const SLOTS_COM_VAGAS_DISPONIVEIS: QueryDef = {
  sql: `SELECT ss.*, st.nome AS tipo_nome, st.icone, st.cor, st.form_id,
               st.validator_key, st.abertura_regra,
               (ss.capacidade - ss.vagas_ocupadas) AS vagas_livres
        FROM tbl_service_slots ss
        JOIN tbl_service_types st ON st.id = ss.service_type_id
        WHERE ss.status = 'publicado'
          AND (ss.capacidade IS NULL OR ss.vagas_ocupadas < ss.capacidade)
          AND (ss.abertura_em IS NULL OR ss.abertura_em <= datetime('now'))
          AND date(ss.data_fim) >= date('now')
        ORDER BY ss.data_inicio ASC`,
  description: 'Slots publicados com vagas disponíveis e janela de abertura aberta',
  params: [], use: 'operacional',
  returns: 'SlotComTipoRow[]',
};

export const TAREFAS_CAMPO_HOJE: QueryDef = {
  sql: `SELECT t.id, t.titulo, t.status, t.carga, t.agendamento_id,
               t.atribuido_para, t.prazo
        FROM tarefas t
        WHERE t.origem = 'booking'
          AND t.atribuido_para = ?
          AND date(t.prazo) = date('now')
          AND t.status NOT IN ('concluido', 'cancelado')
        ORDER BY t.prazo ASC`,
  description: 'Tasks de campo do operador para hoje (origem booking)',
  params: ['usuario_id'], use: 'operacional',
  returns: 'TarefaCampoRow[]',
};
```

Estas queries são adicionadas ao `QUERY_CATALOG` em `queries/index.ts`:

```typescript
// queries/index.ts — acréscimo à seção de service/agendamentos
export {
  AGENDAMENTOS_RESUMO,
  AGENDAMENTOS_POR_SLOT,
  AGENDAMENTOS_POR_CLIENTE,
  AGENDAMENTOS_VAGAS_OCUPACAO,
  SLOTS_COM_VAGAS_DISPONIVEIS,
  TAREFAS_CAMPO_HOJE,
} from './service/agendamento-queries';
```

E incluídos no objeto `QUERY_CATALOG`.

### Repositório segue o padrão existente

`SqliteAgendamentoRepository` importa as queries do catálogo — não define SQL inline:

```typescript
import { AGENDAMENTOS_POR_SLOT, AGENDAMENTOS_POR_CLIENTE }
    from '../queries/service/agendamento-queries';

export class SqliteAgendamentoRepository implements AgendamentoRepository {
    async findBySlotId(slotId: string): Promise<AgendamentoRow[]> {
        return this.sqlite.query(AGENDAMENTOS_POR_SLOT.sql, [slotId]);
    }
    async findByClienteId(clienteId: string): Promise<AgendamentoComSlotRow[]> {
        return this.sqlite.query(AGENDAMENTOS_POR_CLIENTE.sql, [clienteId]);
    }
    // ...
}
```

### Hooks seguem o padrão existente

Hooks consomem use cases via `getContainerAsync()` — não acessam SQLite diretamente:

```typescript
// src/interface/hooks/queries/useAgendamentos.ts
export function useAgendamentos(filtros?: AgendamentoFiltros) {
    const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([]);
    useEffect(() => {
        getContainerAsync()
            .then(c => c.listAgendamentosUseCase.execute(filtros))
            .then(setAgendamentos);
    }, [filtros]);
    return { agendamentos };
}
```

### O que o refatorador NÃO pode fazer

- SQL inline em hooks, componentes ou use cases
- `useSQLiteQuery` / `useSQLiteMutation` em hooks de negócio
- `import` cruzando camadas para cima (infra → domain OK; domain → infra PROIBIDO)
- Componentes importando de `queries/useAgendamentos` diretamente (deve ser via `catalog/service`)
- Lógica de negócio (validação de vagas, verificação de abertura) em hooks ou componentes

---

## Estrutura de Código

### O que é criado

```
src/domain/service/
  Agendamento.ts                  — entidade com state machine própria
  AgendamentoRepository.ts        — interface (findById, findBySlotId, findByClienteId, save)
  ServiceEvents.ts                — adiciona AGENDAMENTO_CRIADO, AGENDAMENTO_CONFIRMADO,
                                    AGENDAMENTO_CANCELADO, AGENDAMENTO_REALIZADO

src/application/service/
  CreateBookingUseCase.ts         — modificado: persiste Agendamento; não cria Task diretamente
  ConfirmarAgendamentoUseCase.ts  — novo: pendente → confirmado + emite AGENDAMENTO_CONFIRMADO
  CancelarAgendamentoUseCase.ts   — novo: * → cancelado + decrementa vagas + emite AGENDAMENTO_CANCELADO
  GetAgendamentoUseCase.ts        — novo: busca por id com slot e tipo resolvidos
  ListAgendamentosUseCase.ts      — novo: filtros por clienteId, slotId, status

src/application/service/handlers/
  CriarTaskParaAgendamentoHandler.ts  — escuta AGENDAMENTO_CONFIRMADO → cria Task

src/infrastructure/persistence/sqlite/
  SqliteAgendamentoRepository.ts  — novo
  queries/service/
    agendamento-queries.ts        — novo
```

### O que é alterado

```
src/application/service/CreateBookingUseCase.ts
  - remove: import BookingTaskRepository
  - remove: criação direta de Task dentro da transação
  - adiciona: AgendamentoRepository como dependência
  - adiciona: persiste Agendamento + chama ConfirmarAgendamento (se auto-confirm)

src/domain/service/BookingTaskRepository.ts
  → deprecado após migração; deletado na fase de limpeza

src/infrastructure/container/modules/ContainerModule.ts (ou equivalente)
  → registra SqliteAgendamentoRepository
  → registra CriarTaskParaAgendamentoHandler no DomainEventBus
  → registra ConfirmarAgendamentoUseCase, CancelarAgendamentoUseCase
```

### O que não muda

```
domain/task/Task.ts              — zero alterações
domain/task/TaskStatus.ts        — zero alterações
domain/service/ServiceSlot.ts    — zero alterações
domain/service/ServiceType.ts    — zero alterações
domain/service/validators/       — zero alterações
application/service/*SlotUseCase — zero alterações
app/admin/agendamentos/          — zero alterações
app/admin/service-types/         — zero alterações
```

---

## Entidade Agendamento

```typescript
// src/domain/service/Agendamento.ts

export type StatusAgendamento = 'pendente' | 'confirmado' | 'realizado' | 'cancelado';

const TRANSICOES: Record<StatusAgendamento, StatusAgendamento[]> = {
    pendente:   ['confirmado', 'cancelado'],
    confirmado: ['realizado', 'cancelado'],
    realizado:  [],
    cancelado:  [],
};

export interface AgendamentoProps {
    id: string;
    slotId: string;
    serviceTypeId: string;
    clienteId: string;
    clienteNome: string;
    vagasSolicitadas: number;
    bairro?: string | null;
    dadosFormulario: Record<string, unknown>;
    status: StatusAgendamento;
    taskId?: string | null;
    responsavelId?: string | null;
    criadoPor: string;
    criadoEm: string;
    atualizadoEm: string;
}

export class Agendamento {
    private constructor(private props: AgendamentoProps) {}

    static fromProps(props: AgendamentoProps): Agendamento {
        if (!props.id) throw new Error('Agendamento requer id');
        if (!props.clienteId) throw new Error('Agendamento requer clienteId');
        return new Agendamento({ ...props });
    }

    get id()                { return this.props.id; }
    get slotId()            { return this.props.slotId; }
    get serviceTypeId()     { return this.props.serviceTypeId; }
    get clienteId()         { return this.props.clienteId; }
    get clienteNome()       { return this.props.clienteNome; }
    get vagasSolicitadas()  { return this.props.vagasSolicitadas; }
    get dadosFormulario()   { return this.props.dadosFormulario; }
    get status()            { return this.props.status; }
    get taskId()            { return this.props.taskId; }
    get responsavelId()     { return this.props.responsavelId; }

    podeTransitarPara(novoStatus: StatusAgendamento): boolean {
        return TRANSICOES[this.props.status]?.includes(novoStatus) ?? false;
    }

    transitionTo(novoStatus: StatusAgendamento): void {
        if (!this.podeTransitarPara(novoStatus)) {
            throw new Error(`Transição inválida: '${this.props.status}' → '${novoStatus}'`);
        }
        this.props.status = novoStatus;
        this.props.atualizadoEm = new Date().toISOString();
    }

    vinculaTask(taskId: string): void {
        this.props.taskId = taskId;
        this.props.atualizadoEm = new Date().toISOString();
    }

    toProps(): AgendamentoProps { return { ...this.props }; }
}
```

---

## Handler de Ponte

```typescript
// src/application/service/handlers/CriarTaskParaAgendamentoHandler.ts

export class CriarTaskParaAgendamentoHandler {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly taskRepo: TaskRepository,
        private readonly slotRepo: ServiceSlotRepository,
        private readonly typeRepo: ServiceTypeRepository,
        private readonly sqlite: SqlitePort,
    ) {}

    async handle(payload: AgendamentoConfirmadoPayload): Promise<void> {
        const agendamento = await this.agendamentoRepo.findById(payload.agendamentoId);
        if (!agendamento) return;

        const slot = await this.slotRepo.findById(agendamento.slotId);
        const serviceType = await this.typeRepo.findById(agendamento.serviceTypeId);

        const taskId = uuidv7();
        const titulo = `[${serviceType!.nome}] ${agendamento.clienteNome} · ${formatDate(slot!.dataInicio)}`;
        const now = new Date().toISOString();

        await this.sqlite.transaction(async () => {
            await this.taskRepo.save(Task.fromProps({
                id: taskId,
                titulo,
                status: 'a_fazer',
                prioridade: 'media',
                ordem: Date.now(),
                criadoPor: agendamento.responsavelId ?? payload.criadoPor,
                atribuidoPara: agendamento.responsavelId ?? null,
                prazo: slot!.dataFim,
                formRegistryId: serviceType!.formId ?? null,
                // carga pré-preenche o FormRenderer com os dados do agendamento
                // agendamento_id via coluna extra em tarefas
            }));
            // INSERT carga + agendamento_id diretamente via sqlite (fora do Task.fromProps)
            await this.sqlite.execute(
                `UPDATE tarefas SET carga = ?, agendamento_id = ?, origem = 'booking' WHERE id = ?`,
                [JSON.stringify(agendamento.dadosFormulario), agendamento.id, taskId],
            );

            agendamento.vinculaTask(taskId);
            await this.agendamentoRepo.save(agendamento);
        });
    }
}
```

---

## Janela de Abertura de Agendamento

### Problema

Um slot `publicado` não necessariamente está aberto para booking imediatamente. A equipe de remoção abre a agenda uma semana antes do período do bairro; o museu abre a cada semestre em data fixa. Precisamos controlar **quando** um slot aceita bookings, separado de quando ele está publicado.

### Decisão

Adicionar `abertura_regra` ao `ServiceType` (padrão do tipo) e `abertura_em` ao `ServiceSlot` (valor computado ou definido explicitamente). Nenhum novo status é criado — slot `publicado` com `abertura_em` no futuro ainda não aceita bookings.

### Regras de abertura

```typescript
// ServiceType — regra padrão para todos os slots deste tipo
abertura_regra: {
    tipo: 'imediato'           // aceita booking assim que publicado
         | 'antecedencia_dias' // abre X dias antes de slot.data_inicio
         | 'data_especifica'   // admin define a data manualmente por slot
    antecedencia_dias?: number // só quando tipo = 'antecedencia_dias'
}
```

Exemplos:
| Tipo de serviço | Regra | Resultado |
|---|---|---|
| Coleta de Volumosos | `antecedencia_dias: 7` | `abertura_em = data_inicio − 7 dias` |
| Museu do Lixo | `data_especifica` | Admin informa `abertura_em` ao criar o slot (ex: `2026-07-01`) |
| Evento / Palestra | `imediato` | `abertura_em = null` — aceita booking logo ao publicar |

### Schema

```sql
-- ServiceType: regra padrão
ALTER TABLE tbl_service_types ADD COLUMN abertura_regra TEXT NOT NULL DEFAULT '{"tipo":"imediato"}';

-- ServiceSlot: valor concreto computado na criação
ALTER TABLE tbl_service_slots ADD COLUMN abertura_em TEXT;
-- null = sem restrição de janela (tipo imediato)
-- ISO datetime = mínimo para aceitar bookings

CREATE INDEX IF NOT EXISTS idx_service_slots_abertura ON tbl_service_slots(abertura_em);
```

### Cálculo de `abertura_em` na criação do slot

`CreateServiceSlotUseCase` computa `abertura_em` a partir da regra do tipo:

```typescript
function calcularAbertura(regra: AberturaRegra, dataInicio: string): string | null {
    if (regra.tipo === 'imediato') return null;
    if (regra.tipo === 'antecedencia_dias') {
        const d = new Date(dataInicio);
        d.setDate(d.getDate() - regra.antecedencia_dias!);
        return d.toISOString();
    }
    // 'data_especifica': obrigatório informar no input — validado pelo use case
    return null; // preenchido pelo admin via input.aberturaEm
}
```

Para `data_especifica`, o admin informa `abertura_em` manualmente ao criar ou editar o slot. O `UpdateServiceSlotUseCase` também aceita alteração de `abertura_em` enquanto o slot não estiver encerrado.

### Validação no booking

`CreateBookingUseCase` adiciona um guard antes de aceitar a reserva:

```typescript
if (slot.aberturaEm && new Date() < new Date(slot.aberturaEm)) {
    throw new Error(
        `Agendamentos para este slot abrem em ${formatDate(slot.aberturaEm)}`
    );
}
```

### UI — Admin de slots

O formulário de criação/edição de slot exibe o campo `abertura_em` condicionalmente:
- `imediato` → campo oculto
- `antecedencia_dias` → campo read-only calculado, exibido como info ("Abre em: 18/05/2026")
- `data_especifica` → date picker obrigatório

---

## Campo de Localização e View de Campo

### Campo `mapa` no FormRenderer

O `registro_formularios` ganha suporte a um novo tipo de campo `mapa`, que persiste lat/lng + endereço formatado dentro do JSON de `carga` da task. O operador que registra o booking informa o local exato via picker de mapa.

```json
// exemplo de carga com campo mapa
{
  "bairro": "Centro",
  "tiposResiduo": ["moveis", "eletrodomesticos"],
  "localizacao": {
    "lat": -23.5489,
    "lng": -46.6388,
    "endereco": "Rua das Flores, 123 — Centro"
  }
}
```

O campo `mapa` é renderizado pelo `FormRenderer` como picker no momento do booking e como pin estático (read-only) quando o operador abre a task em campo.

### View de campo — "Meus atendimentos hoje"

Página ou modal acessível ao operador de campo mostrando todas as tasks do dia com `origem = 'booking'` atribuídas a ele. Independente do módulo de roteirização — o operador define a própria ordem de visita.

```
/minhas-tarefas-campo

  Lista lateral                     Mapa
  ┌──────────────────┐   ┌────────────────────────────┐
  │ ● Coleta - Rua X │   │                            │
  │ ● Coleta - Rua Y │   │   📍 A      📍 B           │
  │ ● Museu - Centro │   │          📍 C              │
  │                  │   │                            │
  └──────────────────┘   └────────────────────────────┘

  Clique no pin ou item → abre detalhe da task
  Detalhe: formulário pré-preenchido do agendamento
  Ações: Realizado | Não realizado | Intercorrência
```

**Filtro da query:**
```sql
SELECT t.* FROM tarefas t
WHERE t.atribuido_para = :userId
  AND t.origem = 'booking'
  AND t.prazo >= date('now')
  AND t.prazo < date('now', '+1 day')
  AND t.status NOT IN ('concluido', 'cancelado')
```

Os pins são extraídos de `JSON_EXTRACT(t.carga, '$.localizacao.lat')` e `$.localizacao.lng` — sem coluna nova em `tarefas`.

### O que NÃO é feito agora

- Sequenciamento automático de paradas (módulo de roteirização é incipiente)
- Integração com `app/logistica/roteiros` — fica para quando o módulo amadurecer
- Otimização de rota por distância/tempo

A view de campo é deliberadamente simples: mostra os pontos, deixa o operador decidir a ordem.

---

## Notificação de Confirmação ao Usuário

### Infraestrutura existente (reaproveitada de Manifestações)

| Canal | Implementação | Localização |
|---|---|---|
| E-mail | `invoke('send_email', { to, subject, body })` — SMTP via Rust (`lettre`) | `src-tauri/src/commands/email.rs` |
| WhatsApp | Link `https://wa.me/{phone}?text={msg}` aberto no browser | `ManifestacaoDetailPage.tsx:306` |

Configuração SMTP já existe em `tbl_email_config` (admin em `/admin/email`). O tipo `CanalEnvio = 'email' | 'whatsapp' | 'portal' | 'impresso'` já está definido em `ManifestacaoRepository.ts`.

### Dados de contato no Agendamento

`tbl_agendamentos` recebe duas colunas de contato para o handler ter acesso direto sem parsear o JSON de `dados_formulario`:

```sql
ALTER TABLE tbl_agendamentos ADD COLUMN cliente_email    TEXT;
ALTER TABLE tbl_agendamentos ADD COLUMN cliente_telefone TEXT;
```

Preenchidos no `CreateBookingUseCase` a partir do registro do cliente (`tbl_clientes`) ou do formulário de booking.

### Handler de confirmação

```typescript
// src/application/service/handlers/EnviarConfirmacaoAgendamentoHandler.ts

export class EnviarConfirmacaoAgendamentoHandler {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly slotRepo: ServiceSlotRepository,
        private readonly typeRepo: ServiceTypeRepository,
        private readonly notificacaoRepo: AgendamentoNotificacaoRepository,
    ) {}

    async handle(payload: AgendamentoConfirmadoPayload): Promise<void> {
        const agendamento = await this.agendamentoRepo.findById(payload.agendamentoId);
        if (!agendamento) return;

        const slot        = await this.slotRepo.findById(agendamento.slotId);
        const serviceType = await this.typeRepo.findById(agendamento.serviceTypeId);

        const mensagem = this.montarMensagem(agendamento, slot!, serviceType!);

        // E-mail: automático, fire-and-forget
        if (agendamento.clienteEmail) {
            try {
                await invoke('send_email', {
                    to:      agendamento.clienteEmail,
                    subject: `Confirmação de Agendamento — ${serviceType!.nome}`,
                    body:    mensagem,
                });
                await this.notificacaoRepo.registrar(agendamento.id, 'email', 'enviado');
            } catch (e) {
                await this.notificacaoRepo.registrar(agendamento.id, 'email', 'erro', String(e));
            }
        }

        // WhatsApp: link gerado, exibido na UI após confirmação
        if (agendamento.clienteTelefone) {
            const phone  = agendamento.clienteTelefone.replace(/\D/g, '');
            const waLink = `https://wa.me/55${phone}?text=${encodeURIComponent(mensagem)}`;
            await this.notificacaoRepo.registrar(agendamento.id, 'whatsapp', 'pendente_envio', waLink);
        }
    }

    private montarMensagem(a: Agendamento, slot: ServiceSlot, type: ServiceType): string {
        return [
            `Olá, ${a.clienteNome}!`,
            ``,
            `Seu agendamento foi confirmado:`,
            `Serviço: ${type.nome}`,
            `Data: ${formatDate(slot.dataInicio)}`,
            slot.local ? `Local: ${slot.local}` : '',
            a.bairro   ? `Bairro: ${a.bairro}`  : '',
            ``,
            `Protocolo: ${a.id}`,
            ``,
            `Em caso de dúvidas, entre em contato com a equipe.`,
        ].filter(Boolean).join('\n');
    }
}
```

### Estratégia por canal

| Canal | Disparo | Motivo |
|---|---|---|
| E-mail | Automático no `AGENDAMENTO_CONFIRMADO` | Não requer interação; silencioso se SMTP desabilitado |
| WhatsApp | Link gerado + botão exibido na UI | Abrir `wa.me` automaticamente seria intrusivo no desktop; operador clica para enviar |

A UI de confirmação do booking exibe o botão "Enviar WhatsApp" se `cliente_telefone` estiver preenchido — idêntico ao padrão da tela de Manifestação.

### Rastreamento de envios

```sql
CREATE TABLE IF NOT EXISTS tbl_agendamento_notificacoes (
    id              TEXT PRIMARY KEY,
    agendamento_id  TEXT NOT NULL REFERENCES tbl_agendamentos(id),
    canal           TEXT NOT NULL,            -- 'email' | 'whatsapp'
    status          TEXT NOT NULL,            -- 'enviado' | 'erro' | 'pendente_envio'
    detalhe         TEXT,                     -- erro ou wa.me link
    criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Permite auditoria de confirmações e reenvios futuros.

---

## Confirmação Automática vs Manual

Por padrão, `CreateBookingUseCase` chama `ConfirmarAgendamentoUseCase` imediatamente após criar o `Agendamento`, mantendo o comportamento atual (booking → task instantâneo).

Para habilitar aprovação manual futura, basta **não** chamar `ConfirmarAgendamento` no use case e expor o botão "Confirmar" na UI de gestão de slots. Nenhuma alteração de schema ou domínio necessária.

---

## BookingModal — Fluxo Multi-Etapa em Contexto

### Decisão

A rota `/agendamentos/novo` é **removida**. O registro de booking acontece inteiramente dentro de um modal multi-etapa acionado a partir do calendário ou da lista de slots. O usuário nunca perde o contexto visual do slot enquanto preenche os dados.

### Disparo

```
Calendário ou Lista → clique em slot → SlotDetailDialog
                                            ↓
                                  [ + Registrar booking ]
                                            ↓
                                       BookingModal
```

`SlotDetailDialog` e `BookingModal` são dois componentes distintos. O dialog permanece aberto atrás do modal enquanto o booking é preenchido.

### Etapa 1 — Identificação do cliente

```
┌─ Novo Agendamento ──────────────────────────────── ✕ ┐
│  🚚 Coleta de Volumosos · Bairro Norte · 15/06       │  ← header fixo
│  ████░░░░░░  4 / 10 vagas disponíveis                │
│  ─────────────────────────────────────────────────── │
│                                                       │
│  ① Cliente   ② Serviço   ③ Confirmação               │  ← stepper
│                                                       │
│  Buscar por telefone                                  │
│  [ 📞 (11) 9 ____-____ ]                             │
│                                                       │
│  ✅ João Silva encontrado                             │
│     joao@email.com · (11) 99999-1234                 │
│     Rua das Flores, 123 — Centro                     │
│                                                       │
│  ○ Cadastrar novo cliente                             │
│                                                       │
│                         [ Cancelar ]  [ Próximo → ]  │
└──────────────────────────────────────────────────────┘
```

Reutiliza `ClientePhoneSearch` sem alteração.

### Etapa 2 — Dados do serviço

```
┌─ Novo Agendamento ──────────────────────────────── ✕ ┐
│  🚚 Coleta de Volumosos · Bairro Norte · 15/06       │
│  João Silva                                           │
│  ─────────────────────────────────────────────────── │
│                                                       │
│  ① Cliente ✓   ② Serviço   ③ Confirmação             │
│                                                       │
│  [ FormRenderer — serviceType.formId ]                │
│  Bairro atendido: [ Centro ▼ ]                       │
│  Tipos de resíduo: ☑ Móveis  ☑ Eletro  ☐ Pneus      │
│  Localização: [ 📍 picker de mapa ]                   │
│  Fotos: [ + Adicionar ]  (2 adicionadas)             │
│                                                       │
│  Responsável pela execução: [ Carlos ▼ ]              │
│                                                       │
│        [ ← Voltar ]  [ Confirmar agendamento → ]     │
└──────────────────────────────────────────────────────┘
```

`FormRenderer` carrega o formulário do tipo de serviço dinamicamente. Campo mapa e fotos aparecem apenas para os tipos que os requerem — visibilidade controlada por `AgendamentoTipoConfig`, sem `if(tipoId)` no modal.

### Etapa 3 — Confirmação (tela de sucesso)

```
┌─ Agendamento confirmado ────────────────────────── ✕ ┐
│                                                       │
│            ✅  Protocolo AGD-2026-0042               │
│                                                       │
│  Cliente     João Silva                               │
│  Serviço     Coleta de Volumosos · Bairro Norte      │
│  Data        15/06/2026                               │
│  Responsável Carlos Souza                             │
│                                                       │
│  📧 E-mail de confirmação enviado                    │
│                                                       │
│  [ 💬 Enviar WhatsApp ]      [ Ver task no Kanban ]   │
│                                                       │
│  [ Novo agendamento no mesmo slot ]      [ Fechar ]   │
└──────────────────────────────────────────────────────┘
```

**"Novo agendamento no mesmo slot"** reinicia da Etapa 1 sem fechar o modal — útil quando o operador registra vários clientes consecutivos para o mesmo slot.

O link do WhatsApp é lido de `tbl_agendamento_notificacoes` (gerado pelo `EnviarConfirmacaoAgendamentoHandler`) — não é gerado no frontend.

### Decisões de implementação

| Ponto | Decisão |
|---|---|
| Componente base | `<Dialog>` shadcn com `DialogContent` em tamanho `lg` |
| Estado do stepper | local no componente — sem rota, sem URL param |
| Header fixo | info do slot sempre visível entre as três etapas |
| Validação | executada ao clicar "Próximo" / "Confirmar" — erros inline, não em toast |
| `/agendamentos/novo` | rota removida; `?slotId=` redireciona para `/agendamentos` |
| Reenvio WhatsApp | link de `tbl_agendamento_notificacoes.detalhe` |

---

## UI — Calendário de Slots e Indicadores de Disponibilidade

### Problema atual

`/agendamentos` agrupa slots por tipo sem ordenação por data. Indicadores de vagas são texto puro (`5 / 10`). Não há visão temporal — o operador não sabe quais slots estão próximos, quais estão quase cheios ou quando a janela de agendamento abre.

### Vista dual: Lista + Calendário

A página `/agendamentos` oferece duas vistas alternáveis:

```
[  Lista  |  Calendário  ]   ← toggle no header
```

**Vista Lista** (padrão) — ordenada por `data_inicio` ASC, com indicadores visuais:

```
┌─ 🏛️ Museu do Lixo ──────────────────────────── Abre 01/06 ─┐
│  Junho 2026 · Turma A              ████████░░  8/10 vagas   │
│  01/06 → 30/06                     ⚠ Últimas 2 vagas        │
│                                         [ Registrar → ]     │
└────────────────────────────────────────────────────────────┘

┌─ 🚚 Coleta de Volumosos ────────────────────── Disponível ──┐
│  Bairro Centro · 15/06             ██░░░░░░░░  2/10 vagas   │
│  15/06 → 15/06                                              │
│                                         [ Registrar → ]     │
└────────────────────────────────────────────────────────────┘
```

**Vista Calendário** — grade mensal, slots como pills coloridos por tipo de serviço:

```
        Junho 2026
  Dom  Seg  Ter  Qua  Qui  Sex  Sáb
                           1    2    3
                       [🏛 Museu]
   4    5    6    7    8    9   10
                                    [🚚 Centro]
  11   12   13   14   15   16   17
                       [🚚 Norte]
```

Clique em qualquer pill → abre **SlotDetailDialog** (modal lateral ou drawer):

```
┌─── Coleta de Volumosos — Bairro Norte ────────────────── ✕ ┐
│  📅 15/06/2026                                              │
│  📍 Bairro Norte                                            │
│  👥 3 / 10 vagas  ███░░░░░░░  30% ocupado                  │
│  ⏰ Abertura: 08/06/2026 (já aberto)                        │
│                                                             │
│  Bookings registrados (3)                                   │
│  · João Silva — ✅ confirmado                               │
│  · Maria Souza — ✅ confirmado                              │
│  · Pedro Costa — ✅ confirmado                              │
│                                                             │
│              [ + Registrar booking ]   [ Ver no admin ]     │
└─────────────────────────────────────────────────────────────┘
```

### Indicador de capacidade

Barra de progresso com semântica de cor — sem nenhum número de threshold hardcoded, calculado por proporção:

```typescript
function getCapacidadeVariant(ocupadas: number, total: number | null) {
    if (total === null) return 'ilimitado';   // ∞ — azul
    const pct = ocupadas / total;
    if (pct >= 1.0)  return 'lotado';         // cinza, badge "Lotado"
    if (pct >= 0.85) return 'critico';        // vermelho, badge "Últimas vagas"
    if (pct >= 0.60) return 'atencao';        // amarelo, badge "Poucas vagas"
    return 'disponivel';                       // verde
}
```

### Indicadores de janela de abertura

Slots `publicado` mas com `abertura_em` no futuro exibem chip de countdown em vez do botão de registrar:

```
[ Abre em 5 dias — 08/06 ]
```

Slots já na janela mas sem vagas: `[ Lotado ]` sem botão de ação.

### Urgência por data

Slots ordenados por `data_inicio` ASC. Flags adicionais:

| Condição | Indicador |
|---|---|
| `data_inicio` ≤ hoje + 3 dias | chip "Hoje" / "Amanhã" / "Em X dias" em destaque |
| `data_fim` < hoje | automaticamente movidos para status `encerrado` (job) |
| `abertura_em` > hoje | chip "Abre em X dias" — botão desabilitado |
| `pct >= 0.85` | chip "Últimas vagas" em vermelho |

### Implementação do calendário

Calendário mensal custom — grade de 6×7 células. Sem biblioteca externa pesada: apenas CSS grid + slots mapeados por dia. Pills coloridos com `serviceType.cor` (já existe no modelo).

```typescript
// célula do calendário
type DayCell = {
    date: Date;
    slots: ServiceSlot[];   // slots cujo range data_inicio..data_fim inclui este dia
}
```

O modal de detalhe reutiliza o `SlotDetailPage` existente renderizado em `<Dialog>` / `<Sheet>` do shadcn, evitando duplicar lógica.

---

## Ordem de Execução

```
Fase 1 — Schema                                        ~0,5 dia
  ├── tbl_agendamentos (+ cliente_email, cliente_telefone)
  ├── tbl_agendamento_notificacoes
  ├── ALTER TABLE tarefas ADD COLUMN agendamento_id TEXT
  ├── ALTER TABLE tbl_service_types ADD COLUMN abertura_regra TEXT
  └── ALTER TABLE tbl_service_slots ADD COLUMN abertura_em TEXT

Fase 2 — Domínio                                       ~1 dia
  ├── Agendamento.ts (entidade + state machine)
  ├── AgendamentoRepository.ts (interface: findById, findBySlotId,
  │     findByClienteId, save)
  ├── AgendamentoNotificacaoRepository.ts (interface)
  └── ServiceEvents.ts (AGENDAMENTO_CRIADO, AGENDAMENTO_CONFIRMADO,
        AGENDAMENTO_CANCELADO, AGENDAMENTO_REALIZADO)

Fase 3 — Use Cases                                     ~1,5 dia
  ├── CreateBookingUseCase — persiste Agendamento, captura contato,
  │     valida abertura_em, detecta dupla reserva por clienteId
  ├── ConfirmarAgendamentoUseCase — pendente → confirmado
  ├── CancelarAgendamentoUseCase — * → cancelado + decrementa vagas
  ├── GetAgendamentoUseCase, ListAgendamentosUseCase
  ├── CreateServiceSlotUseCase — calcula abertura_em via abertura_regra
  └── UpdateServiceSlotUseCase — aceita alteração de abertura_em

Fase 4 — Handlers + Infra                              ~1 dia
  ├── CriarTaskParaAgendamentoHandler
  │     — escuta AGENDAMENTO_CONFIRMADO
  │     — cria Task com carga pré-preenchida + agendamento_id + origem='booking'
  ├── EnviarConfirmacaoAgendamentoHandler
  │     — escuta AGENDAMENTO_CONFIRMADO
  │     — envia email via invoke('send_email') se cliente_email preenchido
  │     — gera wa.me link e persiste em tbl_agendamento_notificacoes
  ├── SqliteAgendamentoRepository
  ├── SqliteAgendamentoNotificacaoRepository
  └── Registro no DI container + DomainEventBus

Fase 5 — FormRenderer: campo mapa                      ~0,5 dia
  ├── Novo tipo 'mapa' em FormFieldRenderer
  │     — modo booking: picker de coordenada + endereço livre
  │     — modo read-only (task): pin estático com endereço formatado
  └── Integração com carga JSON: { lat, lng, endereco }

Fase 6 — Hooks + UI core                               ~1 dia
  ├── useAgendamentos, useAgendamentoMutations
  ├── /agendamentos/[id] — detalhe do booking com status Agendamento
  ├── /minhas-solicitacoes — status de Agendamento (confirmado/cancelado)
  │     em vez de status de Task
  └── Botão "Enviar WhatsApp" na tela pós-confirmação (wa.me link
        de tbl_agendamento_notificacoes)

Fase 7 — UI calendário e lista melhorada               ~1,5 dia
  ├── Vista lista: ordenação por data_inicio ASC, barra de capacidade
  │     com semântica de cor, chips de urgência e abertura_em
  ├── Vista calendário: grade mensal custom (CSS grid, sem lib externa),
  │     pills por tipo com serviceType.cor
  ├── SlotDetailDialog — Sheet/Dialog shadcn reutilizando SlotDetailPage
  │     com lista de bookings e botão "+ Registrar booking"
  └── Toggle [Lista | Calendário] no header da página

Fase 8 — View de campo                                 ~0,5 dia
  ├── /minhas-tarefas-campo — lista + mapa de pins para o dia
  ├── Query: tarefas onde atribuido_para + origem='booking' + prazo=hoje
  ├── Pins via JSON_EXTRACT(carga, '$.localizacao')
  └── Ações inline: Realizado | Não realizado | Intercorrência

Fase 9 — Limpeza                                       ~0,5 dia
  ├── Remover BookingTaskRepository (interface + implementação)
  └── Remover referências a origem='booking' em BookingTaskRepository
        (substituídas por AgendamentoRepository)
```

**Estimativa total: ~8 dias**

### Dependências entre fases

```
1 (schema) → 2 (domínio) → 3 (use cases) → 4 (handlers)
                                          ↘
                                      5 (campo mapa)  ← independente de 4
                                           ↓
                              6 (UI core) → 7 (calendário) → 8 (campo)
                                                              ↓
                                                          9 (limpeza)
```

Fases 5 e 4 podem ser desenvolvidas em paralelo. Fase 7 depende de 6 estar minimamente funcional (hooks prontos). Fase 9 só após testes de regressão de 6–8.

---

## Consequências

### Positivas
- Cancelamento individual de booking com devolução de vaga — possível
- Dupla reserva por cliente — detectável com `findByClienteId(clienteId, slotId)`
- `/minhas-solicitacoes` exibe status semânticos de booking (`confirmado`, `cancelado`)
- Task continua sem saber nada de booking — desacoplamento limpo
- Formulário único: o operador confirma/corrige os mesmos dados do agendamento, sem duplicar formulários
- Task pré-preenchida via `carga` — o `FormRenderer` existente já suporta isso, zero lógica nova na UI
- Rastreabilidade completa: `task.agendamento_id` liga execução ao pedido original em qualquer consulta
- Extensível: lista de espera, aprovação manual, reagendamento, intercorrências — todos implementáveis sem mudar Task

### Negativas / Custos
- Nova tabela `tbl_agendamentos` — uma migração necessária
- `CreateBookingUseCase` muda interface (perde `responsavelId` direto, passa para `Agendamento`)
- Handler assíncrono introduz latência mínima entre booking e criação da Task (mitigável com confirm automático síncrono)

### Não muda
- Todos os validators de tipo de serviço (`MuseuValidator`, `VolumososValidator`, `EventoValidator`)
- Ciclo de vida e state machine da `Task`
- Kanban e workflow de tasks existente
- `tbl_service_types` e `tbl_service_slots` — apenas recebem colunas novas via `ADD COLUMN`

### Muda parcialmente
- `CreateServiceSlotUseCase` — adiciona cálculo de `abertura_em`
- UI de admin de slots — adiciona campo `abertura_em` condicional por regra

---

## Critérios de Aceitação

### Domínio e persistência
1. `SELECT * FROM tbl_agendamentos WHERE cliente_id = ?` retorna resultado após criar booking
2. Task criada pelo handler tem `agendamento_id` preenchido, `origem = 'booking'` e `carga` com os dados do agendamento
3. `FormRenderer` da task renderiza campos pré-preenchidos com dados do agendamento sem erro de template
4. `CancelarAgendamentoUseCase` decrementa `vagas_ocupadas` no slot; `SELECT vagas_ocupadas FROM tbl_service_slots` confirma
5. Segundo booking do mesmo `clienteId` no mesmo slot lança erro `'Cliente já possui agendamento neste slot'`
6. `Task.ts` não importa nenhum símbolo de `domain/service/Agendamento.ts`
7. `ServiceType` tem apenas um `formId` — `formExecucaoId` inexistente em qualquer arquivo

### Janela de abertura
8. Slot com `abertura_regra: antecedencia_dias: 7` e `data_inicio = 2026-07-01` persiste `abertura_em = 2026-06-24`
9. Booking tentado antes de `abertura_em` lança erro com data de abertura na mensagem
10. Admin pode alterar `abertura_em` de slot `publicado` via `UpdateServiceSlotUseCase`

### Notificações
11. Email enviado automaticamente após confirmação quando `cliente_email` preenchido e SMTP ativo
12. `tbl_agendamento_notificacoes` registra `status = 'enviado'` ou `'erro'` para email
13. `tbl_agendamento_notificacoes` registra `status = 'pendente_envio'` com link `wa.me` para WhatsApp
14. Botão "Enviar WhatsApp" visível na UI pós-confirmação quando `cliente_telefone` preenchido

### UI — Lista e Calendário
15. `/agendamentos` vista lista ordena slots por `data_inicio` ASC
16. Barra de capacidade exibe variante correta: verde / amarelo / vermelho / cinza por proporção ocupada
17. Slot com `abertura_em` futuro exibe chip "Abre em X dias" e botão de registrar desabilitado
18. Vista calendário exibe pills coloridos por `serviceType.cor` nos dias correspondentes ao range do slot
19. Clique em pill abre `SlotDetailDialog` com lista de bookings e botão "+ Registrar booking"

### Campo mapa e view de campo
20. Campo tipo `mapa` no formulário de booking persiste `{ lat, lng, endereco }` no `carga`
21. Task aberta pelo operador exibe pin read-only com endereço quando `carga.localizacao` presente
22. `/minhas-tarefas-campo` lista tasks `origem='booking'` do dia atribuídas ao usuário logado com pins no mapa

### BookingModal
25. Rota `/agendamentos/novo` não existe — `GET /agendamentos/novo?slotId=*` retorna redirect para `/agendamentos`
26. Modal abre a partir do `SlotDetailDialog` sem navegação de página
27. Etapa 1 reutiliza `ClientePhoneSearch` sem modificação
28. Etapa 2 renderiza `FormRenderer` com `serviceType.formId` — zero `if(tipoId)` no componente do modal
29. Etapa 3 exibe protocolo (`agendamento.id`) e botão WhatsApp apenas quando `tbl_agendamento_notificacoes` tem entrada para o agendamento
30. "Novo agendamento no mesmo slot" reinicia stepper para Etapa 1 mantendo o modal aberto

### Qualidade
31. `tsc --noEmit` zero erros após todas as fases
32. `/minhas-solicitacoes` exibe `confirmado` / `cancelado` (status de Agendamento), não `a_fazer` / `em_progresso`
33. `grep -r '"/agendamentos/novo"' desktop/` retorna zero resultados
