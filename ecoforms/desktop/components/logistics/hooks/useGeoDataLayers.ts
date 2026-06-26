import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import {
    useClientesGeo,
    useTerrenosExtent,
    useTerrenosInViewport,
    useGeoLayers,
    useItinerario,
    type TerrenoGeo,
} from '@/src/interface/hooks/queries/useMapData';
import { useRoteiros } from '@/src/interface/hooks/catalog/logistica';
import { TIPO_CORES } from '@/lib/map-styles';
import { escapeHtml } from '@/lib/map-popup';
import { addGeoLayerToMap, buildTerrenosGeojson } from '../map-layers';
import { useViewport } from './useViewport';

function hashTerrenos(terrenos: TerrenoGeo[], zoom: number): string {
    if (terrenos.length === 0) return '';
    // Hash do id COMPLETO (não só do 1º caractere) amostrado ao longo do array,
    // mais area/ativo — evita colisões que deixariam o cache de geojson defasado.
    let h = (terrenos.length * 2654435761 + zoom * 40503) | 0;
    const step = Math.max(1, Math.floor(terrenos.length / 200));
    for (let i = 0; i < terrenos.length; i += step) {
        const t = terrenos[i];
        for (let j = 0; j < t.id.length; j++) {
            h = ((h << 5) - h + t.id.charCodeAt(j)) | 0;
        }
        h = ((h << 5) - h + (t.area_m2 ?? 0) + (t.ativo ?? 0)) | 0;
    }
    return String(h);
}

