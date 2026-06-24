# ADR-073: Performance de Renderiza├º├úo Geoespacial


> **Renumerado** de ADR-040 para ADR-073 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:**Implementado (parcial)** (Fase 1 conclu├¡da; Fase 2 proposta; Fase 3 explorat├│ria/condicional)
**Autor:** Marcelo Luiz  
**Data:** 2026-06-12  
**Atualizado em:** 2026-06-12 (Fase 1 sincronizada com implementa├º├úo real)  
**Contexto:** Importa├º├úo de terrenos com 100k+ fei├º├Áes causa lentid├úo na UI e alto consumo de mem├│ria.

## Decis├úo

Implementar 3 fases de otimiza├º├úo, cada uma independente e com ganho imediato:

1. **Geometry Simplification** ÔÇö Douglas-Peucker client-side (Ô£à implementado)
2. **Viewport-based Loading** ÔÇö bbox/R-Tree queries no SQLite (proposto)
3. **Vector Tiles** ÔÇö Server-side MVT para 200k+ features (explorat├│rio ÔÇö condicionado ├ás m├®tricas reais das Fases 1 e 2)

As tabelas de "M├®tricas de Espera" abaixo s├úo **proje├º├Áes**, n├úo medi├º├Áes. Antes de avan├ºar para a Fase 3, medir contagem real de terrenos e tempo de render com Fases 1+2 em produ├º├úo.

## Fase 1: Geometry Simplification Ô£à IMPLEMENTADO

### Problema
Pol├¡gonos com milhares de v├®rtices s├úo renderizados em zoom distante, desperdi├ºando GPU. Um terreno municipal t├¡pico tem 500-2000 v├®rtices, mas em zoom 12 apenas 10-20 seriam vis├¡veis.

### Solu├º├úo
Algoritmo Douglas-Peucker para simplificar geometrias baseado no zoom level.

### Status
Implementado em `lib/geo/simplify.ts`, `components/logistics/map-layers.ts` e `components/logistics/hooks/useGeoDataLayers.ts`. O c├│digo abaixo reflete a implementa├º├úo real (corrige dois problemas da spec original: typo em `getTolerance` e an├®is degenerados ap├│s simplifica├º├úo).

### Especifica├º├úo T├®cnica

#### Novo arquivo: `lib/geo/simplify.ts`

