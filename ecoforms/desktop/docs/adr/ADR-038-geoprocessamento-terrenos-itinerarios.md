# ADR-038 — Geoprocessamento de Terrenos e Camadas Geográficas no Módulo de Logística

**Status:** Implementado  
**Data:** 2026-06-03  
**Autor:** Marcelo Luiz  
**Atualizado em:** 2026-06-03 (sincronizado com implementação real)

---

## Contexto

O módulo de Logística precisa exibir itinerários de coleta no mapa. Cada itinerário é composto por paradas sequenciadas — clientes cadastrados no módulo de Relacionamento. Surgem dois tipos distintos de entidade geográfica:

1. **Clientes (pontos de coleta)** — possuem endereço e coordenadas (lat/lng). Representados como pinos no mapa. A tabela `clientes` já armazena `latitude` e `longitude` com índice geo.

2. **Terrenos e prédios** — são polígonos do cadastro imobiliário municipal. Um terreno não pode ser representado apenas por lat/lng: sua geometria completa (polígono) é necessária para identificação visual no mapa e para futuros cálculos espaciais (área, sobreposição, contenção).

### Problema

A abordagem ingênua de copiar lat/lng de um terreno para o registro do cliente tem três falhas:

- Perde a geometria do polígono (só armazena o centróide)
- Duplica dados: se o cadastro do terreno atualiza, os clientes ficam desatualizados
- Dificulta consultas futuras como "quais clientes estão dentro desta zona"

Usar a tabela `geo_layers` (camadas importadas pelo usuário) como referência também é inadequado: `geo_layers` é uma entidade de apresentação genérica (qualquer arquivo GeoJSON importado), não um domínio cadastral controlado.

---

## Decisão

### 1. Tabela `terrenos` como domínio cadastral separado

Criar tabela `terrenos` independente de `clientes`, com FK opcional `clientes.terreno_id → terrenos.id` e `roteiro_clientes.terreno_id → terrenos.id`.

```sql
CREATE TABLE IF NOT EXISTS terrenos (
    id               TEXT PRIMARY KEY,
    nome             TEXT NOT NULL,
    codigo_cadastral TEXT,
    tipo             TEXT NOT NULL DEFAULT 'residencial'
                         CHECK(tipo IN ('residencial','comercial','industrial','publico','rural','outro')),
    geojson          TEXT NOT NULL,      -- geometria completa (Polygon/MultiPolygon)
    centroid_lat     REAL,
    centroid_lng     REAL,
    area_m2          REAL,
    bairro           TEXT,
    logradouro       TEXT,               -- endereço detalhado do terreno
    numero           TEXT,
    cidade           TEXT,
    estado           TEXT,
    observacoes      TEXT,
    ativo            INTEGER NOT NULL DEFAULT 1,
    criado_por       TEXT REFERENCES usuarios(id),
    criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_terrenos_codigo   ON terrenos(codigo_cadastral);
CREATE INDEX IF NOT EXISTS idx_terrenos_tipo     ON terrenos(tipo);
CREATE INDEX IF NOT EXISTS idx_terrenos_centroid ON terrenos(centroid_lat, centroid_lng);
CREATE INDEX IF NOT EXISTS idx_terrenos_ativo    ON terrenos(ativo);
```

**Notas sobre campos adicionais em relação à versão inicial do ADR:**
- `tipo` usa CHECK constraint com valores controlados (`residencial`, `comercial`, `industrial`, `publico`, `rural`, `outro`) e default `'residencial'` (era `'lote'` na versão inicial, atualizado para alinhar com o domínio)
- Campos de endereço (`logradouro`, `numero`, `cidade`, `estado`) permitem geocodificação reversa e exibição no popup do mapa
- `observacoes` permite anotações livres do cadastro municipal
- `atualizado_em` com trigger `DEFAULT (datetime('now'))` para rastrear alterações
- `criado_por` referencia `usuarios(id)`, garantindo rastreabilidade

### 2. GeoJSON armazenado como TEXT; centróide/área calculados em JS no import

