# ADR-026 — Task como Saída Universal: Camada de Conversão Canônica

- **Status**: Proposto
- **Data**: 2026-05-22
- **Autor**: Claude Code (análise de gaps no pipeline de conversão)
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Relacionados**: ADR-019 (Desacoplamento Booking/Task), ADR-023 (RBAC), ADR-024 (Acesso Horizontal), ADR-025 (Anexos)

---

## Contexto

O runtime mobile consome exclusivamente eventos do tipo `task.criada`. Todo trabalho de campo — independente da origem (demanda aceita, agendamento confirmado, manifestação encaminhada) — chega ao dispositivo como uma task. Esse invariante foi documentado na ADR-025 mas nunca foi implementado como contrato explícito.

### Estado atual — conversão fragmentada

A auditoria do código revelou três problemas estruturais:

**1. Três caminhos de conversão, três comportamentos diferentes**

| Origem | Ponto de criação | Mecanismo | `setor_id`? | Payload `task.criada` |
|--------|-----------------|-----------|:-----------:|----------------------|
| Suite → Task | `criar_tarefa.action.ts:28` | raw SQL direto | ❌ | `{ tarefaId, suiteId, criadoPor }` |
| Demanda → Task | `AcceptDemandaUseCase.ts:60` | `Task.fromProps()` inline | ❌ | payload completo sem setor |
| Agendamento → Task | `CriarTaskService.criarParaAgendamento()` | serviço dedicado | ? | desconhecido |
| **Manifestação → Task** | **inexistente** | — | — | — |

**2. `setor_id` nunca propagado para tasks**

`grep -rn "setor_id" desktop/src/application/task` retorna zero resultados. Com ADR-024 adicionando filtro horizontal obrigatório, todas as tasks geradas por conversão ficarão invisíveis nos filtros de setor — qualquer operador perde visibilidade das tarefas que lhe foram atribuídas.

**3. Manifestação não tem caminho de execução**

`UpdateManifestacaoStatusUseCase` apenas atualiza status e publica `manifestacao.status_atualizado`. Não existe nenhum ponto no código que converta uma manifestação em tarefa de campo. O runtime mobile nunca recebe trabalho originado na ouvidoria.

**4. Payload de `task.criada` inconsistente**

O `HandlerRegistry` do mobile registra um único handler para `task.criada`. Esse handler recebe payloads com shapes diferentes dependendo de quem emitiu o evento — sem contrato tipado compartilhado.

---

## Decisão

**Centralizar toda conversão domínio→task em um único `TaskProjectionService`**, que passa a ser o único ponto que escreve `task.criada` no `SyncOutbox`.

```
Demanda aceita          ──┐
Agendamento confirmado  ──┤──► TaskProjectionService ──► task salva em SQLite
Manifestação encaminhada ──┘                         ──► task.criada (payload canônico)
Suite / manual                                       ──► setor_id propagado
                                                     ──► origem rastreada
```

---

## 1. Payload canônico de `task.criada`

Definido em `ecoforms-core/sync` como interface compartilhada entre desktop e mobile:

```typescript
// packages/core/src/sync/events/TaskCriadaPayload.ts

export interface TaskCriadaPayload {
  id:             string;
  titulo:         string;
  descricao:      string | null;
  status:         'a_fazer';
  prioridade:     'baixa' | 'media' | 'alta';
  setor_id:       string | null;   // propagado da entidade origem (ADR-024)
  atribuido_para: string | null;
  prazo:          string | null;
  criado_por:     string;
  criado_em:      string;
  origem_tipo:    'demanda' | 'agendamento' | 'manifestacao' | 'suite' | 'manual';
  origem_id:      string | null;   // demandaId | agendamentoId | manifestacaoId | suiteId
  formularios:    Array<{
    formRegistryId: string;
    ordem:          number;
    obrigatorio:    boolean;
  }>;
}
```

O mobile usa a mesma definição via `mobile/www/js/sync/events/TaskCriadaPayload.js` (cópia JS, mesmo padrão de `CryptoLayer.js`).

---

## 2. `TaskProjectionService`

**Localização**: `src/application/task/TaskProjectionService.ts`

