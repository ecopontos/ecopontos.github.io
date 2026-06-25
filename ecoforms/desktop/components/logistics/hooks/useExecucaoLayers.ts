import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import {
    useExecucaoGeo,
    useIntercorrenciasGeo,
    useChecklistGeo,
    type ExecucaoClienteGeo,
    type IntercorrenciaGeo,
    type ChecklistGeo,
} from '@/src/interface/hooks/queries/useMapData';
import { useExecucoes } from '@/src/interface/hooks/catalog/logistica';

export function useExecucaoLayers(mapRef: RefObject<maplibregl.Map | null>, selectedRoteiroId: string | null) {
    const [selectedExecucaoId, setSelectedExecucaoId] = useState<string | null>(null);
    const [execucaoLayerVisible, setExecucaoLayerVisible] = useState(true);
    const [intercorrenciasLayerVisible, setIntercorrenciasLayerVisible] = useState(true);
    const [checklistLayerVisible, setChecklistLayerVisible] = useState(true);

    const { data: execucoes } = useExecucoes();
    const { data: execucaoGeo } = useExecucaoGeo(selectedExecucaoId);
    const { data: intercorrenciasGeo } = useIntercorrenciasGeo(selectedExecucaoId);
    const { data: checklistGeo } = useChecklistGeo(selectedExecucaoId);

    const execucaoGeoRef   = useRef(execucaoGeo);         execucaoGeoRef.current = execucaoGeo;
    const intercorrGeoRef  = useRef(intercorrenciasGeo);   intercorrGeoRef.current = intercorrenciasGeo;
    const checklistGeoRef  = useRef(checklistGeo);         checklistGeoRef.current = checklistGeo;
    const execucaoVisRef   = useRef(execucaoLayerVisible);          execucaoVisRef.current = execucaoLayerVisible;
    const intercorrVisRef  = useRef(intercorrenciasLayerVisible);   intercorrVisRef.current = intercorrenciasLayerVisible;
    const checklistVisRef  = useRef(checklistLayerVisible);         checklistVisRef.current = checklistLayerVisible;

    function renderExecucaoLayer(map: maplibregl.Map, points: ExecucaoClienteGeo[]) {
        const vis = execucaoVisRef.current ? 'visible' : 'none';
        const geo: FeatureCollection = {
            type: 'FeatureCollection',
            features: points.map(p => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
                properties: {
                    id: p.id, nome: p.cliente_nome, endereco: p.endereco,
                    coleta_realizada: p.coleta_realizada, horario: p.horario_visita,
                },
            })),
        };
        if (map.getSource('exec-geo')) {
            (map.getSource('exec-geo') as maplibregl.GeoJSONSource).setData(geo);
        } else {
            map.addSource('exec-geo', { type: 'geojson', data: geo });
            map.addLayer({
                id: 'exec-points', type: 'circle', source: 'exec-geo',
                paint: {
                    'circle-radius': 8,
                    'circle-color': ['case', ['==', ['get', 'coleta_realizada'], 1], '#22c55e', '#ef4444'],
                    'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
                },
                layout: { visibility: vis },
            });
            map.on('click', 'exec-points', (e) => {
                const f = e.features?.[0];
                if (!f || f.geometry.type !== 'Point') return;
                const p = f.properties as Record<string, string | number | null>;
                const status = p.coleta_realizada ? '✅ Coletado' : '❌ Não coletado';

                const container = document.createElement('div');
                container.style.cssText = 'font-family:sans-serif;font-size:13px;line-height:1.5';

                const strong = document.createElement('strong');
                strong.textContent = String(p.nome ?? '');
                container.appendChild(strong);

                if (p.endereco) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.style.color = '#555';
                    span.textContent = String(p.endereco);
                    container.appendChild(span);
                }

                container.appendChild(document.createElement('br'));
                const statusEl = document.createElement('span');
                statusEl.textContent = status;
                container.appendChild(statusEl);

                if (p.horario) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.style.cssText = 'color:#888;font-size:11px';
                    span.textContent = String(p.horario);
                    container.appendChild(span);
                }

                new maplibregl.Popup({ maxWidth: '240px' })
                    .setLngLat(f.geometry.coordinates as [number, number])
                    .setDOMContent(container)
                    .addTo(map);
            });
            map.on('mouseenter', 'exec-points', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'exec-points', () => { map.getCanvas().style.cursor = ''; });
        }
        if (map.getLayer('exec-points')) map.setLayoutProperty('exec-points', 'visibility', vis);
    }

    function renderIntercorrenciasLayer(map: maplibregl.Map, points: IntercorrenciaGeo[]) {
        const vis = intercorrVisRef.current ? 'visible' : 'none';
        const geo: FeatureCollection = {
            type: 'FeatureCollection',
            features: points.map(p => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
                properties: {
                    id: p.id, tipo_nome: p.tipo_nome, tipo_cor: p.tipo_cor,
                    descricao: p.descricao, resolvido: p.resolvido, registrado_em: p.registrado_em,
                },
            })),
        };
        if (map.getSource('interc-geo')) {
            (map.getSource('interc-geo') as maplibregl.GeoJSONSource).setData(geo);
        } else {
            map.addSource('interc-geo', { type: 'geojson', data: geo });
            map.addLayer({
                id: 'interc-points', type: 'circle', source: 'interc-geo',
                paint: {
                    'circle-radius': 9,
                    'circle-color': ['get', 'tipo_cor'],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': ['case', ['==', ['get', 'resolvido'], 1], '#fff', '#fbbf24'],
                },
                layout: { visibility: vis },
            });
            map.on('click', 'interc-points', (e) => {
                const f = e.features?.[0];
                if (!f || f.geometry.type !== 'Point') return;
                const p = f.properties as Record<string, string | number | null>;
                const res = p.resolvido ? '✅ Resolvida' : '⚠️ Pendente';
                const data = p.registrado_em ? new Date(p.registrado_em as string).toLocaleString('pt-BR') : '';

                const container = document.createElement('div');
                container.style.cssText = 'font-family:sans-serif;font-size:13px;line-height:1.5';

                const strong = document.createElement('strong');
                strong.textContent = String(p.tipo_nome ?? '');
                container.appendChild(strong);

                if (p.descricao) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.style.color = '#555';
                    span.textContent = String(p.descricao);
                    container.appendChild(span);
                }

                container.appendChild(document.createElement('br'));
                const resEl = document.createElement('span');
                resEl.textContent = res;
                container.appendChild(resEl);

                if (data) {
                    container.appendChild(document.createElement('br'));
                    const span = document.createElement('span');
                    span.style.cssText = 'color:#888;font-size:11px';
                    span.textContent = data;
                    container.appendChild(span);
                }

                new maplibregl.Popup({ maxWidth: '260px' })
                    .setLngLat(f.geometry.coordinates as [number, number])
                    .setDOMContent(container)
                    .addTo(map);
            });
            map.on('mouseenter', 'interc-points', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'interc-points', () => { map.getCanvas().style.cursor = ''; });
        }
        if (map.getLayer('interc-points')) map.setLayoutProperty('interc-points', 'visibility', vis);
    }

    function renderChecklistLayer(map: maplibregl.Map, points: ChecklistGeo[]) {
        const vis = checklistVisRef.current ? 'visible' : 'none';
        const geo: FeatureCollection = {
            type: 'FeatureCollection',
            features: points.map(p => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
                properties: {
                    id: p.id, item: p.item, concluido: p.concluido, evidencia_url: p.evidencia_url,
                },
            })),
        };
        if (map.getSource('checklist-geo')) {
            (map.getSource('checklist-geo') as maplibregl.GeoJSONSource).setData(geo);
        } else {
            map.addSource('checklist-geo', { type: 'geojson', data: geo });
            map.addLayer({
                id: 'checklist-points', type: 'circle', source: 'checklist-geo',
                paint: {
                    'circle-radius': 7,
                    'circle-color': ['case', ['==', ['get', 'concluido'], 1], '#3b82f6', '#94a3b8'],
                    'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
                },
                layout: { visibility: vis },
            });
            map.on('click', 'checklist-points', (e) => {
                const f = e.features?.[0];
                if (!f || f.geometry.type !== 'Point') return;
                const p = f.properties as Record<string, string | number | null>;
                const status = p.concluido ? '✅ Concluído' : '⏳ Pendente';

                const container = document.createElement('div');
                container.style.cssText = 'font-family:sans-serif;font-size:13px;line-height:1.5';

                const strong = document.createElement('strong');
                strong.textContent = String(p.item ?? '');
                container.appendChild(strong);

                container.appendChild(document.createElement('br'));
                const statusEl = document.createElement('span');
                statusEl.textContent = status;
                container.appendChild(statusEl);

                if (p.evidencia_url) {
                    const img = document.createElement('img');
                    img.style.cssText = 'max-width:180px;margin-top:4px;border-radius:4px';
                    img.alt = 'Evidência';
                    const url = String(p.evidencia_url);
                    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http')) {
                        img.src = url;
                        container.appendChild(document.createElement('br'));
                        container.appendChild(img);
                    }
                }

                new maplibregl.Popup({ maxWidth: '220px' })
                    .setLngLat(f.geometry.coordinates as [number, number])
                    .setDOMContent(container)
                    .addTo(map);
            });
            map.on('mouseenter', 'checklist-points', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'checklist-points', () => { map.getCanvas().style.cursor = ''; });
        }
        if (map.getLayer('checklist-points')) map.setLayoutProperty('checklist-points', 'visibility', vis);
    }

    // Re-render estável para style.load — usa refs para dados atuais
    const renderAllExecLayers = useCallback((map: maplibregl.Map) => {
        if (execucaoGeoRef.current.length > 0) renderExecucaoLayer(map, execucaoGeoRef.current);
        if (intercorrGeoRef.current.length > 0) renderIntercorrenciasLayer(map, intercorrGeoRef.current);
        if (checklistGeoRef.current.length > 0) renderChecklistLayer(map, checklistGeoRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Camadas de execução
    useEffect(() => {
        if (!mapRef.current?.isStyleLoaded()) return;
        renderExecucaoLayer(mapRef.current, execucaoGeo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [execucaoGeo]);

    useEffect(() => {
        if (!mapRef.current?.isStyleLoaded()) return;
        renderIntercorrenciasLayer(mapRef.current, intercorrenciasGeo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intercorrenciasGeo]);

    useEffect(() => {
        if (!mapRef.current?.isStyleLoaded()) return;
        renderChecklistLayer(mapRef.current, checklistGeo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checklistGeo]);

    // Toggles de visibilidade
    useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const vis = execucaoLayerVisible ? 'visible' : 'none';
        if (map.getLayer('exec-points')) map.setLayoutProperty('exec-points', 'visibility', vis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [execucaoLayerVisible]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const vis = intercorrenciasLayerVisible ? 'visible' : 'none';
        if (map.getLayer('interc-points')) map.setLayoutProperty('interc-points', 'visibility', vis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intercorrenciasLayerVisible]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const vis = checklistLayerVisible ? 'visible' : 'none';
        if (map.getLayer('checklist-points')) map.setLayoutProperty('checklist-points', 'visibility', vis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checklistLayerVisible]);

    // Fit bounds ao selecionar execução
    useEffect(() => {
        if (!execucaoGeo.length || !mapRef.current?.isStyleLoaded()) return;
        const bounds = new maplibregl.LngLatBounds();
        execucaoGeo.forEach(p => bounds.extend([p.longitude, p.latitude]));
        mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 16, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [execucaoGeo]);

    // Limpar seleção de execução ao trocar roteiro
    useEffect(() => {
        setSelectedExecucaoId(null);
    }, [selectedRoteiroId]);

    return {
        execucoes,
        selectedExecucaoId, setSelectedExecucaoId,
        execucaoLayerVisible, setExecucaoLayerVisible,
        intercorrenciasLayerVisible, setIntercorrenciasLayerVisible,
        checklistLayerVisible, setChecklistLayerVisible,
        renderAllExecLayers,
    };
}
