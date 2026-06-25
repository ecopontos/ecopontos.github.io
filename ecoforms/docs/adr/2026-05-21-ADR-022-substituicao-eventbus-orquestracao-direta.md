# ADR-022 — Substituição do DomainEventBus por Orquestração Direta

- **Status**: Proposto
- **Data**: 2026-05-21
- **Autor**: Marcelo Luiz + Claude Code
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Amenda**: ADR-019 (Desacoplamento Booking/Task) — remove o padrão de handlers reativos introduzido por ADR-019
- **Relacionados**: ADR-014 (Adequação Arquitetural), ADR-015 (Motor de Agendamento), ADR-019, ADR-020 (Granular Sync)
- **Premissa**: Sistema em desenvolvimento (pré-produção) — sem dados reais, sem usuários ativos, sem legado de eventos em trânsito. Não há necessidade de migração gradual, dual-write, feature flags ou plano de rollback. A implementação é corte limpo.

---

## Contexto

O projeto utiliza um `DomainEventBus` (`InMemoryDomainEventBus`) como barramento de eventos interno. O modelo atual tem 44 tipos de evento, 8 handlers de domínio (lógica de negócio), 2 bridges de sincronização (25 subscribers) e 16 use cases/repositórios que publicam eventos.

### Problemas identificados

| Problema | Impacto |
|---|---|
| **Indireção** — o fluxo de negócio está fragmentado entre use case (publica) e handler (reage) em arquivos separados | Debugging requer saltar entre 3+ arquivos para entender o que acontece após `confirmarAgendamento()` |
| **Erros silenciosos** — handlers usam `try/catch` com `console.warn`, o chamador nunca sabe se a reação falhou | `EnviarConfirmacaoAgendamentoHandler` falha no envio de email → use case retorna sucesso, protocolo gerado, cliente sem notificação |
| **Boilerplate** — cada handler exige `constructor(subscribe)`, `private unsubscribe`, `dispose()` e wiring manual no container | 6 handlers = ~180 linhas de boilerplate idêntico |
| **Dupla camada de sync** — `DomainEventBridgeService` + `ModuleEventBridge` somam 455 linhas com 25 subscribers que apenas traduzem `evento domínio → eventoTipo sync` | Complexidade desproporcional para um mapeamento 1:1 |
| **Testes acoplados ao bus** — 5 arquivos de teste instanciam `InMemoryDomainEventBus` com `events.subscribe()` para verificar efeitos colaterais | Teste testa infraestrutura de eventos, não comportamento de negócio |
| **Tipo frágil** — `publish<T>(eventName: string, payload: T)` não valida em compilação que `eventName` e `T` são compatíveis | Typo no eventName só aparece em runtime |

### O que NÃO está em questão

- A **sincronização multi-device** permanece necessária — o `SyncTransport` e o mecanismo de outbox não mudam
- As **constantes de tipo de evento** para o protocolo de sync (`'task.concluida'`, `'demanda.encerrada'`, etc.) permanecem — são o contrato serializado do protocolo
- O **padrão de repositório + use case** não muda — só como os efeitos colaterais são disparados

---

## Decisão

**Substituir o `DomainEventBus` por chamadas diretas de serviço (orquestração inline).**

Cada use case ou repositório que hoje publica um evento passa a chamar diretamente os serviços downstream que consomem aquele evento.

### Princípio

```
Antes:  UseCase → publish(event) → [Handler A, Handler B, SyncBridge] (indireto)
Depois: UseCase → serviceA.handle() → serviceB.handle() → syncOutbox.write() (direto)
```

### Padrão de código

**Antes** (event-driven):

```typescript
// ConfirmarAgendamentoUseCase.ts
export class ConfirmarAgendamentoUseCase {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly events?: DomainEventBus,   // ← some
    ) {}

    async execute(agendamentoId: string, criadoPor: string): Promise<void> {
        agendamento.transitionTo('confirmado');
        await this.agendamentoRepo.save(agendamento);

        await this.events?.publish<AgendamentoConfirmadoPayload>(
            SERVICE_EVENTS.AGENDAMENTO_CONFIRMADO, { agendamentoId, ... }
        );  // ← some
    }
}

// container.ts — wiring distribuído
const domainEventBus = new InMemoryDomainEventBus();
new CriarTaskParaAgendamentoHandler(domainEventBus, ...);    // ← some
new EnviarConfirmacaoAgendamentoHandler(domainEventBus, ...); // ← some
// DomainEventBridgeService registra 25 subscribers no bus    // ← some
```

