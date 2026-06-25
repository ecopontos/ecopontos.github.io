import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import type { Bbox } from '@/lib/geo/bbox';

const DEBOUNCE_MS = 200;

/**
 * Tracks the current map viewport (bbox + zoom) with debounce.
 * Used by useTerrenosInViewport to fetch only visible features.
 */
export function useViewport(mapRef: RefObject<maplibregl.Map | null>) {
    const [bbox, setBbox] = useState<Bbox | null>(null);
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
        let map: maplibregl.Map | null = null;
        let rafId: number | null = null;

        // mapRef.current ainda é null neste ponto: useMapInstance cria o mapa em
        // um efeito registrado depois deste. Aguarda a instância ficar disponível.
        const attach = () => {
            map = mapRef.current;
            if (!map) {
                rafId = requestAnimationFrame(attach);
                return;
            }
            updateViewport();
            map.on('moveend', updateViewport);
            map.on('zoomend', updateViewport);
        };
        attach();

        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (map) {
                map.off('moveend', updateViewport);
                map.off('zoomend', updateViewport);
            }
        };
    }, [mapRef, updateViewport]);

    return { bbox, zoom };
}
