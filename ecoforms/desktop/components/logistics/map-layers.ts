import maplibregl from 'maplibre-gl';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import type { GeoLayer, TerrenoGeo } from '@/src/interface/hooks/catalog/logistica';
import { simplifyGeometry, countVertices, getTolerance } from '@/lib/geo/simplify';

/** Empacota uma Position (number[]) como par [lng, lat] para LngLatBounds. */
const pair = (c: Position): [number, number] => [c[0], c[1]];

/**
 * Extrai todas as coordenadas [lng, lat] de uma geometria (achatadas), inclusive de
 * multi-geometrias. Tolerante a coordenadas 3D (lng, lat, elev) — só importa lng/lat.
 */
function flatCoords(geom: Geometry | null | undefined): [number, number][] {
    if (!geom) return [];
    switch (geom.type) {
        case 'Point':
            return [pair(geom.coordinates)];
        case 'MultiPoint':
        case 'LineString':
            return geom.coordinates.map(pair);
        case 'MultiLineString':
        case 'Polygon':
            return geom.coordinates.flat().map(pair);
        case 'MultiPolygon':
            return geom.coordinates.flat(2).map(pair);
        case 'GeometryCollection':
            return geom.geometries.flatMap(flatCoords);
        default:
            return [];
    }
}

/**
 * Bounding box (LngLatBounds do MapLibre) de uma FeatureCollection. Retorna null se
 * nao houver coordenadas validas. Usado para enquadra o mapa na area de um poligono
 * recem-importado — sem isso, um poligono fora da viewport atual fica "invisivel"
 * (tecnicamente renderizado, mas fora da tela).
 */
export function geojsonBounds(geojson: FeatureCollection): maplibregl.LngLatBounds | null {
    const bounds = new maplibregl.LngLatBounds();
    let any = false;
    for (const f of geojson.features ?? []) {
        for (const [lng, lat] of flatCoords(f.geometry)) {
            if (Number.isFinite(lng) && Number.isFinite(lat)) {
                bounds.extend([lng, lat]);
                any = true;
            }
        }
    }
    return any ? bounds : null;
}

export function addGeoLayerToMap(map: maplibregl.Map, layer: GeoLayer) {
    if (!layer.geojson) return;
    let geojson: FeatureCollection;
    try { geojson = JSON.parse(layer.geojson); } catch { return; }
    const src = `geo-${layer.id}`;
    const vis = layer.visivel ? 'visible' : 'none';
    if (map.getSource(src)) {
        (map.getSource(src) as maplibregl.GeoJSONSource).setData(geojson);
    } else {
        map.addSource(src, { type: 'geojson', data: geojson });
    }
    const fill = `geo-fill-${layer.id}`, line = `geo-line-${layer.id}`, circle = `geo-circle-${layer.id}`;
    // NOTE: `geometry-type` no MapLibre/style-spec NORMALIZA multi-geometrias — MultiPolygon
    // retorna "Polygon", MultiLineString retorna "LineString", MultiPoint retorna "Point". Por
    // isso os filtros abaixo testam so os tipos normalizados, e a forma legada
    // `["in", x, ["literal", [...]]]` foi trocada por `["match", ...]` (expressao moderna), que
    // tambem e aceita pelo validador do style-spec sem risco de erro de tipo em runtime.
    try {
        if (!map.getLayer(fill)) {
            map.addLayer({ id: fill, type: 'fill', source: src,
                filter: ['match', ['geometry-type'], ['Polygon'], true, false],
                paint: { 'fill-color': layer.cor, 'fill-opacity': 0.25 },
                layout: { visibility: vis } });
        } else map.setLayoutProperty(fill, 'visibility', vis);
        if (!map.getLayer(line)) {
            map.addLayer({ id: line, type: 'line', source: src,
                filter: ['match', ['geometry-type'], ['Polygon', 'LineString'], true, false],
                paint: { 'line-color': layer.cor, 'line-width': 2 },
                layout: { visibility: vis } });
        } else map.setLayoutProperty(line, 'visibility', vis);
        if (!map.getLayer(circle)) {
            map.addLayer({ id: circle, type: 'circle', source: src,
                filter: ['match', ['geometry-type'], ['Point'], true, false],
                paint: { 'circle-radius': 5, 'circle-color': layer.cor, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' },
                layout: { visibility: vis } });
        } else map.setLayoutProperty(circle, 'visibility', vis);
    } catch (err) {
        // Antes este bloco nao tinha try/catch: um unico addLayer que lancasse (filtro invalido,
        // id colidindo, source faltando) abortava addGeoLayerToMap silenciosamente e a camada
        // simplesmente sumia do mapa sem nenhum log — sintoma "aceitou mas nao imprimiu".
        console.error(`[addGeoLayerToMap] falha ao registrar camada "${layer.id}" (${layer.nome}):`, err);
    }
}

export function removeGeoLayerFromMap(map: maplibregl.Map, layerId: string) {
    [`geo-fill-${layerId}`, `geo-line-${layerId}`, `geo-circle-${layerId}`].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(`geo-${layerId}`)) map.removeSource(`geo-${layerId}`);
}

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