**Depois** (orquestração direta):

```typescript
// ConfirmarAgendamentoUseCase.ts
export class ConfirmarAgendamentoUseCase {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly taskCreator: CriarTaskService,       // ← novo
        private readonly notificador: NotificacaoService,     // ← novo
        private readonly sync: SyncOutbox,                    // ← novo
    ) {}

    async execute(agendamentoId: string, criadoPor: string): Promise<void> {
        agendamento.transitionTo('confirmado');
        await this.agendamentoRepo.save(agendamento);

        await this.taskCreator.criarParaAgendamento(agendamento, criadoPor);
        await this.notificador.enviarConfirmacao(agendamento);
        await this.sync.write('service.agendamento.confirmado', {
            agendamentoId, slotId: agendamento.slotId, ...
        });
    }
}

// container.ts — wiring explícito
const taskCreator = new CriarTaskService(agendamentoRepo, taskRepo, slotRepo, typeRepo, sqlite);
const notificador = new NotificacaoService(agendamentoRepo, notificacaoRepo, slotRepo, typeRepo);
const confirmarAgendamentoUseCase = new ConfirmarAgendamentoUseCase(
    agendamentoRepo, taskCreator, notificador, syncOutbox
);
```

---

## Abordagem para Sync

### `SyncOutbox` — serviço único de escrita no protocolo de sincronização

Substitui `DomainEventBridgeService` (325 linhas, 20 subscribers) e `ModuleEventBridge` (130 linhas, 5 subscribers):

```typescript
// src/infrastructure/sync/SyncOutbox.ts
export class SyncOutbox {
    constructor(
        private readonly transport: SyncTransport,
        private readonly sqlite: SqlitePort,
    ) {}

    /** Escreve evento tipado no outbox de sincronização */
    async write(type: string, payload: Record<string, unknown>): Promise<void> {
        await this.transport.publish({ type, data: payload });
    }
}
```

### Estratégia de acoplamento: Abordagem A — repositórios chamam `SyncOutbox` direto

Repositórios que hoje recebem `DomainEventBus` no construtor passam a receber `SyncOutbox` e chamam `write()` após cada mutação. Use cases que publicam eventos também recebem `SyncOutbox`.

**Exemplo — repositório:**

```typescript
// SqliteLogisticsRepository.ts — antes
constructor(private readonly db: SqlitePort, private readonly bus?: DomainEventBus) {}

async saveRoteiro(roteiro: Roteiro): Promise<void> {
    await this.db.execute(...);
    await this.bus?.publish(RoteiroCriado, { roteiroId: roteiro.id });
}

// SqliteLogisticsRepository.ts — depois
constructor(private readonly db: SqlitePort, private readonly sync?: SyncOutbox) {}

async saveRoteiro(roteiro: Roteiro): Promise<void> {
    await this.db.execute(...);
    await this.sync?.write('roteiro.criado', { roteiroId: roteiro.id });
}
```

### Por que Abordagem A e não B (Decorator)?

| Critério | Abordagem A (direta) | Abordagem B (decorator) |
|---|---|---|
| Rastreabilidade | Chamada visível no método que faz a mutação | Indireção extra — precisa inspecionar o decorator |
| Controle de quais mutações sincronizam | Por método — `save()` vs `saveSemSync()` é explícito | Todas as mutações passam pelo decorator; exceções exigem flag |
| Consistência com use cases | Use cases também chamam `sync.write()` — mesmo padrão em todo lugar | Mix de padrões: decorator no repo, chamada direta no use case |
| Curva de aprendizado | 1:1 com o código que já existia (era `bus.publish`, vira `sync.write`) | Novo conceito — wrapping implícito |

---

## Redução de Acoplamento na Orquestração

A orquestração direta resolve a indireção do event bus, mas introduz um risco: o use case acumular 4+ dependências no construtor e virar um "god method". Três padrões de baixo custo contêm esse risco, aplicáveis conforme a complexidade de cada domínio.

### Padrão 1 — Fachada de Efeitos por Domínio (recomendado para o Ecoforms)