Não pertence a nenhum domínio específico — recebe input de qualquer use case e produz a task canônica.

```typescript
// src/application/task/TaskProjectionService.ts

export interface TaskProjectionInput {
  titulo:       string;
  descricao?:   string;
  setorId:      string | null;
  atribuidoPara?: string;
  prazo?:       string;
  prioridade?:  'baixa' | 'media' | 'alta';
  criadoPor:    string;
  origemTipo:   TaskCriadaPayload['origem_tipo'];
  origemId:     string | null;
  formularios?: Array<{
    formRegistryId: string;
    formSnapshot:   Record<string, unknown>;
    formVersion?:   number;
    ordem:          number;
    obrigatorio:    boolean;
  }>;
}

export class TaskProjectionService {
  constructor(
    private readonly taskRepo:     TaskRepository,
    private readonly formularioRepo: TarefaFormularioRepository,
    private readonly clock:        ClockPort,
    private readonly sync:         SyncOutbox,
  ) {}

  async project(input: TaskProjectionInput): Promise<string> {
    const id     = uuidv7();
    const agora  = this.clock.nowIso();
    const status = 'a_fazer' as const;
    const ordem  = await this.taskRepo.nextOrder(null, status);

    const task = Task.fromProps({
      id,
      titulo:        input.titulo,
      descricao:     input.descricao ?? undefined,
      status,
      prioridade:    input.prioridade ?? 'media',
      ordem,
      criadoPor:     input.criadoPor,
      projetoId:     null,
      atribuidoPara: input.atribuidoPara ?? null,
      prazo:         input.prazo ?? null,
      setorId:       input.setorId,           // ADR-024
      origemTipo:    input.origemTipo,
      origemId:      input.origemId,
      arquivado:     false,
      criadoEm:      agora,
      atualizadoEm:  agora,
    });

    await this.taskRepo.save(task);

    for (const f of input.formularios ?? []) {
      await this.formularioRepo.save({
        id:             uuidv7(),
        tarefaId:       id,
        formRegistryId: f.formRegistryId,
        formVersion:    f.formVersion ?? 1,
        formSnapshot:   f.formSnapshot,
        ordem:          f.ordem,
        obrigatorio:    f.obrigatorio,
        concluido:      false,
        concluidoEm:    null,
      });
    }

    const payload: TaskCriadaPayload = {
      id,
      titulo:         input.titulo,
      descricao:      input.descricao ?? null,
      status:         'a_fazer',
      prioridade:     input.prioridade ?? 'media',
      setor_id:       input.setorId,
      atribuido_para: input.atribuidoPara ?? null,
      prazo:          input.prazo ?? null,
      criado_por:     input.criadoPor,
      criado_em:      agora,
      origem_tipo:    input.origemTipo,
      origem_id:      input.origemId,
      formularios:    (input.formularios ?? []).map(f => ({
        formRegistryId: f.formRegistryId,
        ordem:          f.ordem,
        obrigatorio:    f.obrigatorio,
      })),
    };

    await this.sync.write('task.criada', payload, {
      aggregateId: id,
      streamId:    input.origemId ?? id,
    });

    return id;
  }
}
```

---

## 3. Colunas novas em `tarefas`

Duas colunas são adicionadas em `ensure-columns.ts` e `schema_consolidado_corrigido.sql`:

```sql
-- já adicionada por ADR-024 (prerequisito)
ALTER TABLE tarefas ADD COLUMN setor_id TEXT REFERENCES setores(id);

-- novas neste ADR
ALTER TABLE tarefas ADD COLUMN origem_tipo TEXT;
-- 'demanda' | 'agendamento' | 'manifestacao' | 'suite' | 'manual'
ALTER TABLE tarefas ADD COLUMN origem_id   TEXT;
-- FK lógica (não declarada) para a entidade de origem
```

`origem_id` não tem FK declarada porque aponta para tabelas heterogêneas. A integridade é mantida pela camada de aplicação.

---

## 4. Refatoração dos pontos de conversão existentes

### 4.1 `AcceptDemandaUseCase`