```typescript
/**
 * Douglas-Peucker simplification para GeoJSON.
 * Preserva topologia b├ísica (n├úo quebra pol├¡gonos).
 */

// Toler├óncia em graus (aproximada)
// zoom 12: ~10m ÔåÆ 0.0001┬░
// zoom 10: ~100m ÔåÆ 0.001┬░
// zoom 8: ~1km ÔåÆ 0.01┬░
const ZOOM_TOLERANCE: Record<number, number> = {
    16: 0.00001,  // ~1m
    15: 0.00002,  // ~2m
    14: 0.00005,  // ~5m
    13: 0.0001,   // ~10m
    12: 0.0002,   // ~20m
    11: 0.0005,   // ~50m
    10: 0.001,    // ~100m
    9:  0.002,    // ~200m
    8:  0.005,    // ~500m
    7:  0.01,     // ~1km
};

export function getTolerance(zoom: number): number {
    const z = Math.max(7, Math.min(16, Math.round(zoom)));
    return ZOOM_TOLERANCE[z];
}

function simplifyRing(ring: number[][], tolerance: number): number[][] {
    if (ring.length <= 3) return ring;
    
    // Encontrar ponto mais longe da linha entre primeiro e ├║ltimo
    let maxDist = 0;
    let maxIdx = 0;
    const first = ring[0];
    const last = ring[ring.length - 1];
    
    for (let i = 1; i < ring.length - 1; i++) {
        const dist = pointToLineDistance(ring[i], first, last);
        if (dist > maxDist) {
            maxDist = dist;
            maxIdx = i;
        }
    }
    
    // Se m├íxima dist├óncia > toler├óncia, dividir e recursar
    if (maxDist > tolerance) {
        const left = ring.slice(0, maxIdx + 1);
        const right = ring.slice(maxIdx);
        const simplifiedLeft = simplifyRing(left, tolerance);
        const simplifiedRight = simplifyRing(right, tolerance);
        return [...simplifiedLeft.slice(0, -1), ...simplifiedRight];
    }
    
    // Sen├úo, retornar apenas primeiro e ├║ltimo
    return [first, last];
}

function pointToLineDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
    const [px, py] = point;
    const [ax, ay] = lineStart;
    const [bx, by] = lineEnd;
    
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    
    return Math.hypot(px - projX, py - projY);
}

function ensureRingClosed(ring: number[][]): number[][] {
    if (ring.length < 3) return ring;
    const [first] = ring;
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        return [...ring, [...first]];
    }
    return ring;
}

export function simplifyPolygon(coords: number[][][], tolerance: number): number[][][] {
    return coords
        .map(ring => ensureRingClosed(simplifyRing(ring, tolerance)))
        .filter(ring => ring.length >= 4); // m├¡nimo 4 pontos para anel fechado v├ílido
}

export function simplifyMultiPolygon(coords: number[][][][], tolerance: number): number[][][][] {
    return coords
        .map(polygon => simplifyPolygon(polygon, tolerance))
        .filter(polygon => polygon.length > 0);
}

export function simplifyGeometry(geom: GeoJSON.Geometry, tolerance: number): GeoJSON.Geometry {
    if (geom.type === 'Polygon') {
        return { ...geom, coordinates: simplifyPolygon(geom.coordinates, tolerance) };
    }
    if (geom.type === 'MultiPolygon') {
        return { ...geom, coordinates: simplifyMultiPolygon(geom.coordinates, tolerance) };
    }
    return geom;
}

// Contar v├®rtices total
export function countVertices(geom: GeoJSON.Geometry): number {
    if (geom.type === 'Polygon') {
        return geom.coordinates.reduce((sum, ring) => sum + ring.length, 0);
    }
    if (geom.type === 'MultiPolygon') {
        return geom.coordinates.reduce((sum, polygon) => 
            sum + polygon.reduce((s, ring) => s + ring.length, 0), 0);
    }
    return 0;
}
```

#### Integra├º├úo em `map-layers.ts`

```typescript
import { simplifyGeometry, countVertices, getTolerance } from '@/lib/geo/simplify';

export function buildTerrenosGeojson(terrenos: TerrenoGeo[], zoom: number = 12): FeatureCollection {
    const tolerance = getTolerance(zoom);

    return {
        type: 'FeatureCollection',
        features: terrenos.filter(t => t.geojson).map(t => {
            let geom;
            try { geom = JSON.parse(t.geojson); } catch { return null; }

            // Simplificar geometrias complexas
            const vertices = countVertices(geom);
            if (vertices > 100) {
                geom = simplifyGeometry(geom, tolerance);
            }

            return {
                type: 'Feature' as const,
                geometry: geom,
                properties: { id: t.id, nome: t.nome, codigo: t.codigo_cadastral, tipo: t.tipo, area: t.area_m2, bairro: t.bairro },
            };
        }).filter(Boolean) as FeatureCollection['features'],
    };
}
```

#### Atualiza├º├úo em `useGeoDataLayers.ts`