**Não usamos SpatiaLite.** Os motivos:

- `mod_spatialite.dll/.so` precisa ser bundled no instalador Tauri — dependências externas (GEOS, PROJ) complicam a distribuição em Windows
- O único acesso espacial atual é visualização (MapLibre consome o TEXT diretamente) e queries por bounding box (centroid_lat/lng como REAL indexados)
- Cálculos de centróide e área são feitos em JS no momento do import (`computeCentroid`, `computeAreaM2` em `useMapData.ts`) e persistidos como floats — evita recomputação em toda query

**Quando reavaliar SpatiaLite:** se surgir necessidade de `ST_Contains` server-side em datasets > 50k features, ou se `turf.js` no frontend não for suficiente para as operações espaciais necessárias.

### 3. `geo_layers` para camadas genéricas importadas pelo usuário

Tabela separada para arquivos GeoJSON arbitrários (não domínio cadastral). Usado em `LogisticsMap` como overlay visual de camadas adicionais. Não possui FK para clientes ou roteiros.

```sql
CREATE TABLE IF NOT EXISTS geo_layers (
    id           TEXT PRIMARY KEY,
    nome         TEXT NOT NULL,
    tipo         TEXT NOT NULL DEFAULT 'geojson'
                     CHECK(tipo IN ('geojson','kml','gpx')),
    categoria    TEXT DEFAULT 'outro'
                     CHECK(categoria IN ('terreno','pontos_gps','infraestrutura','outro')),
    geojson      TEXT,
    storage_path TEXT,
    cor          TEXT NOT NULL DEFAULT '#3B82F6',
    visivel      INTEGER NOT NULL DEFAULT 1,
    criado_por   TEXT REFERENCES usuarios(id),
    criado_em    TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_geo_layers_visivel   ON geo_layers(visivel);
CREATE INDEX IF NOT EXISTS idx_geo_layers_categoria ON geo_layers(categoria);
```

**Notas sobre campos:** `tipo` suporta `geojson`, `kml`, `gpx` (extensibilidade futura). `categoria` classifica a origem da camada. `cor` permite customização visual por camada. `storage_path` reserva para armazenamento de arquivo original. `visivel` controla visibilidade no mapa sem precisar reimportar.

### 4. Componente `ItinerarioMap` com polígonos de terrenos das paradas

`ItinerarioMap` recebe `terrenosGeo: TerrenoGeo[]` e renderiza, **abaixo** das camadas de pontos, os polígonos dos terrenos vinculados às paradas do itinerário:

- Source `terrenos-route`: FeatureCollection filtrada pelos `terreno_id` das paradas
- Layer `terrenos-route-fill`: fill vermelho translúcido (opacity 0.12 padrão)
- Layer `terrenos-route-outline`: contorno vermelho (opacity 0.6, width 1.5)
- Ao selecionar um cliente: `setPaintProperty` eleva a opacidade do polígono correspondente (fill 0.35, outline 1.0) e reduz os demais (fill 0.08, outline 0.35)

Clientes sem `terreno_id` continuam exibindo apenas ponto — comportamento de fallback natural.

### 5. Hierarquia de camadas no mapa

**Notas sobre KML/GPX:** O CHECK constraint em `geo_layers.tipo` permite `'kml'` e `'gpx'`, mas não há parser implementado. Atualmente a UI orienta conversão via mapshaper.org. Implementação futura quando houver demanda.

**Nota sobre `storage_path`:** Coluna reservada para armazenamento em disco de GeoJSONs grandes (> 5 MB). Atualmente todo o dado vai na coluna `geojson` como TEXT.

#### ItinerarioMap (modal do itinerário)

```
[OSM tiles]                ← base
[terrenos-route-fill]       ← polígonos dos terrenos das paradas
[terrenos-route-outline]    ← contorno dos terrenos
[clients-in-route-glow]     ← halo dos pontos no roteiro
[clients-circle]             ← pontos de clientes (destaques e disponíveis)
[route-line]                 ← linha de rota (vermelho)
[route-casing]               ← casing branco da rota (atrás de route-line)
[stops-ordem-halo]           ← halo branco da numeração
[stops-ordem-text]            ← numeração de ordem (vermelho)
```

