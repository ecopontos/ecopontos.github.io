import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import {
    saveGeoLayer,
    toggleGeoLayerVisivel,
    deleteGeoLayer,
    deleteTerrenoById,
    type GeoLayer,
    type TerrenoGeo,
    type ClienteGeo,
    type ItinerarioStop,
} from '@/src/interface/hooks/queries/useMapData';
import { removeGeoLayerFromMap } from '../map-layers';

interface UseLayerActionsParams {
    mapRef: RefObject<maplibregl.Map | null>;
    userId: string | null | undefined;
    refetchLayers: () => Promise<void> | void;
    refetchTerrenos: () => Promise<void> | void;
    clientesRef: RefObject<ClienteGeo[]>;
    clientesVisRef: RefObject<boolean>;
    itinerarioRef: RefObject<ItinerarioStop[]>;
    itinerarioVisRef: RefObject<boolean>;
}

/**
 * Handlers de ações sobre camadas: upload de GeoJSON genérico,
 * toggle/exclusão de camadas e terrenos, e "fit all" (centraliza o mapa
 * em todos os pontos visíveis).
 */
export function useLayerActions({
    mapRef, userId, refetchLayers, refetchTerrenos,
    clientesRef, clientesVisRef, itinerarioRef, itinerarioVisRef,
}: UseLayerActionsParams) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Upload de geo_layer genérica
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const text = await file.text();
            let geojson: FeatureCollection;
            try {
                const parsed = JSON.parse(text);
                geojson = parsed.type === 'Feature'
                    ? { type: 'FeatureCollection', features: [parsed] }
                    : parsed;
                if (geojson.type !== 'FeatureCollection') throw new Error();
            } catch { alert('Arquivo inválido. Use GeoJSON (.geojson ou .json).'); return; }
            await saveGeoLayer({
                id: `layer-${Date.now()}`,
                nome: file.name.replace(/\.(geojson|json)$/i, ''),
                tipo: 'geojson', categoria: 'outro',
                geojson: JSON.stringify(geojson),
                cor: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
                criado_por: userId ?? null,
            });
            await refetchLayers();
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [userId, refetchLayers]);

    const handleToggleLayer = useCallback(async (layer: GeoLayer) => {
        const novo = layer.visivel === 0;
        await toggleGeoLayerVisivel(layer.id, novo);
        const map = mapRef.current;
        if (map?.isStyleLoaded()) {
            const vis = novo ? 'visible' : 'none';
            [`geo-fill-${layer.id}`, `geo-line-${layer.id}`, `geo-circle-${layer.id}`].forEach(id => {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
            });
        }
        await refetchLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchLayers]);

    const handleDeleteLayer = useCallback(async (layer: GeoLayer) => {
        if (!confirm(`Remover camada "${layer.nome}"?`)) return;
        if (mapRef.current?.isStyleLoaded()) removeGeoLayerFromMap(mapRef.current, layer.id);
        await deleteGeoLayer(layer.id);
        await refetchLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refetchLayers]);

    const handleDeleteTerreno = useCallback(async (t: TerrenoGeo) => {
        if (!confirm(`Remover terreno "${t.nome}"?`)) return;
        await deleteTerrenoById(t.id);
        await refetchTerrenos();
    }, [refetchTerrenos]);

    // Fit all: centraliza mapa em todos os dados visíveis
    const handleFitAll = useCallback(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const bounds = new maplibregl.LngLatBounds();
        let hasPoints = false;
        if (clientesVisRef.current && clientesRef.current.length > 0) {
            clientesRef.current.forEach(c => bounds.extend([c.longitude, c.latitude]));
            hasPoints = true;
        }
        const valid = itinerarioRef.current.filter(s => s.latitude != null && s.longitude != null);
        if (itinerarioVisRef.current && valid.length > 0) {
            valid.forEach(s => bounds.extend([s.longitude!, s.latitude!]));
            hasPoints = true;
        }
        if (hasPoints) map.fitBounds(bounds, { padding: 60, maxZoom: 15, animate: true });
    }, [mapRef, clientesVisRef, clientesRef, itinerarioRef, itinerarioVisRef]);

    return {
        fileInputRef, uploading,
        handleFileUpload, handleToggleLayer, handleDeleteLayer, handleDeleteTerreno, handleFitAll,
    };
}
