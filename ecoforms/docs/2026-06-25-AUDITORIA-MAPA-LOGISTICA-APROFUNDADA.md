# Auditoria Aprofundada — Aba Mapa (módulo Logística) — 2026-06-25

Aprofundamento do relatório `GAP_MAPA_LOGISTICA.md` (2026-06-13). Reverifica o estado dos gaps/bugs
anteriores e adiciona **bugs e melhorias de qualidade não detectados antes**, focando no runtime real da
aba **Mapa** (`/logistica` → tab "Mapa" → `LogisticsMap`).

**Escopo auditado:**
- `desktop/app/logistica/page.tsx` (tab Mapa)
- `desktop/components/logistics/LogisticsMap.tsx`
- `desktop/components/logistics/hooks/{useMapInstance,useGeoDataLayers,useExecucaoLayers,useViewport,useLayerActions}.ts`
- `desktop/components/logistics/{map-layers.ts,ItinerarioMap.tsx}`
- `desktop/components/agendamentos/RoteiroMap.tsx`
- `desktop/src/interface/hooks/queries/useLogistics.ts`

Todos os achados foram verificados em arquivo:linha.

> **Atualização 2026-06-25 (commit `a10c50d`):** **N1, N2, N3, N5 e N6 corrigidos**.
> **N4** (fetch duplicado) **adiado** — página e mapa usam filtros diferentes em `useRoteiros`/
> `useExecucoes`, então não são duplicatas reais; dedupe seguro exige cache compartilhado.
> **N7** (unificação dos 3 setups MapLibre): **parcial** — `OSM_STYLE` unificado + helper
> `createBaseMap` (ver N7). **Gaps funcionais G1, G2, G3, G5 resolvidos** e **G6 parcial** (distância
> em linha reta) — ver seção 0. **G4 endereçado por navegação** (botão "Mapa" nas execuções abre a aba
> Mapa com a execução pré-selecionada); embutir as camadas de execução no mapa do detalhe segue opcional.
> Verificação por revisão estática (ambiente sem `node_modules`). Pendentes: N4, roteamento viário (G6),
> e a parte restante do N7 (popup/route-line + paleta).

---

## 0. STATUS DO RELATÓRIO ANTERIOR (2026-06-13)

| Item | Status atual | Evidência |
|---|---|---|
| **B1** — satélite derruba camadas de execução | ✅ **RESOLVIDO** | `LogisticsMap.tsx:27-31` agora chama `geoData.renderDataLayers` **e** `execLayers.renderAllExecLayers` no `onStyleLoad`; `useMapInstance.ts:22-23,41` usa `onStyleLoadRef`. **Porém o fix reintroduz N1 abaixo.** |
| **G1** — sem mapa no `RoteiroDetailPage` | ✅ **RESOLVIDO** | Nova aba **Mapa** em `RoteiroDetailPage` reutilizando `ItinerarioMap` (itinerário + clientes + terrenos). |
| **G2** — sem otimização de rota | ✅ **RESOLVIDO** | Botão **Otimizar rota** (vizinho-mais-próximo) no `ItinerarioModal` e na aba Mapa do detalhe; lógica em `lib/itinerary.ts` (`nearestNeighborOrder`). |
| **G3** — pontos sem coordenada somem silenciosamente | ✅ **RESOLVIDO** | Badge "**N de M sem localização**" no modal e na aba Mapa do detalhe (`countSemLocalizacao`). |
| **G6** — rota em linha reta | 🟡 **PARCIAL** | Agora exibe **distância total em linha reta** (`totalRouteKm`) no modal e detalhe. Roteamento por rede viária (OSRM/Valhalla) segue pendente. |
| **B2/B3/B4** — duplicação dos 3 setups MapLibre | 🟡 **PARCIAL** | `OSM_STYLE` unificado + `createBaseMap` (ver N7); helpers de popup/route-line e paleta ainda pendentes. |

---

## 1. BUGS NOVOS (não cobertos antes)

### N1. Acúmulo de listeners a cada troca de satélite/OSM → múltiplos popups (ALTO) — ✅ RESOLVIDO (`a10c50d`)

