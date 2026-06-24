# Gaps & melhorias — relação Mapa ↔ módulo Logística

> Auditoria 2026-06-13. Escopo: `app/logistica/**`, `components/logistics/**`,
> `components/agendamentos/{RoteiroMap,RoteiroModal}`, `hooks/queries/useMapData.ts`.
>
> **Status SQL (2026-06-13, fim de sessão P3):** o **P3 inteiro** de `useMapData.ts` foi resolvido em `ba4696a` (batch 6b-2) — 26 SQLs inline migradas para 3 catalogs novos em `desktop/src/infrastructure/persistence/sqlite/queries/` (`terrenos.ts` com 11 QueryDefs, `geo_layers.ts` com 4, `execucao_clientes.ts` com 3) + 8 QueryDefs adicionados a `pacotes.ts` (PACOTE_INACTIVATE_ATUAL, PACOTE_NEW_VERSION_FROM_LAST, PACOTES_PENDING_SOLICITACOES_COUNT, PACOTE_UPDATE_STATUS, PACOTE_UPDATE_DADOS, PACOTE_NEW_VERSION_DISPATCHED, PACOTE_SOLICITAR_INSERT, PACOTE_BY_ID_ATUAL) + `lookups.ts` fachada com 16 funções imperativas (`fetchClientesGeo`/`fetchTerrenosAtivos`/`fetchTerrenosInViewportRtree`/`Centroid`/`fetchTerrenosExtent`/`fetchItinerario`/`fetchGeoLayers`/`fetchExecucaoGeo`/`fetchIntercorrenciasGeo`/`fetchChecklistGeo` + mutações `insertTerrenoOrIgnore`/`upsertTerrenosRtree`/`deleteTerrenoByIdSafe`/`upsertGeoLayer`/`toggleGeoLayerVisivel`/`deleteGeoLayer`). `useMapData` perdeu `invoke()` Tauri e `queryRows()` helper. Ver [[SQL_INLINE_AUDIT]]. **Os gaps de mapa G1–G6 e bugs B1–B4 abaixo não foram tocados** por esse refactor — continuam válidos como roadmap do módulo Logística.

## Mapa de componentes (estado atual)

| Componente | Onde | Stack | Camadas |
|---|---|---|---|
| `LogisticsMap` | aba **Mapa** em `/logistica` | hooks (`useMapInstance`+`useGeoDataLayers`+`useExecucaoLayers`) | terrenos, clientes (cluster), itinerário, execução/intercorrências/checklist, satélite, viewport-loading, geo_layers genéricas |
| `ItinerarioMap` | `ItinerarioModal` (botão "Itinerário" na lista) | **standalone** (próprio `OSM_STYLE`, própria instância) | clientes (in-route vs disponível), rota, terrenos da rota |
| `RoteiroMap` | `RoteiroModal` (agendamentos) | **standalone** | pontos de agendamento + linha de rota |

Três setups MapLibre independentes, três `OSM_STYLE`, três implementações de
popup/fitBounds/render. Linguagens visuais divergentes (itinerário=`#ef4444`,
logística=`#f97316`, agendamento=`#3b82f6`).

---

## Gaps de funcionalidade

### G1 — `RoteiroDetailPage` não tem mapa (alto impacto)
`/logistica/roteiros/[id]` é o lugar natural para ver o roteiro
geograficamente, mas só tem tabelas. O mapa do roteiro existe só no
`ItinerarioModal` (lista) e na aba Mapa. Pior: o detalhe usa reordenação
manual ↑↓ enquanto o modal usa drag-and-drop **com** mapa → duas UIs de
reordenação para o mesmo dado, nenhuma co-localizada com mapa.

### G2 — Sem otimização de rota (alto valor)
`ordem` do itinerário é 100% manual. Coordenadas de todos os pontos já estão
disponíveis (`useItinerario` retorna lat/lng via `COALESCE(terreno.centroid, cliente)`),
mas não há nearest-neighbor / ordenação por distância. A linha de rota só liga
pontos na ordem manual → zig-zags óbvios sem aviso. Botão "Otimizar rota"
(NN greedy client-side) é barato e de alto retorno.

### G3 — Pontos sem coordenada somem silenciosamente (risco operacional)
`renderItinerary` filtra `s.latitude != null`. Parada sem geo desaparece do
mapa sem indicador. Nem detalhe nem modal mostram "N de M pontos sem
localização". `RoteiroModal` titula "Agendamentos com localização" mas não diz
quantos foram excluídos. Motorista pode perder uma parada só por estar sem
geocódigo.

### G4 — Camadas de execução (ADR-039) só na aba Mapa
A visualização rica de execução (coletado vs não, intercorrências, checklist
com foto-evidência) **não** aparece no `RoteiroDetailPage`, onde as execuções
são gerenciadas. No `ColetaRegistroPanel` registra-se coleta sem mapa de
done/pending. Um mapa ali fecharia o loop.

### G5 — Falta deep-link detalhe → aba Mapa
A aba Execuções liga ao painel de coleta (`?exec=&panel=coleta`), mas não há
botão "Ver no mapa" que pule para a aba Mapa pré-selecionando roteiro/execução.
Os seletores da aba Mapa são manuais. Falta `?roteiro=`/`?exec=` na aba Mapa
(espelhando o padrão de deep-link já existente).

### G6 — Rota em linha reta, sem rede viária
Itinerário e agendamento desenham segmentos retos (crow-flies). Sem engine de
roteamento (OSRM/Valhalla) e sem distância/tempo. Aceitável p/ app offline, mas
no mínimo exibir distância total em linha reta + alertar paradas muito
distantes da sequência.

---

## Bugs / dívida técnica

### B1 — Satélite derruba camadas de execução (bug confirmado)
`useMapInstance` registra no `style.load` apenas `renderDataLayers` (geoData).
As camadas de `useExecucaoLayers` (`exec-points`, `interc-points`,
`checklist-points`) são adicionadas só via `useEffect` nas mudanças de dados,
nunca re-adicionadas no `style.load`. Trocar satélite/OSM com uma execução
selecionada **apaga** essas camadas até reselecionar. O próprio comentário em
`useExecucaoLayers` admite que "estas camadas não são re-registradas no
style.load". → passar um callback combinado ao `onStyleLoad`.

### B2 — Recriação do mapa por identidade de callback
Em `ItinerarioMap`/`RoteiroMap` o `useEffect` de init depende de `renderLayers`
(→ `onClienteClick`/`onPointClick`). Se o pai passar callback instável, o mapa
inteiro é destruído/recriado. Hoje passam setters estáveis (OK), mas frágil —
usar ref como em `useMapInstance.onStyleLoadRef`.

### B3 — Duplicação (manutenção)
Três render-pipelines paralelos. Extrair `useBaseMap` + helpers de
popup/route-line compartilhados; unificar paleta em `lib/map-styles.ts`.

### B4 — `ItinerarioMap` carrega todos os clientes sem clustering/viewport
Diferente do `LogisticsMap`. Em base grande o modal fica pesado.

---

## Prioridade sugerida

1. **B1** (bug satélite) — correção pequena, regressão visível.
2. **G1 + G4** — mapa no `RoteiroDetailPage` reusando hooks de `LogisticsMap`
   (itinerário + execução co-localizados com as tabelas).
3. **G3** — badge "X sem localização" em modal/detalhe/Mapa.
4. **G2** — botão "Otimizar rota" (NN greedy) no modal de itinerário.
5. **G5** — deep-link detalhe → aba Mapa.
6. **B3/B4/G6** — refactor de unificação + distância + roteamento (maior esforço).