export function useGeoDataLayers(mapRef: RefObject<maplibregl.Map | null>, initialRoteiroId: string | null = null) {
    const [terrenosVisible, setTerrenosVisible] = useState(true);
    const [clientesVisible, setClientesVisible] = useState(true);
    const [itinerarioVisible, setItinerarioVisible] = useState(true);

    const { bbox, zoom } = useViewport(mapRef);
    const { data: clientes, loading: loadingClientes } = useClientesGeo(bbox);
    const { data: geoLayers, loading: loadingLayers, refetch: refetchLayers } = useGeoLayers();
    const { data: roteiros } = useRoteiros();
    const [selectedRoteiroId, setSelectedRoteiroId] = useState<string | null>(initialRoteiroId);
    const { data: itinerario } = useItinerario(selectedRoteiroId);

    const { data: terrenos, loading: loadingTerrenos, refetch: refetchTerrenosViewport } = useTerrenosInViewport(bbox, zoom);
    const { extent: terrenosExtent, refetch: refetchTerrenosExtent } = useTerrenosExtent();

    const refetchTerrenos = useCallback(async () => {
        await Promise.all([refetchTerrenosViewport(), refetchTerrenosExtent()]);
    }, [refetchTerrenosViewport, refetchTerrenosExtent]);

    const clientesRef      = useRef(clientes);        clientesRef.current = clientes;
    const terrenosRef      = useRef(terrenos);        terrenosRef.current = terrenos;
    const terrenosExtentRef = useRef(terrenosExtent); terrenosExtentRef.current = terrenosExtent;
    const geoLayersRef     = useRef(geoLayers);       geoLayersRef.current = geoLayers;
    const itinerarioRef    = useRef(itinerario);      itinerarioRef.current = itinerario;
    const terrenosVisRef      = useRef(terrenosVisible);   terrenosVisRef.current = terrenosVisible;
    const clientesVisRef      = useRef(clientesVisible);   clientesVisRef.current = clientesVisible;
    const itinerarioVisRef    = useRef(itinerarioVisible); itinerarioVisRef.current = itinerarioVisible;
    const zoomRef             = useRef(zoom);              zoomRef.current = zoom;

    const terrenosGeoCache = useRef<{ hash: string; data: FeatureCollection }>({ hash: '', data: { type: 'FeatureCollection', features: [] } });

    // Enquadramento inicial: guardado em ref (sobrevive a setStyle/troca de
    // satélite). Antes era uma source fake `_fitted` que o setStyle apagava,
    // fazendo o mapa re-enquadrar (resetando o pan/zoom) a cada troca de estilo.
    const fittedRef = useRef(false);

    // Listeners de camada (click/hover) são registrados UMA vez por instância
    // de mapa. `setStyle` recria as sources/layers mas NÃO remove os listeners
    // de `map.on(type, layerId, fn)`; sem este guard, cada troca de satélite
    // re-registrava os handlers e um clique abria N popups (vazamento).
    const boundRef = useRef<Set<string>>(new Set());
    const bindOnce = useCallback((
        map: maplibregl.Map,
        type: 'click' | 'mouseenter' | 'mouseleave',
        layer: string,
        fn: (e: maplibregl.MapLayerMouseEvent) => void,
    ) => {
        const key = `${type}:${layer}`;
        if (boundRef.current.has(key)) return;
        boundRef.current.add(key);
        map.on(type, layer, fn);
    }, []);

    const renderDataLayers = useCallback((map: maplibregl.Map) => {
        const hash = hashTerrenos(terrenosRef.current, zoomRef.current);
        if (hash !== terrenosGeoCache.current.hash) {
            terrenosGeoCache.current = { hash, data: buildTerrenosGeojson(terrenosRef.current, zoomRef.current) };
        }
        const terrenosGeo = terrenosGeoCache.current.data;
        const terrVis = terrenosVisRef.current ? 'visible' : 'none';
        if (map.getSource('terrenos')) {
            (map.getSource('terrenos') as maplibregl.GeoJSONSource).setData(terrenosGeo);
        } else {
            map.addSource('terrenos', { type: 'geojson', data: terrenosGeo, promoteId: 'id' });
            map.addLayer({ id: 'terrenos-fill', type: 'fill', source: 'terrenos',
                paint: { 'fill-color': ['match', ['get', 'tipo'],
                    'residencial', TIPO_CORES.residencial,
                    'comercial',   TIPO_CORES.comercial,
                    'industrial',  TIPO_CORES.industrial,
                    'publico',     TIPO_CORES.publico,
                    'rural',       TIPO_CORES.rural,
                    TIPO_CORES.outro],
                    'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.35, 0.18] },
                layout: { visibility: terrVis } });
            map.addLayer({ id: 'terrenos-outline', type: 'line', source: 'terrenos',
                paint: { 'line-color': ['match', ['get', 'tipo'],
                    'residencial', TIPO_CORES.residencial,
                    'comercial',   TIPO_CORES.comercial,
                    'industrial',  TIPO_CORES.industrial,
                    'publico',     TIPO_CORES.publico,
                    'rural',       TIPO_CORES.rural,
                    TIPO_CORES.outro],
                    'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 1.5] },
                layout: { visibility: terrVis } });
            bindOnce(map, 'click', 'terrenos-fill', (e) => {
                const f = e.features?.[0];
                if (!f) return;
                const p = f.properties as Record<string, string | number | null>;
                const areaStr = p.area ? ` · ${Math.round(Number(p.area)).toLocaleString('pt-BR')} m²` : '';

                const container = document.createElement('div');
                container.style.cssText = 'font-family:sans-serif;font-size:13px;line-height:1.6';

                const strong = document.createElement('strong');
                strong.textContent = String(p.nome ?? '');
                container.appendChild(strong);

                if (p.codigo) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.textContent = `Código: ${p.codigo}`;
                    container.appendChild(span);
                }
                if (p.bairro) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.textContent = String(p.bairro);
                    container.appendChild(span);
                }
                container.appendChild(document.createElement('br'));
                const meta = document.createElement('span');
                meta.style.cssText = 'color:#888;font-size:11px';
                meta.textContent = `${p.tipo}${areaStr}`;
                container.appendChild(meta);

                const linkDiv = document.createElement('div');
                linkDiv.style.marginTop = '6px';
                const link = document.createElement('a');
                link.href = `/logistica/terreno/${escapeHtml(p.id)}`;
                link.style.cssText = 'color:#2563eb;font-size:12px';
                link.textContent = 'Ver detalhes →';
                linkDiv.appendChild(link);
                container.appendChild(linkDiv);

                new maplibregl.Popup({ maxWidth: '280px' })
                    .setLngLat(e.lngLat)
                    .setDOMContent(container)
                    .addTo(map);
            });
            bindOnce(map, 'mouseenter', 'terrenos-fill', (e) => {
                map.getCanvas().style.cursor = 'pointer';
                if (e.features?.[0]) {
                    map.setFeatureState({ source: 'terrenos', id: e.features[0].id }, { hover: true });
                }
            });
            bindOnce(map, 'mouseleave', 'terrenos-fill', (e) => {
                map.getCanvas().style.cursor = '';
                if (e.features?.[0]) {
                    map.setFeatureState({ source: 'terrenos', id: e.features[0].id }, { hover: false });
                }
            });
        }
        if (map.getLayer('terrenos-fill'))   map.setLayoutProperty('terrenos-fill',    'visibility', terrVis);
        if (map.getLayer('terrenos-outline')) map.setLayoutProperty('terrenos-outline', 'visibility', terrVis);

        // 2. Clientes (pontos de coleta, com clustering)
        const cliVis = clientesVisRef.current ? 'visible' : 'none';
        const clientesGeo: FeatureCollection = {
            type: 'FeatureCollection',
            features: clientesRef.current.map(c => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
                properties: { id: c.id, nome: c.nome, tipo: c.tipo, categoria: c.categoria, endereco: c.endereco, terreno_nome: c.terreno_nome },
            })),
        };
        if (map.getSource('clientes')) {
            (map.getSource('clientes') as maplibregl.GeoJSONSource).setData(clientesGeo);
        } else {
            map.addSource('clientes', { type: 'geojson', data: clientesGeo, cluster: true, clusterMaxZoom: 14, clusterRadius: 40 });
            map.addLayer({ id: 'clientes-cluster', type: 'circle', source: 'clientes',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
                    'circle-color': ['step', ['get', 'point_count'], '#22c55e', 10, '#16a34a', 50, '#15803d'],
                    'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
                },
                layout: { visibility: cliVis } });
            map.addLayer({ id: 'clientes-cluster-count', type: 'symbol', source: 'clientes',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12,
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    visibility: cliVis,
                },
                paint: { 'text-color': '#fff' } });
            map.addLayer({ id: 'clientes-point', type: 'circle', source: 'clientes',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-radius': 7,
                    'circle-color': ['match', ['get', 'tipo'], 'PF', '#22c55e', 'PJ', '#3b82f6', '#6b7280'],
                    'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
                },
                layout: { visibility: cliVis } });
            bindOnce(map, 'click', 'clientes-point', (e) => {
                const f = e.features?.[0];
                if (!f || f.geometry.type !== 'Point') return;
                const p = f.properties as Record<string, string | null>;
                const coords = f.geometry.coordinates as [number, number];

                const container = document.createElement('div');
                container.style.cssText = 'font-family:sans-serif;font-size:13px;line-height:1.5';

                const strong = document.createElement('strong');
                strong.style.fontSize = '14px';
                strong.textContent = String(p.nome ?? '');
                container.appendChild(strong);

                if (p.terreno_nome) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.style.color = '#555';
                    span.textContent = `📍 ${p.terreno_nome}`;
                    container.appendChild(span);
                }
                if (p.endereco) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.style.color = '#555';
                    span.textContent = String(p.endereco);
                    container.appendChild(span);
                }
                container.appendChild(document.createElement('br'));
                const meta = document.createElement('span');
                meta.style.cssText = 'color:#888;font-size:12px';
                meta.textContent = `${p.tipo ?? ''}${p.categoria ? ` · ${p.categoria}` : ''}`;
                container.appendChild(meta);

                new maplibregl.Popup({ maxWidth: '260px' })
                    .setLngLat(coords)
                    .setDOMContent(container)
                    .addTo(map);
            });
            bindOnce(map, 'click', 'clientes-cluster', async (e) => {
                const features = map.queryRenderedFeatures(e.point, { layers: ['clientes-cluster'] });
                const clusterId = features[0]?.properties?.cluster_id;
                if (clusterId == null) return;
                try {
                    const zoom = await (map.getSource('clientes') as maplibregl.GeoJSONSource).getClusterExpansionZoom(clusterId);
                    if (features[0].geometry.type === 'Point') {
                        map.easeTo({ center: features[0].geometry.coordinates as [number, number], zoom });
                    }
                } catch { /* cluster expandido */ }
            });
            ['clientes-point', 'clientes-cluster'].forEach(id => {
                bindOnce(map, 'mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
                bindOnce(map, 'mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
            });
        }
        if (map.getLayer('clientes-cluster'))       map.setLayoutProperty('clientes-cluster',       'visibility', cliVis);
        if (map.getLayer('clientes-cluster-count')) map.setLayoutProperty('clientes-cluster-count', 'visibility', cliVis);
        if (map.getLayer('clientes-point'))         map.setLayoutProperty('clientes-point',         'visibility', cliVis);

        // 3. Camadas genéricas (geo_layers)
        geoLayersRef.current.forEach(layer => addGeoLayerToMap(map, layer));

        // 4. Itinerário (linha de rota + pins numerados)
        renderItinerary(map, itinerarioRef.current);

        if (!fittedRef.current) {
            const bounds = new maplibregl.LngLatBounds();
            if (clientesRef.current.length > 0) {
                clientesRef.current.forEach(c => bounds.extend([c.longitude, c.latitude]));
            } else if (terrenosExtentRef.current) {
                const e = terrenosExtentRef.current;
                bounds.extend([e.minLng, e.minLat]);
                bounds.extend([e.maxLng, e.maxLat]);
            }
            if (!bounds.isEmpty()) {
                fittedRef.current = true;
                map.fitBounds(bounds, { padding: 60, maxZoom: 14, animate: false });
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function renderItinerary(map: maplibregl.Map, stops: typeof itinerario) {
        const valid = stops.filter(s => s.latitude != null && s.longitude != null);
        const itiVis = itinerarioVisRef.current ? 'visible' : 'none';

        const routeGeo: FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                ...(valid.length >= 2 ? [{
                    type: 'Feature' as const,
                    geometry: { type: 'LineString' as const, coordinates: valid.map(s => [s.longitude!, s.latitude!]) },
                    properties: { _type: 'route' },
                }] : []),
                ...valid.map(s => ({
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [s.longitude!, s.latitude!] },
                    properties: { ordem: s.ordem, nome: s.nome, terreno: s.terreno_nome, codigo: s.codigo_cadastral, _type: 'stop' },
                })),
            ],
        };

        if (map.getSource('itinerary')) {
            (map.getSource('itinerary') as maplibregl.GeoJSONSource).setData(routeGeo);
        } else {
            map.addSource('itinerary', { type: 'geojson', data: routeGeo });
            map.addLayer({ id: 'itinerary-line', type: 'line', source: 'itinerary',
                filter: ['==', ['get', '_type'], 'route'],
                paint: { 'line-color': '#f97316', 'line-width': 3, 'line-dasharray': [2, 1] },
                layout: { visibility: itiVis } });
            map.addLayer({ id: 'itinerary-circle', type: 'circle', source: 'itinerary',
                filter: ['==', ['get', '_type'], 'stop'],
                paint: { 'circle-radius': 12, 'circle-color': '#f97316', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
                layout: { visibility: itiVis } });
            map.addLayer({ id: 'itinerary-label', type: 'symbol', source: 'itinerary',
                filter: ['==', ['get', '_type'], 'stop'],
                layout: {
                    'text-field': ['to-string', ['get', 'ordem']],
                    'text-size': 11,
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    visibility: itiVis,
                },
                paint: { 'text-color': '#fff' } });
            bindOnce(map, 'click', 'itinerary-circle', (e) => {
                const f = e.features?.[0];
                if (!f || f.geometry.type !== 'Point') return;
                const p = f.properties as Record<string, string | null>;

                const container = document.createElement('div');
                container.style.cssText = 'font-family:sans-serif;font-size:13px;line-height:1.5';

                const strong = document.createElement('strong');
                strong.textContent = `#${p.ordem} — ${p.nome ?? ''}`;
                container.appendChild(strong);

                if (p.terreno) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.style.color = '#555';
                    span.textContent = `📍 ${p.terreno}`;
                    container.appendChild(span);
                }
                if (p.codigo) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.style.cssText = 'color:#888;font-size:11px';
                    span.textContent = String(p.codigo);
                    container.appendChild(span);
                }

                new maplibregl.Popup({ maxWidth: '240px' })
                    .setLngLat(f.geometry.coordinates as [number, number])
                    .setDOMContent(container)
                    .addTo(map);
            });
            bindOnce(map, 'mouseenter', 'itinerary-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
            bindOnce(map, 'mouseleave', 'itinerary-circle', () => { map.getCanvas().style.cursor = ''; });
        }
        if (map.getLayer('itinerary-line'))   map.setLayoutProperty('itinerary-line',   'visibility', itiVis);
        if (map.getLayer('itinerary-circle')) map.setLayoutProperty('itinerary-circle', 'visibility', itiVis);
        if (map.getLayer('itinerary-label'))  map.setLayoutProperty('itinerary-label',  'visibility', itiVis);
    }

    useEffect(() => {
        if (!mapRef.current?.isStyleLoaded()) return;
        renderDataLayers(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientes, terrenos, terrenosExtent, geoLayers, zoom]);

    useEffect(() => {
        if (!mapRef.current?.isStyleLoaded()) return;
        renderItinerary(mapRef.current, itinerario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itinerario]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const vis = terrenosVisible ? 'visible' : 'none';
        if (map.getLayer('terrenos-fill'))   map.setLayoutProperty('terrenos-fill',    'visibility', vis);
        if (map.getLayer('terrenos-outline')) map.setLayoutProperty('terrenos-outline', 'visibility', vis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [terrenosVisible]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const vis = clientesVisible ? 'visible' : 'none';
        if (map.getLayer('clientes-cluster'))       map.setLayoutProperty('clientes-cluster',       'visibility', vis);
        if (map.getLayer('clientes-cluster-count')) map.setLayoutProperty('clientes-cluster-count', 'visibility', vis);
        if (map.getLayer('clientes-point'))         map.setLayoutProperty('clientes-point',         'visibility', vis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientesVisible]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const vis = itinerarioVisible ? 'visible' : 'none';
        if (map.getLayer('itinerary-line'))   map.setLayoutProperty('itinerary-line',   'visibility', vis);
        if (map.getLayer('itinerary-circle')) map.setLayoutProperty('itinerary-circle', 'visibility', vis);
        if (map.getLayer('itinerary-label'))  map.setLayoutProperty('itinerary-label',  'visibility', vis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itinerarioVisible]);

    useEffect(() => {
        const valid = itinerario.filter(s => s.latitude != null && s.longitude != null);
        if (!valid.length || !mapRef.current?.isStyleLoaded()) return;
        const bounds = new maplibregl.LngLatBounds();
        valid.forEach(s => bounds.extend([s.longitude!, s.latitude!]));
        mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 16, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itinerario]);

    return {
        clientes, loadingClientes,
        terrenos, loadingTerrenos, refetchTerrenos,
        geoLayers, loadingLayers, refetchLayers,
        roteiros, selectedRoteiroId, setSelectedRoteiroId,
        itinerario,
        terrenosVisible, setTerrenosVisible,
        clientesVisible, setClientesVisible,
        itinerarioVisible, setItinerarioVisible,
        renderDataLayers,
        clientesRef, clientesVisRef, itinerarioRef, itinerarioVisRef,
    };
}
