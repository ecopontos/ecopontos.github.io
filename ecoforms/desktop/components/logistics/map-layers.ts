import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { GeoLayer, TerrenoGeo } from '@/src/interface/hooks/queries/useMapData';
import { simplifyGeometry, countVertices, getTolerance } from '@/lib/geo/simplify';

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
    if (!map.getLayer(fill)) {
        map.addLayer({ id: fill, type: 'fill', source: src,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
            paint: { 'fill-color': layer.cor, 'fill-opacity': 0.25 },
            layout: { visibility: vis } });
    } else map.setLayoutProperty(fill, 'visibility', vis);
    if (!map.getLayer(line)) {
        map.addLayer({ id: line, type: 'line', source: src,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString']]],
            paint: { 'line-color': layer.cor, 'line-width': 2 },
            layout: { visibility: vis } });
    } else map.setLayoutProperty(line, 'visibility', vis);
    if (!map.getLayer(circle)) {
        map.addLayer({ id: circle, type: 'circle', source: src,
            filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            paint: { 'circle-radius': 5, 'circle-color': layer.cor, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' },
            layout: { visibility: vis } });
    } else map.setLayoutProperty(circle, 'visibility', vis);
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