Agrupa os efeitos colaterais de um domínio em um serviço composto. O use case vê 1 dependência em vez de 3.

```typescript
// AgendamentoEfeitosService.ts — fachada que encapsula task + notificação + sync
export class AgendamentoEfeitosService {
    constructor(
        private readonly taskCreator: CriarTaskService,
        private readonly notificador: NotificacaoService,
        private readonly sync: SyncOutbox,
    ) {}

    async aoConfirmar(ag: Agendamento, criadoPor: string): Promise<void> {
        await this.taskCreator.criarParaAgendamento(ag, criadoPor);
        await this.notificador.enviarConfirmacao(ag);
        await this.sync.write('service.agendamento.confirmado', {
            agendamentoId: ag.id,
            slotId: ag.slotId,
            serviceTypeId: ag.serviceTypeId,
            clienteId: ag.clienteId,
            criadoPor,
        });
    }

    async aoCriar(ag: Agendamento): Promise<void> {
        await this.sync.write('service.agendamento.criado', {
            agendamentoId: ag.id,
            slotId: ag.slotId,
            serviceTypeId: ag.serviceTypeId,
            clienteId: ag.clienteId,
            criadoPor: ag.criadoPor,
        });
    }

    async aoCancelar(ag: Agendamento): Promise<void> {
        await this.sync.write('service.agendamento.cancelado', {
            agendamentoId: ag.id,
            slotId: ag.slotId,
            vagasDevolvidas: ag.vagasSolicitadas,
        });
    }
}

// ConfirmarAgendamentoUseCase.ts — 2 dependências em vez de 4
export class ConfirmarAgendamentoUseCase {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly efeitos: AgendamentoEfeitosService,
    ) {}

    async execute(agendamentoId: string, criadoPor: string): Promise<void> {
        const ag = await this.agendamentoRepo.findById(agendamentoId);
        ag.transitionTo('confirmado');
        await this.agendamentoRepo.save(ag);
        await this.efeitos.aoConfirmar(ag, criadoPor);
    }
}
```

**Aplicação no projeto:**

| Domínio | Fachada | Agrupa |
|---|---|---|
| Agendamento | `AgendamentoEfeitosService` | `CriarTaskService` + `NotificacaoService` + `SyncOutbox` (3 operações) |
| Demanda/Task | `DemandaTaskSynchronizer` | 4 lógicas de sincronização bidirecional entre demanda e tasks + sync |
| Manifestação | `ManifestacaoSyncService` | 11 pontos de `sync.write()` do repositório de manifestações |
| Logística | `LogisticaSyncService` | 6 pontos de `sync.write()` do repositório de logística |

### Padrão 2 — afterCommit Hooks (mínimo acoplamento, mais indireção)

Registra callbacks no container que disparam após o commit da transação. O use case não conhece os efeitos colaterais.

```typescript
// UnitOfWork.ts
export class UnitOfWork {
    private afterCommitHooks: Array<() => Promise<void>> = [];

    onAfterCommit(hook: () => Promise<void>): void {
        this.afterCommitHooks.push(hook);
    }

    async commit(): Promise<void> {
        for (const hook of this.afterCommitHooks) {
            await hook();
        }
        this.afterCommitHooks = [];
    }
}

// ConfirmarAgendamentoUseCase.ts — 2 dependências
constructor(
    private readonly agendamentoRepo: AgendamentoRepository,
    private readonly uow: UnitOfWork,
) {}

// container.ts — hooks registrados fora do use case
uow.onAfterCommit(async () => {
    await taskCreator.criarParaAgendamento(ag, criadoPor);
});
uow.onAfterCommit(async () => {
    await notificador.enviarConfirmacao(ag);
});
```

**Quando usar:** Domínios com >5 efeitos colaterais ou quando a lista de efeitos muda frequentemente. **Não recomendado como padrão principal** — reintroduz indireção, perde rastreabilidade de chamada direta.

### Padrão 3 — Pipeline de Middlewares (mais flexível, mais setup)

Encadeia efeitos como uma lista de passos executados em sequência.

