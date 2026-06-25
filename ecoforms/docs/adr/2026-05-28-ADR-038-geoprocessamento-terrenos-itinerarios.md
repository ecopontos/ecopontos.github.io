# ADR-038: Geoprocessamento de Terrenos e Itinerários de Logística

**Data:** 2026-05-28  
**Status:**Implementado** (2026-06-09)
**Autores:** Equipe EcoForms

---

## Contexto

O módulo de Logística precisa exibir itinerários de coleta no mapa. Cada itinerário é composto por paradas sequenciadas — que são clientes cadastrados no módulo de Relacionamento. Surgem dois tipos distintos de entidade geográfica:

1. **Clientes (pontos de coleta)** — possuem endereço e coordenadas (lat/lng). Representados como pinos no mapa. A tabela `clientes` já armazena `latitude` e `longitude` com índice geo.

2. **Terrenos e prédios** — são polígonos do cadastro imobiliário municipal. Um terreno não pode ser representado apenas por lat/lng: sua geometria completa (polígono) é necessária para identificação visual no mapa e para futuros cálculos espaciais (área, sobreposição, contenção).

### Problema

A abordagem ingênua de copiar lat/lng de um terreno para o registro do cliente tem três falhas:

- Perde a geometria do polígono (só armazena o centroide)
- Duplica dados: se o cadastro do terreno atualiza, os clientes ficam desatualizados
- Dificulta consultas futuras como "quais clientes estão dentro desta zona"

Usar a tabela `geo_layers` (camadas importadas pelo usuário) como referência também é inadequado: `geo_layers` é uma entidade de apresentação genérica (qualquer arquivo GeoJSON importado), não um domínio cadastral com atributos próprios.

---

## Decisão

**Criar a tabela de domínio `terrenos` para representar lotes e prédios do cadastro imobiliário. Clientes e paradas de roteiro referenciam opcionalmente um terreno pelo seu ID.**

Isso separa:
- **`geo_layers`** — camadas visuais genéricas importadas pelo operador (nuvens de pontos GPS, sobreposições de análise, etc.)
- **`terrenos`** — entidades cadastrais permanentes com geometria, código e atributos próprios

---

## Schema

### Tabela `terrenos`

```sql
CREATE TABLE IF NOT EXISTS terrenos (
    id                TEXT PRIMARY KEY,
    nome              TEXT NOT NULL,
    codigo_cadastral  TEXT,                    -- código do cadastro municipal (IPTU, etc.)
    tipo              TEXT NOT NULL DEFAULT 'residencial'
                          CHECK(tipo IN ('residencial','comercial','industrial','publico','rural','outro')),
    geojson           TEXT NOT NULL,           -- geometria completa (GeoJSON Polygon/MultiPolygon)
    centroid_lat      REAL,                    -- calculado no import, usado como pin no mapa
    centroid_lng      REAL,
    area_m2           REAL,                    -- calculado a partir do polígono
    bairro            TEXT,
    logradouro        TEXT,
    numero            TEXT,
    cidade            TEXT,
    estado            TEXT,
    observacoes       TEXT,
    ativo             INTEGER NOT NULL DEFAULT 1,
    criado_por        TEXT REFERENCES usuarios(id),
    criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_terrenos_codigo   ON terrenos(codigo_cadastral);
CREATE INDEX IF NOT EXISTS idx_terrenos_tipo     ON terrenos(tipo);
CREATE INDEX IF NOT EXISTS idx_terrenos_centroid ON terrenos(centroid_lat, centroid_lng);
CREATE INDEX IF NOT EXISTS idx_terrenos_ativo    ON terrenos(ativo);
```

### Alterações em tabelas existentes

```sql
-- Clientes podem referenciar o terreno onde estão localizados
ALTER TABLE clientes ADD COLUMN terreno_id TEXT REFERENCES terrenos(id);

-- Paradas de roteiro também podem referenciar terreno diretamente
-- (útil quando a parada é um prédio industrial sem cliente cadastrado)
ALTER TABLE roteiro_clientes ADD COLUMN terreno_id TEXT REFERENCES terrenos(id);
```

### Regra de resolução de coordenadas no mapa

Para exibir um ponto de coleta no mapa, o sistema usa a seguinte precedência:

```
1. cliente.terreno_id → terrenos.centroid_lat/lng  (polígono do cadastro)
2. cliente.latitude / cliente.longitude             (lat/lng manual)
3. Geocodificação do endereço (futuro)
```

Quando `terreno_id` está preenchido, o mapa exibe adicionalmente o **polígono do terreno** em torno do pin.

---

## Importação de terrenos

O operador importa o cadastro imobiliário da prefeitura em formato GeoJSON. Cada `Feature` do arquivo se torna um registro em `terrenos`. O sistema:

1. Lê cada `Feature` do `FeatureCollection`
2. Extrai atributos do `properties` (nome, código cadastral, tipo, bairro, etc.)
3. Calcula o centroide do polígono — fórmula do centroide geométrico de polígono simples
4. Calcula a área em m² — fórmula de Shoelace (coordenadas geográficas aproximadas)
5. Insere via `INSERT OR IGNORE` (idempotente, permite re-importar sem duplicar)

A importação é feita na aba Mapa da Logística, seção "Importar Cadastro de Terrenos", separada da importação genérica de `geo_layers`.

---

## Renderização no mapa

```
Camada "terrenos-fill"    → fill semi-transparente do polígono (MapLibre, tipo fill)
Camada "terrenos-outline" → borda do polígono (MapLibre, tipo line)
Camada "clientes-point"   → pin do cliente, posicionado no centroide do terreno
                            ou nas coordenadas diretas se sem terreno_id
```

Ao clicar no pin de um cliente, o popup mostra nome, tipo, código cadastral do terreno vinculado.

---

## Itinerário de roteiro no mapa

Com `roteiro_clientes` sequenciado por `ordem`, o itinerário é exibido como:

- **Pinos numerados** em cada parada (clientes do roteiro, na ordem)
- **Linha de rota** conectando as paradas em sequência
- **Polígonos** dos terrenos associados às paradas

A linha de rota é calculada no frontend (MapLibre GL `LineString` construído a partir das coordenadas das paradas na ordem).

---

## Consequências

**Positivas:**
- Geometria completa do terreno preservada — possibilita análises espaciais futuras (área, sobreposição)
- Referência por ID elimina duplicação de coordenadas — atualização do cadastro reflete automaticamente
- Cadastro de cliente simplificado: operador seleciona o terreno por nome/código, sem digitar lat/lng manualmente
- Separação clara entre camadas visuais genéricas (`geo_layers`) e entidades cadastrais (`terrenos`)

**Negativas / trade-offs:**
- Requer UI de busca de terreno no formulário de cliente (campo autocomplete por nome/código)
- Cálculo de centroide e área no frontend é aproximado para coordenadas geográficas (erro < 0,1% para terrenos urbanos — aceitável)
- Sem SpatiaLite, queries espaciais avançadas (ex: "clientes dentro de um bairro") requerem filtro por centroide ou processamento JS com turf.js

**Fora do escopo deste ADR:**
- Sincronização do cadastro de terrenos com sistema externo da prefeitura (futuro ADR)
- Cálculo de rota otimizada entre paradas (futuro ADR)
- SpatiaLite para queries SQL espaciais nativas

---

## Implementação (2026-06-09)

Todos os itens do ADR foram implementados:

| Artefato | Arquivo |
|----------|---------|
| Schema `terrenos` + índices + FK em `clientes`/`roteiro_clientes` | `desktop/scripts/ensure-columns.ts` |
| Import GeoJSON com centroide + área + batch INSERT OR IGNORE | `desktop/components/logistics/TerrenoImport.tsx` |
| Camadas `terrenos-fill`/`terrenos-outline` no mapa geral + toggle + soft-delete | `desktop/components/logistics/LogisticsMap.tsx` |
| Polígonos `terrenos-route-fill/outline` no itinerário | `desktop/components/logistics/ItinerarioMap.tsx` |
| Resolução de coordenadas por precedência (`COALESCE(t.centroid_lat, c.latitude)`) | `desktop/src/interface/hooks/queries/useMapData.ts` |
| Campo de seleção de terreno no formulário de novo cliente | `desktop/app/clientes/novo/page.tsx` |
| Campo de seleção de terreno no detalhe/edição de cliente | `desktop/app/clientes/[id]/ClienteDetailPage.tsx` |
| `terreno_id` no tipo `Cliente` e no repositório SQLite | `desktop/types/clientes.ts`, `SqliteClienteRepository.ts` |