```typescript
// Estado de zoom + ref para uso em closures de style.load
const [currentZoom, setCurrentZoom] = useState(12);
const currentZoomRef = useRef(currentZoom); currentZoomRef.current = currentZoom;

// Cache de terrenosGeo (evita rebuild a cada render)
const terrenosGeoCache = useRef<{ hash: string; data: FeatureCollection }>(
    { hash: '', data: { type: 'FeatureCollection', features: [] } }
);

// Em renderDataLayers, incluir zoom no hash do cache e na simplifica├º├úo
const hash = hashTerrenos(terrenosRef.current, currentZoomRef.current);
if (hash !== terrenosGeoCache.current.hash) {
    terrenosGeoCache.current = {
        hash,
        data: buildTerrenosGeojson(terrenosRef.current, currentZoomRef.current),
    };
}

// Listener de zoom ÔÇö registrado uma ├║nica vez, sem depend├¬ncia de currentZoom
// (usa o ref para comparar, evitando reattach do listener a cada mudan├ºa de zoom)
useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onZoomEnd = () => {
        const z = Math.round(map.getZoom());
        if (z !== currentZoomRef.current) {
            setCurrentZoom(z);
        }
    };

    map.on('zoomend', onZoomEnd);
    return () => { map.off('zoomend', onZoomEnd); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

### M├®tricas de Espera (proje├º├úo ÔÇö a validar)

| Features | V├®rtices (original) | V├®rtices (zoom 10) | Redu├º├úo |
|----------|---------------------|--------------------|---------|
| 10.000 | 5.000.000 | 500.000 | 90% |
| 50.000 | 25.000.000 | 2.500.000 | 90% |
| 100.000 | 50.000.000 | 5.000.000 | 90% |

**Pr├│ximo passo**: instrumentar contagem real de terrenos e tempo de render (antes/depois) para confirmar esta proje├º├úo e ter uma baseline para avaliar o ganho das Fases 2 e 3.

---

## Fase 2: Viewport-based Loading

### Problema
Todos os 100k terrenos s├úo carregados do SQLite e enviados ao MapLibre, mesmo quando apenas 100 est├úo vis├¡veis no viewport.

### Solu├º├úo
Queries espaciais com bbox + cache de geometrias por terreno.

### Especifica├º├úo T├®cnica

#### 0. Pr├®-requisito: SQLite compilado com m├│dulo R-Tree

Um ├¡ndice B-tree composto em `(bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat)` s├│ otimiza a primeira coluna da condi├º├úo ÔÇö as outras 3 compara├º├Áes de range exigem scan. Para filtro espacial eficiente em 100k+ linhas, usar o m├│dulo **R-Tree** nativo do SQLite (`SQLITE_ENABLE_RTREE`).

Verificar se a build do `rusqlite` (feature `bundled` em `src-tauri/Cargo.toml`) est├í compilada com a feature `rtree` habilitada. Se n├úo estiver, habilitar antes de prosseguir ÔÇö ├® pr├®-requisito bloqueante desta fase.

#### 1. Colunas bbox + tabela virtual R-Tree (nova migration em `ensure-columns.ts`)

```sql
-- Colunas bbox em terrenos (para consulta/debug e fallback)
ALTER TABLE terrenos ADD COLUMN bbox_min_lng REAL;
ALTER TABLE terrenos ADD COLUMN bbox_min_lat REAL;
ALTER TABLE terrenos ADD COLUMN bbox_max_lng REAL;
ALTER TABLE terrenos ADD COLUMN bbox_max_lat REAL;

-- Tabela virtual R-Tree para consulta espacial eficiente
CREATE VIRTUAL TABLE IF NOT EXISTS terrenos_rtree USING rtree(
    id,              -- rowid, referencia terrenos.rowid (n├úo terrenos.id TEXT)
    min_lng, max_lng,
    min_lat, max_lat
);
```

#### 2. Backfill ÔÇö preencher bbox e popular o R-Tree

Passo de migra├º├úo de dados (n├úo apenas DDL): para cada terreno existente, calcular o bbox a partir do `geojson` (reaproveitando `extractBbox`, ver item seguinte) e popular `bbox_*` + `terrenos_rtree`. Este backfill deve correr uma ├║nica vez em `ensure-columns.ts`, condicionado a `bbox_min_lng IS NULL`, para n├úo reprocessar terrenos j├í migrados.

#### 3. Fun├º├úo para extrair bbox do GeoJSON

```typescript
// lib/geo/bbox.ts
export function extractBbox(geojson: string): [number, number, number, number] | null {
    try {
        const geom = JSON.parse(geojson);
        let minLng = Infinity, minLat = Infinity;
        let maxLng = -Infinity, maxLat = -Infinity;
        
        const processCoord = (coord: number[]) => {
            if (coord[0] < minLng) minLng = coord[0];
            if (coord[1] < minLat) minLat = coord[1];
            if (coord[0] > maxLng) maxLng = coord[0];
            if (coord[1] > maxLat) maxLat = coord[1];
        };
        
        const processRing = (ring: number[][]) => ring.forEach(processCoord);
        
        if (geom.type === 'Polygon') {
            geom.coordinates.forEach(processRing);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => poly.forEach(processRing));
        }
        
        return [minLng, minLat, maxLng, maxLat];
    } catch {
        return null;
    }
}
```

#### 4. Atualizar `saveTerrenosBatch` para incluir bbox + R-Tree

```typescript
// Em useMapData.ts, adicionar bbox ao INSERT e popular terrenos_rtree
const bbox = extractBbox(t.geojson);
const numBbox = (v: number | null) => v == null ? 'NULL' : String(v);