**Arquivos:** `components/logistics/hooks/useGeoDataLayers.ts` e `useExecucaoLayers.ts`

Todos os handlers de interação são registrados **dentro do bloco `else`** que só roda quando a *source* ainda
não existe:

- `useGeoDataLayers.ts`: `map.on('click', 'terrenos-fill', …)` (95), `'clientes-point'` (194),
  `'clientes-cluster'` (233), `'itinerary-circle'` (317), + `mouseenter`/`mouseleave` (140-151, 244-247, 349-350).
- `useExecucaoLayers.ts`: `'exec-points'` (59), `'interc-points'` (131), `'checklist-points'` (202), + hovers.

A troca de estilo usa `setStyle` (`useMapInstance.ts:49`), que **descarta todas as sources e layers**. No
`style.load` seguinte, `renderDataLayers`/`renderAllExecLayers` re-rodam; como `map.getSource(...)` agora retorna
`null`, o bloco `else` executa **de novo e re-registra os handlers**. Os listeners registrados via
`map.on(type, layerId, fn)` **não são removidos pelo `setStyle`** e **não há nenhum `map.off`** para eles (o único
`.off` do módulo está em `useViewport.ts:72-73`, para `moveend`/`zoomend`).

**Impacto:** após N trocas de satélite↔OSM desde a montagem, **um clique em qualquer ponto abre N popups
simultâneos**, e há vazamento contínuo de listeners e nós de DOM. Bug cumulativo e facilmente reproduzível.

**Correção sugerida:** registrar os handlers de clique/hover **uma única vez** (fora do `else`, com guarda
própria) ou chamar `map.off(type, layerId, fn)` antes de cada `map.on`; alternativamente, mover o registro para
o setup do mapa em `useMapInstance`.

---

### N2. Câmera reseta ao trocar satélite (MÉDIO) — ✅ RESOLVIDO (`a10c50d`)

**Arquivo:** `useGeoDataLayers.ts:259-271`

O "já enquadrou uma vez" é marcado adicionando uma **source fake `_fitted`** ao mapa. O `setStyle` apaga essa
source; no `style.load`, `renderDataLayers` re-roda, **não encontra `_fitted`** e chama `fitBounds` outra vez,
**descartando o pan/zoom atual do usuário** e voltando ao extent completo.

**Impacto:** toda troca de satélite "puxa" a câmera de volta para todos os clientes — perda de contexto de
navegação.

**Correção:** guardar o flag de "fitted" em `useRef` (sobrevive ao `setStyle`), não numa source do mapa.

---

### N3. Upload de GeoJSON sem limite de tamanho/complexidade (BAIXO) — ✅ RESOLVIDO (`a10c50d`)

**Arquivo:** `useLayerActions.ts:41-68`

`handleFileUpload` lê o arquivo inteiro, valida apenas que é um `FeatureCollection` e persiste o **GeoJSON cru
como uma linha** em `geo_layers` (`saveGeoLayer`). Não há limite de tamanho nem de nº de features, e nenhuma
simplificação no import (diferente dos terrenos, que usam `simplifyGeometry` em `map-layers.ts:56`).

**Impacto:** um GeoJSON grande congela a UI no `JSON.parse` + render síncrono e incha o SQLite.

**Correção:** limitar tamanho/feature-count, avisar via toast, e aplicar `simplifyGeometry` no import.

---

### N4. Fetch duplicado de roteiros e execuções (BAIXO) — ⏸️ ADIADO (precisa de cache compartilhado)

**Arquivos:** `useLogistics.ts:5-33,65+`, `page.tsx:28-29`, `useGeoDataLayers.ts:41`, `useExecucaoLayers.ts:21`

`useRoteiros`/`useExecucoes` usam `useState`+`useEffect` **sem cache compartilhado**. Na aba Mapa, a página já
chama `useRoteiros()` e `useExecucoes()`, e os hooks do mapa chamam **os mesmos hooks de novo** → cada query roda
**2× independentemente** ao abrir a aba.

**Correção:** elevar a busca ao componente pai e passar via props, ou introduzir cache (react-query/SWR) com
chave por filtro.

