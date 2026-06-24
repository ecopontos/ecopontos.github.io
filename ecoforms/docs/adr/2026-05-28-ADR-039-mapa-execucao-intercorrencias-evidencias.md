# ADR-039: Mapa de Logística — Execução, Intercorrências e Evidências Geo

**Data:** 2026-05-28
**Status:**Implementado** (2026-06-09)
**Autores:** Equipe EcoForms

---

## Contexto

O mapa de Logística (`LogisticsMap`) hoje exibe 4 camadas: terrenos (polígonos cadastrais), clientes (pontos PF/PJ com clustering), geo layers genéricas e itinerário planejado (linha + paradas numeradas por `roteiro_clientes.ordem`).

Três tabelas do domínio possuem coordenadas geográficas que não são exibidas:

| Tabela | Dados geo | Significado |
|---|---|---|
| `execucao_clientes` | `latitude`, `longitude`, `coleta_realizada` | Confirmação de coleta em campo (GPS do motorista) |
| `intercorrencias_coleta` | `latitude`, `longitude`, `descricao`, `resolvido` | Localização de ocorrências registradas durante a coleta |
| `checklist_execucao` | `latitude`, `longitude`, `evidencia_url`, `concluido` | Fotos e verificações georreferenciadas |

Sem essas camadas, o mapa mostra apenas o estado "planejado" (cadastral + itinerário), mas não o estado "executado" (o que realmente aconteceu em campo). A chefia e a operação não conseguem visualizar discrepâncias entre o planejado e o realizado.

---

## Decisão

**Adicionar 3 camadas interativas ao mapa de logística, vinculadas ao seletor de execução, no modelo de camadas opt-in (visíveis apenas quando uma execução está selecionada).**

Cada camada é independente, com toggle de visibilidade, e herda o `execucaoId` do seletor global do mapa.

---

## Camadas

### Camada 1: Execução (Coletas Realizadas)

**Fonte:** `execucao_clientes` JOIN `clientes` WHERE `execucao_id = ?`

| Propriedade | Valor |
|---|---|
| Geometria | Point (`latitude`, `longitude`) |
| Cor | Verde (`coleta_realizada = 1`), Vermelho/Cinza (`coleta_realizada = 0`) |
| Ícone | `circle` com stroke branco, raio 6px |
| Popup | Nome do cliente, status (Coletado / Não coletado), horário da visita |
| Comparação | Sobreposição visual com itinerário planejado (linha laranja existente) |

**Query:**
```sql
SELECT ec.*, c.nome AS cliente_nome, c.endereco
FROM execucao_clientes ec
JOIN clientes c ON ec.cliente_id = c.id
WHERE ec.execucao_id = ?
  AND ec.latitude IS NOT NULL
```

### Camada 2: Intercorrências

**Fonte:** `intercorrencias_coleta` JOIN `tipos_intercorrencia` WHERE `execucao_id = ?`

| Propriedade | Valor |
|---|---|
| Geometria | Point (`latitude`, `longitude`) |
| Cor | Por tipo de ocorrência (`tipos_intercorrencia.cor`) |
| Ícone | `AlertTriangle` customizado (SVG symbol) |
| Popup | Tipo da ocorrência, descrição, status (Resolvido / Pendente), data/hora |
| Fallback | Se `latitude` for NULL, usar `endereco` para geocodificação reversa |

**Query:**
```sql
SELECT ic.*, ti.nome AS tipo_nome, ti.cor AS tipo_cor, ti.icone
FROM intercorrencias_coleta ic
JOIN tipos_intercorrencia ti ON ic.tipo_ocorrencia_id = ti.id
WHERE ic.execucao_id = ?
  AND ic.latitude IS NOT NULL
```

### Camada 3: Evidências do Checklist

**Fonte:** `checklist_execucao` WHERE `execucao_id = ?`