sqls.push(
    `INSERT OR IGNORE INTO terrenos ` +
    `(id, nome, codigo_cadastral, tipo, geojson, centroid_lat, centroid_lng, area_m2, bairro,
      bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat) ` +
    `VALUES (..., ${numBbox(bbox?.[0])}, ${numBbox(bbox?.[1])}, ${numBbox(bbox?.[2])}, ${numBbox(bbox?.[3])})`
);
// Ap├│s o INSERT em terrenos, popular a tabela virtual rtree usando o rowid rec├®m-criado:
// INSERT OR REPLACE INTO terrenos_rtree (id, min_lng, max_lng, min_lat, max_lat)
//   SELECT rowid, bbox_min_lng, bbox_max_lng, bbox_min_lat, bbox_max_lat FROM terrenos WHERE id = ?
```

#### 5. Query viewport-aware (via R-Tree)

```typescript
// Nova query em useMapData.ts
export function useTerrenosInViewport(
    bbox: [number, number, number, number] | null,
    zoom: number
) {
    const [data, setData] = useState<TerrenoGeo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!bbox) { setLoading(false); return; }

        setLoading(true);
        const [minLng, minLat, maxLng, maxLat] = bbox;

        // Em zoom baixo, usar centroid para filtrar (poucos pontos, sem custo de join)
        // Em zoom alto, usar o R-Tree para interse├º├úo de bbox (filtro espacial real)
        const useBbox = zoom >= 12;

        const sql = useBbox
            ? `SELECT t.id, t.nome, t.codigo_cadastral, t.tipo, t.geojson,
                      t.centroid_lat, t.centroid_lng, t.area_m2, t.bairro, t.ativo
               FROM terrenos t
               JOIN terrenos_rtree r ON r.id = t.rowid
               WHERE t.ativo = 1
                 AND r.max_lng >= ? AND r.min_lng <= ?
                 AND r.max_lat >= ? AND r.min_lat <= ?
               ORDER BY t.nome`
            : `SELECT id, nome, codigo_cadastral, tipo, geojson,
                      centroid_lat, centroid_lng, area_m2, bairro, ativo
               FROM terrenos
               WHERE ativo = 1
                 AND centroid_lng >= ? AND centroid_lng <= ?
                 AND centroid_lat >= ? AND centroid_lat <= ?
               ORDER BY nome`;

        const params = [minLng, maxLng, minLat, maxLat];

        invoke<TerrenoGeo[]>('db_query', { sql, params })
            .then(rows => setData(Array.isArray(rows) ? rows : []))
            .catch(() => setData([]))
            .finally(() => setLoading(false));
    }, [bbox, zoom]);

    return { data, loading };
}
```

#### 6. Hook de viewport tracking (com debounce)

```typescript
// hooks/useViewport.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import maplibregl from 'maplibre-gl';

const DEBOUNCE_MS = 200;

