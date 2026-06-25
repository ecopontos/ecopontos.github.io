# ADR-066 ÔÇö Flag `requerMapa` no ServiceType para exibi├º├úo de roteiro geogr├ífico


> **Renumerado** de ADR-053 para ADR-066 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:** Implementado  
**Data:** 2026-06-03  
**Autor:** Marcelo Luiz  

---

## Contexto

O sistema de agendamentos lida com tr├¬s tipos de servi├ºo:

- **Museu do Lixo** ÔÇö local fixo, sem necessidade de roteiro
- **Coleta de Volumosos** ÔÇö m├║ltiplos endere├ºos por slot, exige roteiro
- **Palestra / Evento** ÔÇö locais vari├íveis, pode exigir roteiro

Atualmente, a localiza├º├úo ├® tratada como texto (`bairros`, `local`). N├úo h├í geo-coordenadas nem mapa no fluxo de agendamento. O m├│dulo de log├¡stica j├í possui `ItinerarioMap` (MapLibre GL) usado via modal (`ItinerarioModal`).

Para adicionar visualiza├º├úo de roteiro nos agendamentos, precisamos de uma flag que determine quais tipos de servi├ºo exigem mapa.

## Decis├úo

Adicionar `requerMapa: boolean` ao **ServiceType** (n├úo ao ServiceSlot), seguindo o padr├úo existente de `requerFotos` e `bairrosObrigatorios`.

**Por que ServiceType e n├úo ServiceSlot:**

1. Consist├¬ncia com `requerFotos` e `bairrosObrigatorios` (ambos no tipo)
2. A necessidade de roteiro ├® caracter├¡stica da natureza do servi├ºo, n├úo de uma janela espec├¡fica
3. Zero boolean flags no ServiceSlot ÔÇö manter separa├º├úo de responsabilidades
4. Define uma vez, todos os slots herdam

**Valores iniciais (seed):**

| Tipo | requerMapa | Justificativa |
|------|-----------|---------------|
| museu | 0 | Local fixo ÔÇö n├úo precisa de roteiro |
| volumosos | 1 | Coleta em m├║ltiplos endere├ºos ÔÇö exige roteiro |
| evento | 1 | Locais vari├íveis ÔÇö exige roteiro |

## Alternativas consideradas

### Op├º├úo B ÔÇö Flag no ServiceSlot
**Rejeitada.** Quebra o padr├úo existente (flags de comportamento no tipo). Cada slot precisaria ser configurado individualmente ÔÇö redundante para tipos que sempre exigem mapa.

### Op├º├úo C ÔÇö Sempre mostrar mapa para todos os tipos
**Rejeitada.** Poluiria a UI com mapa desnecess├írio para museu (local fixo).

## Consequ├¬ncias

### Positivas

- UI pode condicionalmente mostrar bot├úo "Ver Roteiro no Mapa"
- Modal reutiliza `ItinerarioMap` existente da log├¡stica
- Padr├úo consistente com as outras flags do ServiceType
- F├ícil de estender: basta o frontend ler `serviceType.requerMapa`

### Riscos

- O mapa em si (geocoding de endere├ºos, renderiza├º├úo de rotas) ├® escopo futuro ÔÇö esta ADR s├│ entrega a flag
- Depende de `clientes.latitude/longitude` existentes ou geocoding via CEP para plotar pins no mapa

## Implementa├º├úo

| Camada | Arquivo | Mudan├ºa |
|--------|---------|---------|
| Dom├¡nio | `ServiceType.ts` | + `requerMapa: boolean` em props, getter, `toSyncJSON` |
| Infra | `SqliteServiceTypeRepository.ts` | + `requer_mapa` no row, mapper, save SQL |
| Banco | `ensure-columns.ts` | `ALTER TABLE ADD COLUMN requer_mapa INTEGER DEFAULT 0` + update seed |
| Use Case | `CreateServiceTypeUseCase.ts` | + `requerMapa` no input + fromProps |
| Use Case | `UpdateServiceTypeUseCase.ts` | + `requerMapa` no input + spread |
| UI | `novo/page.tsx` | Switch "Requer Mapa" no formul├írio |
| UI | `[id]/page.tsx` | Switch "Requer Mapa" + init + submit |

Fora do escopo (ADR futura): implementa├º├úo do modal de mapa consumindo `serviceType.requerMapa` e renderizando pins/rotas via MapLibre.

## Refer├¬ncias

- ADR-018 ÔÇö Motor de agendamentos
- ADR-019 ÔÇö Desacoplamento Booking/Task
- `src/domain/service/ServiceType.ts` ÔÇö entidade ServiceType
- `components/logistics/ItinerarioModal.tsx` ÔÇö modal de mapa existente na log├¡stica