```typescript
// PostConfirmPipeline.ts
const pipeline = new Pipeline([
    new CriarTaskStep(taskRepo),
    new NotificarStep(notifRepo),
    new SyncStep(sync),
]);

// ConfirmarAgendamentoUseCase.ts — 2 dependências
constructor(
    private readonly agendamentoRepo: AgendamentoRepository,
    private readonly pipeline: Pipeline,
) {}

async execute(id: string, criadoPor: string) {
    const ag = await this.repo.save(...);
    await this.pipeline.run(ag, criadoPor);
}
```

**Quando usar:** Fluxos onde a ordem dos passos é configurável por tipo de serviço (ex.: `volumosos` tem passo extra de validação de fotos, `evento` pula notificação). No Ecoforms atual, não há variação de pipeline por tipo — desnecessário.

### Comparação e escolha

| Critério | Fachada (#1) | UoW + hooks (#2) | Pipeline (#3) |
|---|---|---|---|
| Dependências no use case | 2 | 2 | 2 |
| Rastreabilidade | Alta (método `aoConfirmar()` visível) | Baixa (hooks no container) | Média (steps em array) |
| Setup no container | Baixo | Alto | Médio |
| Reutilização entre use cases | Alta (mesma fachada em `criar`/`confirmar`/`cancelar`) | Média | Alta |
| Curva de aprendizado | Nenhuma | Média (novo conceito) | Média |
| Ordem explícita | Sim — código sequencial | Depende da ordem de registro | Sim — posição no array |

**Decisão:** Adotar **Padrão 1 (Fachada por Domínio)** como padrão principal. As fachadas são a evolução natural do que o `DemandaTaskSynchronizer` já faz (agrupa 4 handlers em 1 serviço). O Padrão 2 fica como escape hatch para domínios que no futuro excederem 5 efeitos colaterais.

### Impacto nas fases

A Fase 1 já contempla a criação de fachadas:
- `AgendamentoEfeitosService` encapsula `CriarTaskService` + `NotificacaoService` + sync — use cases de agendamento recebem 2 dependências (repo + efeitos)
- `DemandaTaskSynchronizer` já é uma fachada — unifica 4 handlers

Para as Fases 3 e 4 (repositórios e actions), o `SyncOutbox` permanece como dependência direta — é uma dependência única e estável, não justifica fachada adicional.

---

## Fases de Implementação

### Fase 1 — Reações de Domínio (6 handlers → serviços + fachadas)

Objetivo: eliminar os handlers de negócio, movendo lógica para serviços especializados agrupados em fachadas por domínio.

| # | Ação | Arquivos |
|---|---|---|
| 1.1 | Criar `CriarTaskService` com lógica do `CriarTaskParaAgendamentoHandler` | **Novo:** `src/application/service/services/CriarTaskService.ts` |
| 1.2 | Criar `NotificacaoService` com lógica do `EnviarConfirmacaoAgendamentoHandler` | **Novo:** `src/application/service/services/NotificacaoService.ts` |
| 1.3 | Criar `AgendamentoEfeitosService` — fachada que agrupa `CriarTaskService` + `NotificacaoService` + `SyncOutbox` | **Novo:** `src/application/service/services/AgendamentoEfeitosService.ts` |
| 1.4 | Atualizar `ConfirmarAgendamentoUseCase` — injetar `AgendamentoEfeitosService` (repo + efeitos = 2 deps) | `ConfirmarAgendamentoUseCase.ts` |
| 1.5 | Atualizar `CreateBookingUseCase` — injetar `AgendamentoEfeitosService` | `CreateBookingUseCase.ts` |
| 1.6 | Atualizar `CancelarAgendamentoUseCase` — injetar `AgendamentoEfeitosService` | `CancelarAgendamentoUseCase.ts` |
| 1.7 | Criar `DemandaTaskSynchronizer` — unifica lógica dos 4 handlers de demanda/task | **Novo:** `src/application/demanda/services/DemandaTaskSynchronizer.ts` |
| 1.8 | Atualizar `MoveTaskUseCase` — injetar `DemandaTaskSynchronizer` + `SyncOutbox` | `MoveTaskUseCase.ts` |
| 1.9 | Atualizar `ArchiveTaskUseCase` — injetar `DemandaTaskSynchronizer` + `SyncOutbox` | `ArchiveTaskUseCase.ts` |
| 1.10 | Atualizar `CloseDemandaUseCase` — injetar `DemandaTaskSynchronizer` + `SyncOutbox` | `CloseDemandaUseCase.ts` |

### Fase 2 — Use Cases: remover `.publish()` sem reação

Objetivo: remover `events?.publish()` de use cases que NÃO tinham handlers de domínio (só o sync bridge consumia). Substituir por `sync.write()`.

| # | Arquivo | Evento removido | Nova chamada |
|---|---|---|---|
| 2.1 | `CreateBookingUseCase.ts` | `AGENDAMENTO_CRIADO` | `sync.write('service.agendamento.criado', {...})` |
| 2.2 | `CancelarAgendamentoUseCase.ts` | `AGENDAMENTO_CANCELADO` | `sync.write('service.agendamento.cancelado', {...})` |
| 2.3 | `EditSuiteUseCase.ts` | `SuiteEditado` | `sync.write('suite.editado', {...})` |
| 2.4 | `ResubmitSuiteUseCase.ts` | `SuiteEditado` | `sync.write('suite.editado', {...})` |
| 2.5 | `ReviewSuiteUseCase.ts` | `SuiteAprovado` | `sync.write('suite.aprovado', {...})` |
| 2.6 | `AcceptDemandaUseCase.ts` | `TaskCriada` + `DemandaAceita` | `sync.write('task.criada', {...})` + `sync.write('demanda.aceita', {...})` |
| 2.7 | `UpdateManifestacaoStatusUseCase.ts` | `ManifestacaoStatusAtualizado` | `sync.write('manifestacao.status_atualizado', {...})` |
| 2.8 | `VisualViewUseCases.ts` | 3 eventos | `sync.write(...)` para cada |

### Fase 3 — Repositórios: `DomainEventBus` → `SyncOutbox`

Objetivo: repositórios que publicavam eventos para sync passam a escrever direto no outbox.

| # | Arquivo | Eventos (11 + 6) | Substituição |
|---|---|---|---|
| 3.1 | `SqliteManifestacaoRepository.ts` | `ManifestacaoCriada`, `ManifestacaoStatusAtualizado`, `ManifestacaoClassificada`, `CompetenciaVerificada`, `TramitacaoRegistrada`, `ManifestacaoTransferida`, `RespostaRegistrada`, `RespostaFormatada`, `DespachoRegistrado`, `PrazoAdicionado` | `this.sync?.write('manifestacao.criada', ...)` etc. |
| 3.2 | `SqliteLogisticsRepository.ts` | `RoteiroCriado`, `RoteiroAtualizado`, `ExecucaoCriada`, `ExecucaoStatusAtualizado`, `IntercorrenciaRegistrada`, `IntercorrenciaResolvida` | `this.sync?.write('roteiro.criado', ...)` etc. |

### Fase 4 — Actions (builtin): `ctx.eventBus` → `ctx.syncOutbox`

Objetivo: substituir `ActionEventPublisher` por `SyncOutbox` no contexto de actions.

| # | Arquivo | Alteração |
|---|---|---|
| 4.1 | `ActionRegistry.ts` | `ActionEventPublisher` → `SyncOutbox` no `ActionContext` |
| 4.2 | `suite.actions.ts` | `ctx.eventBus.publish(...)` → `ctx.syncOutbox.write(...)` |
| 4.3 | `demanda.actions.ts` | idem |
| 4.4 | `criar_tarefa.action.ts` | idem |
| 4.5 | `devolver.action.ts` | idem |
| 4.6 | `reencaminhar.action.ts` | idem |
| 4.7 | `solicitar.action.ts` | idem |
| 4.8 | `ecoponto.actions.ts` | idem |

### Fase 5 — Limpeza

| # | Ação | Arquivos |
|---|---|---|
| 5.1 | Deletar `DomainEventBus.ts` | `src/domain/shared/DomainEventBus.ts` |
| 5.2 | Deletar 9 arquivos de constantes de evento | `ServiceEvents.ts`, `TaskEvents.ts`, `DemandaEvents.ts`, `SuiteEvents.ts`, `ModuleEvents.ts`, `ModuleViewEvents.ts`, `ManifestacaoEvents.ts`, `LogisticsEvents.ts` |
| 5.3 | Deletar 6 handlers de domínio | `CriarTaskParaAgendamentoHandler.ts`, `EnviarConfirmacaoAgendamentoHandler.ts`, `DemandaSynchronizationHandler.ts`, `CloseDemandaOnAllTasksArchivedHandler.ts`, `CloseDemandaOnAllTasksConcludedHandler.ts`, `CloseTasksOnDemandaEncerradaHandler.ts` |
| 5.4 | Deletar 2 bridges de sync | `DomainEventBridgeService.ts`, `ModuleEventBridge.ts` |
| 5.5 | Deletar `useEventBus.ts` | `src/interface/hooks/utils/useEventBus.ts` |
| 5.6 | Remover wiring de handlers + `InMemoryDomainEventBus` do `container.ts` | `container.ts` |
| 5.7 | Remover `DomainEventBus` de `lazy-sync.ts` | `lazy-sync.ts` |
| 5.8 | Atualizar 5 arquivos de teste | `MoveTaskUseCase.test.ts`, `ArchiveTaskUseCase.test.ts`, `CloseDemandaUseCase.test.ts`, `AcceptDemandaUseCase.test.ts` |
| 5.9 | Verificar `VerificarPrazosVencidosJob.ts` | Remover parâmetro `bus?` e usar `syncOutbox` |

---

## Trade-offs

### Ganhos

| Ganho | Explicação |
|---|---|
| **Rastreabilidade total** | Fluxo de negócio visível em um único método — sem saltar entre publish e subscribe |
| **Erros explícitos** | Se `notificador.enviarConfirmacao()` falha, o use case decide: faz throw? faz log? ignora? Decisão explícita, não `try/catch` silencioso em handler remoto |
| **Menos infraestrutura** | Remove 1 interface + 1 implementação (`DomainEventBus`), 9 arquivos de constantes, 8 handlers, 2 bridges. Total: **~20 arquivos deletados** |
| **Menos boilerplate** | Cada handler atual tem `constructor(subscribe)`, `private unsubscribe`, `dispose()`. Tudo some. |
| **Testes mais simples** | Em vez de instanciar `InMemoryDomainEventBus` + `subscribe`, basta spy no serviço injetado |
| **Tipo seguro** | `sync.write('service.agendamento.confirmado', payload)` — o tipo do payload pode ser validado por overload, não por string mágica |

### Perdas

| Perda | Mitigação |
|---|---|
| **Desacoplamento** — adicionar nova reação a um evento exige mexer no use case | Na prática, o projeto tem 6 reações em 1 ano de desenvolvimento. O custo de adicionar 1 linha no use case é menor que manter infra de pub/sub para 6 handlers |
| **Sync outbox precisa ser injetado em todo lugar** — use cases e repositórios ganham +1 dependência | `SyncOutbox` é uma dependência estável (muda menos que repositórios). Pode ser omitida via `sync?: SyncOutbox` (optional) se o ambiente não exigir sync |
| **Ordem de chamadas importa** — `taskCreator` antes de `notificador`? | Já importava no modelo de eventos (handlers executam em sequência no `InMemoryDomainEventBus`, linha 14 do `DomainEventBus.ts`: `for (const handler of set) { await handler(payload); }`). A ordem agora é explícita no código, não implícita na ordem de `subscribe()` |

---

## Definição de Pronto (DoD)

- [ ] `ConfirmarAgendamentoUseCase` chama `taskCreator` e `notificador` diretamente — sem eventos
- [ ] `MoveTaskUseCase`, `ArchiveTaskUseCase`, `CloseDemandaUseCase` chamam `DemandaTaskSynchronizer` diretamente
- [ ] Todos os repositórios chamam `sync.write()` em vez de `bus.publish()`
- [ ] `SyncOutbox` implementado e injetado no container
- [ ] `InMemoryDomainEventBus` e `DomainEventBus` interface removidos
- [ ] 9 arquivos de constantes de evento deletados
- [ ] 8 arquivos de handler deletados
- [ ] 2 bridges de sync deletadas
- [ ] 5 arquivos de teste atualizados — testes passam sem `InMemoryDomainEventBus`
- [ ] `container.ts` sem referências a `DomainEventBus`
- [ ] `lazy-sync.ts` sem `_domainEventBus` / `getEventBus()`
- [ ] Nenhum `import` quebrado (verificado via `next build`)
- [ ] Sync multi-device funcional (teste manual: criar agendamento no desktop A, verificar no desktop B)