export function useViewport(mapRef: RefObject<maplibregl.Map | null>) {
    const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
    const [zoom, setZoom] = useState(12);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateViewport = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const bounds = map.getBounds();
            setBbox([
                bounds.getWest(),
                bounds.getSouth(),
                bounds.getEast(),
                bounds.getNorth(),
            ]);
            setZoom(Math.round(map.getZoom()));
        }, DEBOUNCE_MS);
    }, [mapRef]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        updateViewport();
        map.on('moveend', updateViewport);
        map.on('zoomend', updateViewport);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            map.off('moveend', updateViewport);
            map.off('zoomend', updateViewport);
        };
    }, [mapRef, updateViewport]);

    return { bbox, zoom };
}
```

> **Por que debounce**: sem isso, `useTerrenosInViewport` disparada por `moveend`/`zoomend` faz um `invoke('db_query')` a cada movimento cont├¡nuo de pan/zoom, gerando uma rajada de chamadas IPC ao Tauri.

#### 7. Integra├º├úo em `useGeoDataLayers` e `ItinerarioModal`

```typescript
// No mapa (useGeoDataLayers): ADICIONAR useTerrenosInViewport ao lado de useTerrenos,
// n├úo substituir ÔÇö ver nota abaixo.
const { bbox, zoom } = useViewport(mapRef);
const { data: terrenosViewport, loading: loadingTerrenos } = useTerrenosInViewport(bbox, zoom);
```

> **Aten├º├úo ÔÇö n├úo remover `useTerrenos()`**: `ItinerarioModal.tsx` usa `useTerrenos()` para listar/selecionar terrenos independente do viewport atual do mapa (ex.: vincular um terreno a um itiner├írio que n├úo est├í vis├¡vel na tela). Substituir `useTerrenos()` por `useTerrenosInViewport()` globalmente quebraria esse fluxo. A Fase 2 deve **adicionar** `useTerrenosInViewport` apenas para a camada do mapa em `useGeoDataLayers`, mantendo `useTerrenos()` para casos de listagem/sele├º├úo completa (ou migrar esses casos para uma busca paginada/com filtro de texto, separadamente).

### M├®tricas de Espera (proje├º├úo ÔÇö a validar)

| Features total | Carregados (zoom 12) | Redu├º├úo |
|----------------|---------------------|---------|
| 100.000 | 5.000 | 95% |
| 200.000 | 8.000 | 96% |

---

## Fase 3: Vector Tiles ÔÜá´©Å EXPLORAT├ôRIO / CONDICIONAL

### Status e condi├º├úo de avan├ºo
Esta fase **n├úo deve ser iniciada** antes de medir o efeito real das Fases 1+2 em produ├º├úo. A pr├│pria Fase 2 projeta redu├º├úo de 95-96% no n├║mero de features carregadas (100k ÔåÆ 5-8k por viewport); pode ser que isso j├í seja suficiente, tornando a Fase 3 desnecess├íria. O conte├║do abaixo ├® uma especifica├º├úo explorat├│ria ÔÇö antes de implementar, fazer um spike isolado para validar os pontos marcados com ÔÜá´©Å.

### Escopo
Esta fase ├® **Tauri/desktop-only**. O runtime mobile (Capacitor/Android, `mobile/www/`) n├úo roda um bin├írio Rust local e n├úo se beneficia de um tile server embutido ÔÇö est├í fora do escopo desta ADR.

### Problema
Mesmo com simplifica├º├úo e viewport loading, 200k+ features em GeoJSON ├║nico causam GC pressure e lentid├úo no MapLibre.

### Solu├º├úo
Gerar vector tiles (MVT) no backend Rust e servir via URL.

### Riscos arquiteturais a validar antes de implementar

1. ÔÜá´©Å **Servidor HTTP embutido (`actix-web`) dentro do Tauri** introduz um runtime async (tokio) coexistindo com o runtime sync do Tauri/rusqlite, e um novo servi├ºo de rede local ÔÇö mesmo em `127.0.0.1`, ├® superf├¡cie de ataque adicional (DNS rebinding j├í foi explorado em apps Electron/Tauri). Mitigar com: bind estrito a `127.0.0.1` (nunca `0.0.0.0`), valida├º├úo do header `Origin`/`Host`, e um token de acesso gerado por sess├úo passado via query string.
2. ÔÜá´©Å **`rusqlite::Connection` n├úo pode ser compartilhada como no esbo├ºo.** `Arc<RwLock<rusqlite::Connection>>` acessada de handlers `async` via `.await` bloqueia o executor do tokio durante a query (rusqlite ├® s├¡ncrono). Usar um pool (`r2d2` + `r2d2_sqlite`) e envolver cada query com `tokio::task::spawn_blocking`, ou dedicar uma conex├úo por worker thread.
3. ÔÜá´©Å **API do `geozero` no esbo├ºo ├® ilustrativa, n├úo verificada.** `MvtWriter::new()` / `push_geometry` como escritos abaixo n├úo correspondem 1:1 ├á API p├║blica do crate 0.13 ÔÇö o suporte a MVT do `geozero` ├® baseado nos traits `GeozeroDatasource`/processadores. Fazer um spike isolado (fora do projeto) gerando um `.mvt` v├ílido a partir de um GeoJSON de teste antes de integrar.

### Especifica├º├úo T├®cnica (explorat├│ria)

#### 1. Depend├¬ncia Rust

```toml
# Cargo.toml
[dependencies]
# ... existentes ...
geozero = { version = "0.13", features = ["geojson", "svg"] }
flatbuffers = "23.5"
```

#### 2. Fun├º├úo Rust de tiling

```rust
// src-tauri/src/geo/tiles.rs
use geozero::geojson::GeoJsonReader;
use geozero::MvtWriter;
use geozero::ToMvt;
use std::io::Cursor;

