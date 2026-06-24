# ADR-070 ÔÇö Confirma├º├úo da Orquestra├º├úo Direta p├│s-ADR-022


> **Renumerado** de ADR-058 para ADR-070 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:** Decidido  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Branch:** gaps-90-92-93-fix  
**Contexto externo:** Lacuna ­ƒƒí "Domain event bus: rea├º├Áes entre agregados s├úo inline" ÔÇö confirma decis├úo do ADR-022 e estabelece padr├úo para novas rea├º├Áes cross-aggregate.

---

## Contexto

### ADR-022 (2026-05-21)

ADR-022 decidiu **substituir o `DomainEventBus` por orquestra├º├úo direta** (chamadas inline de servi├ºo dentro dos use cases). A decis├úo foi motivada por 6 problemas:

| Problema | Resolvido? |
|---|---|
| Indire├º├úo (debugging em 3+ arquivos) | Ô£à Use case chama servi├ºo diretamente |
| Erros silenciosos em handlers | Ô£à Erro propaga na call stack |
| Boilerplate de handlers (180 linhas) | Ô£à Eliminado |
| Dupla camada de sync (455 linhas) | Ô£à Substitu├¡da por `SyncOutbox` direto |
| Testes acoplados ao bus | Ô£à Testes chamam servi├ºo, n├úo bus |
| Tipo fr├ígil publish<T> | Ô£à TypeScript valida chamada direta |

### O trade-off aceito

A decis├úo do ADR-022 aceitou um trade-off expl├¡cito:

> Automa├º├Áes reativas (ex: "quando X acontece, disparar Y automaticamente") exigem c├│digo expl├¡cito no use case de X. N├úo h├í mecanismo declarativo de subscribe.

A lacuna ­ƒƒí apontada nas user stories reflete exatamente esse trade-off: "limita automa├º├Áes reativas."

### Situa├º├úo atual (2026-06-09)

ADR-022 foi **proposto** mas a migra├º├úo do c├│digo n├úo foi conclu├¡da ÔÇö restam vest├¡gios do event bus em alguns use cases e os bridges de sync n├úo foram totalmente substitu├¡dos pelo `SyncOutbox`.

---

## Decis├úo

### Confirmar ADR-022 ÔÇö manter orquestra├º├úo direta

A orquestra├º├úo direta ├® o padr├úo permanente. **N├úo** ser├í reintroduzido um event bus. O trade-off de automa├º├Áes reativas ├® aceito porque:

1. O dom├¡nio tem baixo acoplamento cross-aggregate ÔÇö as rea├º├Áes conhecidas s├úo poucas e bem definidas
2. O sistema ├® operacional (n├úo SaaS multi-tenant) ÔÇö novas automa├º├Áes s├úo raras e podem ser codificadas inline
3. A simplicidade de debugging (stack trace linear) supera a flexibilidade de um bus para este porte de sistema

### Padr├úo para rea├º├Áes cross-aggregate

Quando um use case precisa disparar efeito colateral em outro agregado, o padr├úo ├®:

```typescript
export class ConfirmarAgendamentoUseCase {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly agendamentoEfeitos: AgendamentoEfeitosService, // ÔåÉ agrupa rea├º├Áes
        private readonly syncOutbox: SyncOutbox,
    ) {}

    async execute(id: string): Promise<void> {
        // 1. Muta├º├úo principal
        const ag = await this.agendamentoRepo.findById(id);
        ag.confirmar();
        await this.agendamentoRepo.save(ag);

        // 2. Efeitos colaterais ÔÇö orquestra├º├úo direta, ordenada
        await this.agendamentoEfeitos.onConfirmado(ag); // cria task, notifica, etc.

        // 3. Sync
        await this.syncOutbox.append('agendamento.confirmado', ag.toEvent());
    }
}
```

**Regras:**
- Um servi├ºo `{Agregado}EfeitosService` por agregado que agrupa todas as rea├º├Áes cross-aggregate
- Ordem dos efeitos ├® expl├¡cita e sequencial (debug deterministic)
- `SyncOutbox` ├® sempre o ├║ltimo passo (garante que estado est├í consistente antes de publicar evento multi-device)
- Falha em qualquer efeito propaga erro (n├úo h├í `try/catch` silencioso) ÔÇö o use case faz rollback ou decide se ├® non-fatal

### Migra├º├úo pendente do ADR-022

| Item | Status | A├º├úo |
|---|---|---|
| `DomainEventBus` removido do container | ÔØî | Substituir por `AgendamentoEfeitosService` + `SyncOutbox` |
| `DomainEventBridgeService` (25 subscribers) | ÔØî | Mover l├│gica para `SyncOutbox.append()` com mapeamento direto `evento ÔåÆ sync_type` |
| `ModuleEventBridge` | ÔØî | Manter ÔÇö m├│dulos din├ómicos s├úo consumer de eventos externos, n├úo publisher interno |
| Handlers reativos (`CriarTaskParaAgendamentoHandler`, etc.) | ÔÜá´©Å | Migrar l├│gica para `AgendamentoEfeitosService.onConfirmado()` |
| Testes de handler migrados para testes de servi├ºo | ÔØî | Testar `AgendamentoEfeitosService` diretamente, sem bus |

---

## O que N├âO faz parte deste ADR

- **Reintrodu├º├úo de event bus** ÔÇö Decis├úo permanente. S├│ reconsiderar se o n├║mero de rea├º├Áes cross-aggregate ultrapassar 20 (hoje s├úo 8).
- **Event sourcing como padr├úo de persist├¬ncia** ÔÇö O `SyncOutbox` ├® para transporte multi-device, n├úo para reconstruir estado do agregado. O estado ├® persistido diretamente no SQLite.
- **Mensageria externa (Kafka, RabbitMQ)** ÔÇö Overkill para sistema single-deployment. Supabase Realtime cobre notifica├º├Áes push sem broker dedicado.

---

## Rastreabilidade

| Documento | Rela├º├úo |
|---|---|
| ADR-022 | Decis├úo original ÔÇö este ADR confirma e detalha o plano de migra├º├úo |
| ADR-019 | `Agendamento ÔåÆ Task` ├® o caso can├┤nico de rea├º├úo cross-aggregate |
| ADR-027 | `SyncOutbox` ├® o substituto do `DomainEventBridgeService` para sync multi-device |
| User Stories ÔÇö M├│dulos | Lacuna ­ƒƒí documenta o trade-off aceito |