ItinerarioMap **não** renderiza `geo_layers` — trata-se de uma visualização focada no roteiro.

#### LogisticsMap (mapa principal da logística)

```
[OSM tiles / satellite]     ← base (alternância OSM ↔ satélite)
[terrenos-fill]              ← polígonos do cadastro de terrenos
[terrenos-outline]           ← contorno dos terrenos
[clientes-cluster]           ← clusters de clientes quando zoom out
[clientes-cluster-count]     ← contagem nos clusters
[clientes-point]             ← pontos individuais de clientes
[geo_layers (dynamic)]       ← overlays genéricos importados (fill/line/circle)
[itinerary route + stops]   ← linha de rota e paradas numeradas do roteiro selecionado
[ecopontos + execução]       ← camadas de ADR-039 (execução, intercorrências, checklist)
```

LogisticsMap renderiza `terrenos` (cadastro completo) e `geo_layers`, enquanto ItinerarioMap renderiza apenas `terrenos-route` (filtrado pelas paradas).

### 6. Importação de terrenos (`TerrenoImport.tsx`)

Componente dedicado para importação de cadastros municipais via arquivo GeoJSON:

- Valida tipo `FeatureCollection`, presença de features, e limite de 200.000 features
- Extrai propriedades heuristicamente (`nome`, `codigo_cadastral`, `tipo`, `bairro`, `logradouro`, etc.) com fallback para nomes comuns de cadastros municipais brasileiros
- Normaliza `tipo` via `normalizeTipo()` para os 6 valores do CHECK constraint
- Computa centróide e área via `computeCentroid()` e `computeAreaM2()` (fórmula de Shoelace convertida para m²)
- Usa `INSERT OR IGNORE` com fallback individual para duplicatas
- Gera IDs estáveis: `terreno-{codigo_cadastral}` quando disponível, `terreno-{timestamp}-{idx}` como fallback

---

## Alternativas consideradas

### SpatiaLite como extensão SQLite
**Adiada.** Custo de distribuição alto (`.dll` + GEOS + PROJ no instalador). Sem caso de uso atual que justifique. Reavaliada quando `ST_Contains` ou distâncias server-side forem necessárias.

### turf.js para operações espaciais client-side
**Disponível como alternativa imediata ao SpatiaLite.** Para containment, buffer, distância — sem mudança de schema. A adotar antes de SpatiaLite se o caso de uso aparecer.

### Armazenar centróide/área apenas no GeoJSON
**Rejeitada.** Exige parse do JSON para toda query de listagem/busca. Columns `centroid_lat/lng` como REAL com índice são a forma correta para queries SQL.

---

## Consequências

### Positivas
- Schema simples: sem extensões nativas, funciona em qualquer SQLite padrão (desktop e mobile)
- MapLibre consome o TEXT diretamente — sem serialização/deserialização extra no pipeline de render
- Relação `cliente → terreno` é explícita e navegável via FK
- `ItinerarioMap` mostra ponto + polígono quando disponível, só ponto como fallback
- CHECK constraints em `tipo` e `categoria` garantem integridade dos dados no banco
- Campos de endereço detalhado permitem geocodificação reversa sem hit externo

### Negativas / Trade-offs
- Sem `ST_Contains` server-side: queries "cliente dentro de terreno" precisam ser feitas em JS (turf.js) ou exigirão SpatiaLite no futuro
- GeoJSON como TEXT: não há validação de geometria no banco — validação ocorre no import (`TerrenoImport.tsx`)
- Limite de import: 200.000 features por arquivo (restrição de UX, não técnica)
- `computeAreaM2` usa Shoelace em graus convertidos para m²— aproximação aceitável para lotes urbanos, mas perde precisão em polígonos muito grandes ou em altas latitudes