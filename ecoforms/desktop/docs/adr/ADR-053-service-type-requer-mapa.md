# ADR-053 — Flag `requerMapa` no ServiceType para exibição de roteiro geográfico

**Status:** Implementado  
**Data:** 2026-06-03  
**Autor:** Marcelo Luiz  

---

## Contexto

O sistema de agendamentos lida com três tipos de serviço:

- **Museu do Lixo** — local fixo, sem necessidade de roteiro
- **Coleta de Volumosos** — múltiplos endereços por slot, exige roteiro
- **Palestra / Evento** — locais variáveis, pode exigir roteiro

Atualmente, a localização é tratada como texto (`bairros`, `local`). Não há geo-coordenadas nem mapa no fluxo de agendamento. O módulo de logística já possui `ItinerarioMap` (MapLibre GL) usado via modal (`ItinerarioModal`).

Para adicionar visualização de roteiro nos agendamentos, precisamos de uma flag que determine quais tipos de serviço exigem mapa.

## Decisão

Adicionar `requerMapa: boolean` ao **ServiceType** (não ao ServiceSlot), seguindo o padrão existente de `requerFotos` e `bairrosObrigatorios`.

**Por que ServiceType e não ServiceSlot:**

1. Consistência com `requerFotos` e `bairrosObrigatorios` (ambos no tipo)
2. A necessidade de roteiro é característica da natureza do serviço, não de uma janela específica
3. Zero boolean flags no ServiceSlot — manter separação de responsabilidades
4. Define uma vez, todos os slots herdam

**Valores iniciais (seed):**

| Tipo | requerMapa | Justificativa |
|------|-----------|---------------|
| museu | 0 | Local fixo — não precisa de roteiro |
| volumosos | 1 | Coleta em múltiplos endereços — exige roteiro |
| evento | 1 | Locais variáveis — exige roteiro |

## Alternativas consideradas

### Opção B — Flag no ServiceSlot
**Rejeitada.** Quebra o padrão existente (flags de comportamento no tipo). Cada slot precisaria ser configurado individualmente — redundante para tipos que sempre exigem mapa.

### Opção C — Sempre mostrar mapa para todos os tipos
**Rejeitada.** Poluiria a UI com mapa desnecessário para museu (local fixo).

## Consequências

### Positivas

- UI pode condicionalmente mostrar botão "Ver Roteiro no Mapa"
- Modal reutiliza `ItinerarioMap` existente da logística
- Padrão consistente com as outras flags do ServiceType
- Fácil de estender: basta o frontend ler `serviceType.requerMapa`

### Riscos

- O mapa em si (geocoding de endereços, renderização de rotas) é escopo futuro — esta ADR só entrega a flag
- Depende de `clientes.latitude/longitude` existentes ou geocoding via CEP para plotar pins no mapa

## Implementação

| Camada | Arquivo | Mudança |
|--------|---------|---------|
| Domínio | `ServiceType.ts` | + `requerMapa: boolean` em props, getter, `toSyncJSON` |
| Infra | `SqliteServiceTypeRepository.ts` | + `requer_mapa` no row, mapper, save SQL |
| Banco | `ensure-columns.ts` | `ALTER TABLE ADD COLUMN requer_mapa INTEGER DEFAULT 0` + update seed |
| Use Case | `CreateServiceTypeUseCase.ts` | + `requerMapa` no input + fromProps |
| Use Case | `UpdateServiceTypeUseCase.ts` | + `requerMapa` no input + spread |
| UI | `novo/page.tsx` | Switch "Requer Mapa" no formulário |
| UI | `[id]/page.tsx` | Switch "Requer Mapa" + init + submit |

Fora do escopo (ADR futura): implementação do modal de mapa consumindo `serviceType.requerMapa` e renderizando pins/rotas via MapLibre.

## Referências

- ADR-018 — Motor de agendamentos
- ADR-019 — Desacoplamento Booking/Task
- `src/domain/service/ServiceType.ts` — entidade ServiceType
- `components/logistics/ItinerarioModal.tsx` — modal de mapa existente na logística