Remove a criação inline de `Task.fromProps()` e delega ao `TaskProjectionService`:

```typescript
// antes: Task.fromProps() + taskRepo.save() + sync.write('task.criada') inline
// depois:

constructor(
  private repo:       DemandaRepository,
  private taskProj:   TaskProjectionService,   // substitui taskRepo + sync
  private clock:      ClockPort,
) {}

// ...para cada tarefa do input:
const tarefaId = await this.taskProj.project({
  titulo:        t.titulo,
  descricao:     t.descricao,
  setorId:       demanda.setorId ?? null,       // propagado da demanda (ADR-024)
  atribuidoPara: t.atribuidoPara,
  prazo:         t.prazo,
  prioridade:    t.prioridade,
  criadoPor:     input.aceitoPor,
  origemTipo:    'demanda',
  origemId:      input.demandaId,
  formularios:   t.formularios,
});
```

`AcceptDemandaUseCase` deixa de depender de `TaskRepository` e `SyncOutbox` diretamente — passa a depender apenas de `DemandaRepository`, `TaskProjectionService` e `ClockPort`.

### 4.2 `AgendamentoEfeitosService` / `CriarTaskService`

`CriarTaskService` é removido. `AgendamentoEfeitosService` passa a chamar `TaskProjectionService`:

```typescript
async aoConfirmar(ag: Agendamento, criadoPor: string): Promise<void> {
  await this.taskProj.project({
    titulo:       `Execução: ${ag.serviceType?.nome ?? ag.serviceTypeId}`,
    setorId:      ag.setorId ?? null,    // Agendamento precisa ter setor_id (ver seção 5)
    atribuidoPara: null,                 // equipe decide quem pega
    origemTipo:   'agendamento',
    origemId:     ag.id,
    criadoPor,
  });

  await this.notificador.enviarConfirmacao(ag);
  await this.sync.write('service.agendamento.confirmado', { ... });
}
```

### 4.3 `criar_tarefa` action

O raw SQL é substituído por chamada ao `TaskProjectionService` via container:

```typescript
handler: async (ctx) => {
  const suiteId = ctx.targetId;
  const tarefaId = await ctx.container.taskProjection.project({
    titulo:       (ctx.input?.titulo as string) || `Tarefa vinculada a ${suiteId}`,
    setorId:      ctx.currentUser.setorPrincipalId ?? null,
    atribuidoPara: (ctx.input?.responsavel as string) || ctx.userId,
    prazo:        (ctx.input?.prazo as string) || null,
    criadoPor:    ctx.userId,
    origemTipo:   'suite',
    origemId:     suiteId,
  });

  return { success: true, redirect: `/tasks/${tarefaId}` };
}
```

---

## 5. Manifestação → Task: gatilho de conversão

A conversão ocorre quando uma manifestação atinge o status `encaminhada` — nesse ponto o setor responsável é conhecido.

`UpdateManifestacaoStatusUseCase` recebe `TaskProjectionService` como dependência opcional e o chama na transição para `encaminhada`:

```typescript
export class UpdateManifestacaoStatusUseCase {
  constructor(
    private readonly manifestacaoRepository: ManifestacaoRepository,
    private readonly sync: SyncOutbox,
    private readonly taskProj: TaskProjectionService,   // novo
  ) {}

  async execute(dto: UpdateManifestacaoStatusDTO): Promise<void> {
    const manifestacao = await this.manifestacaoRepository.findById(dto.id);
    if (!manifestacao) throw new Error('Manifestação não encontrada');

    ManifestacaoStateMachine.validarTransicao(manifestacao.status, dto.status);

    await this.manifestacaoRepository.updateStatus(dto.id, dto.status, dto.responsavelId);

    // Conversão para task no encaminhamento
    if (dto.status === 'encaminhada' && dto.responsavelId) {
      await this.taskProj.project({
        titulo:       `Manifestação #${manifestacao.protocolo ?? manifestacao.id.slice(-6)}`,
        descricao:    manifestacao.descricao ?? undefined,
        setorId:      manifestacao.setorId ?? null,
        atribuidoPara: dto.responsavelId,
        criadoPor:    dto.responsavelId,
        origemTipo:   'manifestacao',
        origemId:     dto.id,
      });
    }

    await this.sync.write('manifestacao.status_atualizado', {
      manifestacaoId: dto.id,
      status:         dto.status,
    }, { aggregateId: dto.id });
  }
}
```

**Por que `encaminhada` e não outro status**: é o primeiro status onde o setor responsável está definido e há intenção explícita de execução de campo. Triagem e registro ainda são trabalho de escritório.

---

## 6. `setor_id` no domínio `Agendamento`

Para que `AgendamentoEfeitosService` propague `setorId`, a entidade `Agendamento` precisa ter esse campo. O setor é determinado pelo `ServiceSlot`, que já tem `setor_id` via `ServiceType`.

Adicionar em `ensure-columns.ts`:

```sql
ALTER TABLE tbl_agendamentos ADD COLUMN setor_id TEXT REFERENCES setores(id);
```

Populado no momento da criação do agendamento a partir de `tbl_service_slots.setor_id`.

---

## 7. Container — registro do `TaskProjectionService`

`TaskProjectionService` é registrado no DI container como singleton:

```typescript
// src/infrastructure/container/modules/TaskModule.ts (ou container.ts)

const taskProjection = new TaskProjectionService(
  taskRepo,
  tarefaFormularioRepo,
  clock,
  syncOutbox,
);

container.taskProjection = taskProjection;
```

Exposto no tipo do container como `taskProjection: TaskProjectionService`.

---

## Plano de Execução

### Fase 0 — Prerequisitos (bloqueantes)

```
ADR-023 Fase 1: seed perfis + hierarquia_perfis (já necessário antes desta ADR)
ADR-024 Fase 1: ADD COLUMN setor_id em tarefas + índice (prerequisito para propagação)
```

### Fase 1 — Schema e tipo canônico (1h)

```
├── ensure-columns.ts: ADD COLUMN origem_tipo, origem_id em tarefas
├── ensure-columns.ts: ADD COLUMN setor_id em tbl_agendamentos
├── schema_consolidado_corrigido.sql: espelhar colunas
└── packages/core/src/sync/events/TaskCriadaPayload.ts: tipo exportado
    └── mobile/www/js/sync/events/TaskCriadaPayload.js: cópia JS