---

### N5. `hashTerrenos` fraco → terrenos atualizados podem não re-renderizar (BAIXO) — ✅ RESOLVIDO (`a10c50d`)

**Arquivo:** `useGeoDataLayers.ts:19-31`

O hash de cache usa apenas `t.id.charCodeAt(0)` (1º caractere do id) + `area_m2` + `ativo`. Conjuntos diferentes
de terrenos com mesmo tamanho/zoom e mesmos primeiros caracteres colidem → `terrenosGeoCache` não invalida e o
mapa mostra dados **defasados**.

**Correção:** hash mais robusto (id completo e/ou `atualizado_em`).

---

## 2. QUALIDADE / ARQUITETURA

### N6. `alert()` / `confirm()` nativos divergem do padrão do app (MÉDIO) — ✅ RESOLVIDO (`a10c50d`)

**Arquivo:** `useLayerActions.ts:54` (`alert`), `:85` e `:93` (`confirm`)

O resto do app usa `sonner` (`toast`) e `Dialog`/`AlertDialog`. Os diálogos nativos bloqueiam a thread e quebram
a consistência visual. Trocar por `toast.error(...)` + `AlertDialog` de confirmação.

### N7. Tripla duplicação de setup MapLibre persiste (ex-B2/B3) (MÉDIO) — 🟡 PARCIAL

**Feito:** `OSM_STYLE` agora é **único** em `lib/map-styles.ts` (3 → 1); os dois modais
(`ItinerarioMap`, `RoteiroMap`) deixaram de ter cópias inline e a criação do mapa+controles
(antes byte-a-byte idêntica) foi extraída para `createBaseMap` em `lib/map-base.ts`.
**Pendente (maior esforço / decisão visual):** helpers compartilhados de popup/route-line e
unificação da paleta de cores (itinerário/logística/agendamento ainda usam cores próprias).



A aba Mapa já centralizou estilos em `lib/map-styles.ts` (`OSM_STYLE`/`SATELLITE_STYLE`), mas
`ItinerarioMap.tsx:10` e `RoteiroMap.tsx:10` ainda **definem o próprio `OSM_STYLE` inline** e instanciam mapas
standalone (`ItinerarioMap.tsx:330`, `RoteiroMap.tsx:180`), com pipelines próprios de popup/route-line/fitBounds
e paletas divergentes. Extrair um `useBaseMap` + helpers de popup/linha compartilhados eliminaria ~3 cópias e
unificaria a linguagem visual.

### Minor — `escapeHtml` usado em path de URL

`useGeoDataLayers.ts:129`: `link.href = '/logistica/terreno/${escapeHtml(p.id)}'`. Para compor um segmento de
URL o correto é `encodeURIComponent`, não `escapeHtml`. Risco baixo (id controlado), mas semanticamente incorreto.

---

## 3. PRIORIDADE SUGERIDA

1. **N1** (acúmulo de listeners) — bug visível, regressão introduzida junto com o fix do B1; correção pequena.
2. **N2** (reset de câmera no satélite) — UX ruim, correção pequena (ref em vez de source).
3. **G1 + G4** (mapa no `RoteiroDetailPage`, reusando os hooks) — ainda o maior gap funcional.
4. **N6** (alert/confirm → toast/Dialog) — consistência de UX, baixo esforço.
5. **G3** (badge "X sem localização") — risco operacional.
6. **N4 / N5 / N3** — performance e robustez (fetch duplicado, hash, import).
7. **N7 / B4 / G2 / G6** — refactor de unificação + otimização de rota + roteamento (maior esforço).

---

## RESUMO

**B1 do relatório anterior foi corrigido**, mas o mesmo padrão de re-registro no `style.load` introduziu **N1
(acúmulo de listeners)**. Além disso, a auditoria aprofundada encontrou **7 itens novos** (N1–N7) — 1 alto, 3
médios, 3 baixos — concentrados no ciclo de vida do `setStyle` (satélite), no caching e na consistência de UX.
Os gaps funcionais G1–G3, G6 e a duplicação dos três setups MapLibre (B2–B4) continuam abertos.