pub struct TileRequest {
    pub z: u8,
    pub x: u32,
    pub y: u32,
}

pub fn generate_mvt_tile(
    features: &[(String, String)],  // (id, geojson_geometry)
    request: &TileRequest,
) -> Result<Vec<u8>, String> {
    // Converter cada feature para MVT
    let mut writer = MvtWriter::new();
    
    // Tile bounds em coordenadas
    let (min_lng, min_lat) = tile_to_lnglat(request.z, request.x, request.y);
    let (max_lng, max_lat) = tile_to_lnglat(request.z, request.x + 1, request.y + 1);
    
    for (id, geojson) in features {
        // Filtrar por bbox do tile
        if !intersects_bbox(geojson, min_lng, min_lat, max_lng, max_lat) {
            continue;
        }
        
        // Simplificar baseado no zoom
        let tolerance = zoom_tolerance(request.z);
        let simplified = simplify_geojson(geojson, tolerance);
        
        // Adicionar ao tile
        writer.push_geometry(&simplified, &id)?;
    }
    
    Ok(writer.into_inner())
}

// Fun├º├Áes auxiliares: tile_to_lnglat, intersects_bbox, simplify_geojson
```

#### 3. Servidor de tiles integrado ao Tauri

```rust
// src-tauri/src/geo/server.rs
use actix_web::{web, App, HttpServer, HttpResponse};
use std::sync::Arc;
use tokio::sync::RwLock;

struct TileServer {
    db: Arc<RwLock<rusqlite::Connection>>,
    cache: Arc<RwLock<LruCache<String, Vec<u8>>>>,
}

async fn serve_tile(
    data: web::Data<Arc<RwLock<TileServer>>>,
    path: web::Path<(u8, u32, u32)>,
) -> HttpResponse {
    let (z, x, y) = path.into_inner();
    let server = data.read().await;
    
    // Verificar cache
    let cache_key = format!("{}/{}/{}", z, x, y);
    if let Some(cached) = server.cache.read().await.get(&cache_key) {
        return HttpResponse::Ok()
            .content_type("application/vnd.mapbox-vector-tile")
            .body(cached.clone());
    }
    
    // Buscar features do banco
    let features = server.db.read().await
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| HttpResponse::InternalServerError().body(e.to_string()))?;
    
    // Gerar tile
    let tile = generate_mvt_tile(&features, &TileRequest { z, x, y })
        .map_err(|e| HttpResponse::InternalServerError().body(e))?;
    
    // Armazenar em cache
    server.cache.write().await.put(cache_key, tile.clone());
    
    HttpResponse::Ok()
        .content_type("application/vnd.mapbox-vector-tile")
        .body(tile)
}