| Propriedade | Valor |
|---|---|
| Geometria | Point (`latitude`, `longitude`) |
| Cor | Azul (#3B82F6) — cor de "evidência/verificação" |
| Ícone | `Camera` ou `CheckCircle` |
| Popup | Nome do item, foto (thumbnail de `evidencia_url`), status (concluído/pendente) |

**Query:**
```sql
SELECT *
FROM checklist_execucao
WHERE execucao_id = ?
  AND latitude IS NOT NULL
```

---

## Interface do Usuário

### Seletor de Execução

Adicionar `<Select>` no topo do mapa com lista de execuções do roteiro selecionado (ou de todos os roteiros ativos):

```
[Roteiro: Todos ▼] [Execução: 27/05/2026 - concluída ▼] [☑ Execução] [☑ Intercorrências] [☑ Evidências]
```

- Selecionar uma execução ativa as 3 camadas com os dados correspondentes
- Toggles individuais permitem desligar camadas sobrepostas
- "Todos" no seletor de roteiro mostra execuções de qualquer roteiro
- Limpar seleção remove as 3 camadas do mapa

### Fit Bounds

Ao selecionar uma execução, o mapa faz fit bounds nos pontos da camada de execução (não no itinerário planejado inteiro), focando na área onde a coleta realmente ocorreu.

---

## Dependências com ADRs Anteriores

| ADR | Dependência |
|---|---|
| ADR-038 | Usa `terrenos.centroid_lat/lng` como fallback quando `execucao_clientes.latitude` é NULL |
| ADR-029 | As camadas compartilham o container e o pattern de hooks do módulo de logística |

---

## Não-Escopo (futuro)

- **Heatmap de intercorrências** — agregação de múltiplas execuções para identificar "zonas quentes" de problema. Requer agregação espacial (grid ou kernel density) que demanda pós-processamento ou backend.
- **Roteamento entre paradas** — traçar a rota real percorrida pelo veículo (linha conectando os pontos de GPS em ordem cronológica). Requer coluna `timestamp` por parada para ordenação temporal.
- **Geocodificação de endereços** — transformar `clientes.endereco` em lat/lng via API externa (Nominatim/Google). Escopo de feature separada com custo de API e cache.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Muitas camadas sobrepostas dificultam leitura | Toggles individuais + opacidade ajustável |
| `execucao_clientes` sem coordenadas (GPS não capturado) | Fallback para centroid do terreno vinculado ao cliente (ADR-038) |
| Performance com muitas execuções | Limitar query a 1 execução por vez; cluster não se aplica (pontos por execução < 100) |

---

## Alternativas Consideradas

1. **Mapa separado para cada camada** — rejeitado: o valor está na sobreposição (planejado vs executado no mesmo viewport).
2. **Todas as camadas sempre visíveis** — rejeitado: poluição visual. O mapa já tem 4 camadas base; adicionar mais 3 sem filtro tornaria o mapa ilegível.
3. **Usar `geo_layers` para armazenar os dados** — rejeitado: `geo_layers` é genérico e não tem semântica de domínio (execução, intercorrência). As tabelas de domínio já existem com schema adequado.

---

## Implementação (2026-06-09)

| Artefato | Arquivo |
|----------|---------|
| Hooks `useExecucaoGeo`, `useIntercorrenciasGeo`, `useChecklistGeo` com queries JOIN | `desktop/src/interface/hooks/queries/useMapData.ts` |
| `renderExecucaoLayer` — círculos verde/vermelho por `coleta_realizada` + popup | `desktop/components/logistics/LogisticsMap.tsx` |
| `renderIntercorrenciasLayer` — círculos com cor de `tipos_intercorrencia.cor` + popup | `desktop/components/logistics/LogisticsMap.tsx` |
| `renderChecklistLayer` — círculos azul/cinza + popup com thumbnail de `evidencia_url` | `desktop/components/logistics/LogisticsMap.tsx` |
| Toggles individuais de visibilidade para cada camada | `desktop/components/logistics/LogisticsMap.tsx` |
| Fit bounds nos pontos de execução ao selecionar execução | `desktop/components/logistics/LogisticsMap.tsx` |
| Clear de `selectedExecucaoId` ao trocar roteiro | `desktop/components/logistics/LogisticsMap.tsx` |
| Seletor de execução filtrado por `selectedRoteiroId` (fix 2026-06-09) | `desktop/components/logistics/LogisticsMap.tsx:888` |
