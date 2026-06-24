# ADR-058 — Confirmação da Orquestração Direta pós-ADR-022

**Status:** Decidido  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Branch:** gaps-90-92-93-fix  
**Contexto externo:** Lacuna 🟡 "Domain event bus: reações entre agregados são inline" — confirma decisão do ADR-022 e estabelece padrão para novas reações cross-aggregate.

---

## Contexto

### ADR-022 (2026-05-21)

ADR-022 decidiu **substituir o `DomainEventBus` por orquestração direta** (chamadas inline de serviço dentro dos use cases). A decisão foi motivada por 6 problemas:

| Problema | Resolvido? |
|---|---|
| Indireção (debugging em 3+ arquivos) | ✅ Use case chama serviço diretamente |
| Erros silenciosos em handlers | ✅ Erro propaga na call stack |
| Boilerplate de handlers (180 linhas) | ✅ Eliminado |
| Dupla camada de sync (455 linhas) | ✅ Substituída por `SyncOutbox` direto |
| Testes acoplados ao bus | ✅ Testes chamam serviço, não bus |
| Tipo frágil publish<T> | ✅ TypeScript valida chamada direta |

### O trade-off aceito

A decisão do ADR-022 aceitou um trade-off explícito:

> Automações reativas (ex: "quando X acontece, disparar Y automaticamente") exigem código explícito no use case de X. Não há mecanismo declarativo de subscribe.

A lacuna 🟡 apontada nas user stories reflete exatamente esse trade-off: "limita automações reativas."

### Situação atual (2026-06-09)

ADR-022 foi **proposto** mas a migração do código não foi concluída — restam vestígios do event bus em alguns use cases e os bridges de sync não foram totalmente substituídos pelo `SyncOutbox`.

---

## Decisão

### Confirmar ADR-022 — manter orquestração direta

A orquestração direta é o padrão permanente. **Não** será reintroduzido um event bus. O trade-off de automações reativas é aceito porque:

1. O domínio tem baixo acoplamento cross-aggregate — as reações conhecidas são poucas e bem definidas
2. O sistema é operacional (não SaaS multi-tenant) — novas automações são raras e podem ser codificadas inline
3. A simplicidade de debugging (stack trace linear) supera a flexibilidade de um bus para este porte de sistema

### Padrão para reações cross-aggregate

Quando um use case precisa disparar efeito colateral em outro agregado, o padrão é:

```typescript
export class ConfirmarAgendamentoUseCase {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly agendamentoEfeitos: AgendamentoEfeitosService, // ← agrupa reações
        private readonly syncOutbox: SyncOutbox,
    ) {}

    async execute(id: string): Promise<void> {
        // 1. Mutação principal
        const ag = await this.agendamentoRepo.findById(id);
        ag.confirmar();
        await this.agendamentoRepo.save(ag);

        // 2. Efeitos colaterais — orquestração direta, ordenada
        await this.agendamentoEfeitos.onConfirmado(ag); // cria task, notifica, etc.

        // 3. Sync
        await this.syncOutbox.append('agendamento.confirmado', ag.toEvent());
    }
}
```

**Regras:**
- Um serviço `{Agregado}EfeitosService` por agregado que agrupa todas as reações cross-aggregate
- Ordem dos efeitos é explícita e sequencial (debug deterministic)
- `SyncOutbox` é sempre o último passo (garante que estado está consistente antes de publicar evento multi-device)
- Falha em qualquer efeito propaga erro (não há `try/catch` silencioso) — o use case faz rollback ou decide se é non-fatal

### Migração pendente do ADR-022

| Item | Status | Ação |
|---|---|---|
| `DomainEventBus` removido do container | ❌ | Substituir por `AgendamentoEfeitosService` + `SyncOutbox` |
| `DomainEventBridgeService` (25 subscribers) | ❌ | Mover lógica para `SyncOutbox.append()` com mapeamento direto `evento → sync_type` |
| `ModuleEventBridge` | ❌ | Manter — módulos dinâmicos são consumer de eventos externos, não publisher interno |
| Handlers reativos (`CriarTaskParaAgendamentoHandler`, etc.) | ⚠️ | Migrar lógica para `AgendamentoEfeitosService.onConfirmado()` |
| Testes de handler migrados para testes de serviço | ❌ | Testar `AgendamentoEfeitosService` diretamente, sem bus |

---

## O que NÃO faz parte deste ADR

- **Reintrodução de event bus** — Decisão permanente. Só reconsiderar se o número de reações cross-aggregate ultrapassar 20 (hoje são 8).
- **Event sourcing como padrão de persistência** — O `SyncOutbox` é para transporte multi-device, não para reconstruir estado do agregado. O estado é persistido diretamente no SQLite.
- **Mensageria externa (Kafka, RabbitMQ)** — Overkill para sistema single-deployment. Supabase Realtime cobre notificações push sem broker dedicado.

---

## Rastreabilidade

| Documento | Relação |
|---|---|
| ADR-022 | Decisão original — este ADR confirma e detalha o plano de migração |
| ADR-019 | `Agendamento → Task` é o caso canônico de reação cross-aggregate |
| ADR-027 | `SyncOutbox` é o substituto do `DomainEventBridgeService` para sync multi-device |
| User Stories — Módulos | Lacuna 🟡 documenta o trade-off aceito |