pub async fn start_tile_server(db: rusqlite::Connection) -> std::io::Result<()> {
    let server = Arc::new(RwLock::new(TileServer {
        db: Arc::new(RwLock::new(db)),
        cache: Arc::new(RwLock::new(LruCache::new(1000))),
    }));
    
    let data = web::Data::new(server);
    
    HttpServer::new(move || {
        App::new()
            .app_data(data.clone())
            .route("/tiles/{z}/{x}/{y}.mvt", web::get().to(serve_tile))
    })
    .bind("127.0.0.1:0")?  // Porta aleat├│ria
    .run()
    .await
}
```

#### 4. Frontend: carregar tiles via URL

```typescript
// No MapLibre, usar source tipo 'vector' com URL
map.addSource('terrenos-tiles', {
    type: 'vector',
    tiles: [`http://127.0.0.1:${tilePort}/tiles/{z}/{x}/{y}.mvt`],
    minzoom: 0,
    maxzoom: 16,
});

map.addLayer({
    id: 'terrenos-fill',
    type: 'fill',
    source: 'terrenos-tiles',
    'source-layer': 'terrenos',
    paint: {
        'fill-color': ['match', ['get', 'tipo'], ...],
        'fill-opacity': 0.18,
    },
});
```

#### 5. Inicializa├º├úo no Tauri

```typescript
// Em main.rs ou setup hook
#[tauri::command]
async fn start_tile_server(db_path: String) -> Result<u16, String> {
    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| e.to_string())?;
    
    let port = geo::server::start_tile_server(conn).await
        .map_err(|e| e.to_string())?;
    
    Ok(port)
}
```

### M├®tricas de Espera (proje├º├úo ÔÇö a validar via spike)

| Features | GeoJSON size | MVT tiles | Tempo render |
|----------|--------------|-----------|--------------|
| 100.000 | 50 MB | 200 tiles (50KB each) | 200ms |
| 200.000 | 100 MB | 400 tiles (50KB each) | 400ms |

---

## Ordem de Implementa├º├úo

1. **Fase 1** (1-2 dias) ÔÇö Ô£à Conclu├¡da
   - Implementa├º├úo pr├│pria, sem depend├¬ncias novas
   - N├úo requereu mudan├ºa de schema
   - Ganho imediato para zoom distante

2. **Fase 2** (2-3 dias) ÔÇö Pr├│xima
   - Pr├®-requisito: confirmar `rusqlite` compilado com feature `rtree`
   - Requer migration SQLite (colunas bbox + tabela virtual `terrenos_rtree` + backfill)
   - Adicionar `useTerrenosInViewport` ao mapa sem remover `useTerrenos()` (usado por `ItinerarioModal`)
   - Ganho imediato para qualquer zoom

3. **Fase 3** (5-7 dias, estimativa otimista) ÔÇö Condicional
   - S├│ iniciar ap├│s medir Fases 1+2 em produ├º├úo e confirmar que ainda h├í gargalo
   - Requer spike pr├®vio (fora do projeto) para validar API do `geozero` e o modelo de concorr├¬ncia rusqlite/tokio
   - Requer depend├¬ncias Rust novas (geozero, actix-web) e um servidor HTTP local ÔÇö avaliar superf├¡cie de seguran├ºa antes de aprovar
   - Ganho definitivo para 200k+ features, mas escopo desktop-only

## Trade-offs

| Fase | Complexidade | Ganho | Risco |
|------|--------------|-------|-------|
| Simplifica├º├úo | Baixa | Alto (90% v├®rtices) | Baixo (degrada gracefully) ÔÇö Ô£à implementado |
| Viewport | M├®dia | Alto (95% features) | M├®dio (R-Tree, backfill, n├úo quebrar `ItinerarioModal`) |
| Vector Tiles | Alta | M├íximo | Alto (infraestrutura Rust, servidor HTTP local, API geozero n├úo verificada) |

## Refer├¬ncias

- [Douglas-Peucker Algorithm](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm)
- [MapLibre Vector Tiles](https://maplibre.org/maplibre-style-spec/sources/)
- [geozero Rust crate](https://github.com/georust/geozero)