```

### Fase 2 — TaskProjectionService (2h)

```
├── src/application/task/TaskProjectionService.ts: implementação completa
├── container.ts / TaskModule.ts: registro no DI
└── Teste unitário: project() cria task + salva formulários + emite task.criada canônico
```

### Fase 3 — Refatoração dos callers (2h)

```
├── AcceptDemandaUseCase: remover Task.fromProps() inline → taskProj.project()
│     └── Ajustar construtor: TaskRepository e SyncOutbox saem; TaskProjectionService entra
├── AgendamentoEfeitosService: CriarTaskService → taskProj.project()
├── criar_tarefa.action.ts: raw SQL → taskProj.project()
└── Deletar CriarTaskService.ts (substituído)
```

### Fase 4 — Manifestação (1h)

```
├── UpdateManifestacaoStatusUseCase: injetar TaskProjectionService
├── Adicionar conversão na transição para 'encaminhada'
└── Teste unitário: status 'encaminhada' com responsavelId → task.criada emitido
```

### Fase 5 — Propagação de setor (1h)

```
├── AcceptDemandaUseCase: passar demanda.setorId para taskProj.project()
│     └── Demanda precisa ter setorId (ADR-024 Fase 1 já adiciona a coluna)
├── AgendamentoEfeitosService: passar ag.setorId para taskProj.project()
├── UpdateManifestacaoStatusUseCase: passar manifestacao.setorId
└── criar_tarefa action: passar currentUser.setorPrincipalId como fallback
```

### Fase 6 — Mobile HandlerRegistry (1h)

```
├── Atualizar handler 'task.criada' para consumir TaskCriadaPayload canônico
├── Adicionar campos origem_tipo e origem_id ao store IndexedDB de tarefas
└── Smoke test: criar demanda no desktop → aceitar → confirmar task.criada no mobile
```

**Estimativa total: ~1,5 dias** (excluindo prerequisitos de ADR-023/024)

---

## O que NÃO muda

- `Task` (entidade de domínio) — ganha `setorId`, `origemTipo`, `origemId`; resto inalterado
- `TaskRepository` — interface inalterada
- `SyncOutbox` / `TransportService` — inalterados
- `HandlerRegistry` desktop — apenas o handler mobile é atualizado
- Nomes de tabelas e colunas existentes em `tarefas`
- `CloseDemandaUseCase`, `CloseDemandaOnAllTasksArchived/ConcludedHandler` — inalterados
- Fluxo inverso (task concluída → fecha demanda/agendamento) — não é escopo deste ADR

---

## Consequências

### Positivas

- `task.criada` tem payload tipado e uniforme — mobile handler não precisa lidar com shapes diferentes
- `setor_id` é propagado em todas as conversões — ADR-024 funciona para tasks geradas por qualquer domínio
- Manifestação tem caminho de execução — o campo recebe trabalho originado na ouvidoria
- `origem_tipo` + `origem_id` permitem rastrear de volta qual demanda/agendamento/manifestação originou cada task
- `criar_tarefa` action deixa de emitir SQL raw — passa pelo domínio e pela validação do use case
- `CriarTaskService` é eliminado — um serviço a menos no grafo de dependências
- `AcceptDemandaUseCase` fica mais simples — remove dependência de TaskRepository e SyncOutbox

### Negativas / Custos

- `Task.fromProps()` ganha três campos novos (`setorId`, `origemTipo`, `origemId`) — atualizar entity e testes
- `AcceptDemandaUseCase` muda assinatura do construtor — atualizar container e testes
- `UpdateManifestacaoStatusUseCase` ganha dependência de `TaskProjectionService` — atenção ao princípio de responsabilidade única (justificado: o status `encaminhada` é o gatilho natural; separar em handler de evento seria over-engineering neste ponto)

### Riscos

- **Dupla conversão**: se `AcceptDemandaUseCase` for chamado duas vezes para a mesma demanda (bug de UI ou retry), duas tasks idênticas são criadas. Mitigação: verificar `SELECT COUNT(*) FROM tarefas WHERE origem_tipo = 'demanda' AND origem_id = ?` antes de criar; lançar erro se já existir task de execução.
- **Manifestação sem setor**: se `manifestacao.setorId` for nulo na transição para `encaminhada`, a task é criada sem setor e fica invisível nos filtros do ADR-024. Mitigação: validar presença de `setorId` antes de converter; bloquear transição se ausente.
- **Dependência circular no container**: `TaskProjectionService` depende de `TarefaFormularioRepository`, que pode depender de módulos não inicializados. Mitigação: verificar ordem de registro no DI.

---

## Critérios de Aceitação

1. `TaskProjectionService.project()` é o único lugar no codebase que escreve `task.criada` no `SyncOutbox`
   - `grep -rn "task\.criada" desktop/src --include="*.ts"` retorna apenas `TaskProjectionService.ts` e testes
2. `task.criada` payload sempre contém `setor_id`, `origem_tipo`, `origem_id`
3. `AcceptDemandaUseCase` não importa `TaskRepository` nem `SyncOutbox` diretamente
4. `CriarTaskService.ts` deletado — zero referências no codebase
5. `criar_tarefa.action.ts` não contém `INSERT INTO tarefas`
6. `UpdateManifestacaoStatusUseCase`: status `'encaminhada'` com `responsavelId` → `task.criada` emitido com `origem_tipo = 'manifestacao'`
7. Task criada de demanda carrega `setor_id` igual ao `setorId` da demanda de origem
8. Task criada de agendamento carrega `setor_id` igual ao `setor_id` do slot de origem
9. `SELECT * FROM tarefas WHERE origem_tipo = 'demanda' AND origem_id = ?` retorna as tasks daquela demanda
10. Mobile `HandlerRegistry` handler de `task.criada` persiste `origem_tipo` e `origem_id` no store IndexedDB
11. Criar mesma demanda duas vezes → segunda chamada ao `project()` lança erro (sem task duplicada)
