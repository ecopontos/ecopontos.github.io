import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import type { Bbox } from '@/lib/geo/bbox';

const DEBOUNCE_MS = 200;
const MIN_SHIFT_RATIO = 0.1;

function bboxShiftSignificant(prev: Bbox, next: Bbox): boolean {
    const prevW = prev[2] - prev[0];
    const prevH = prev[3] - prev[1];
    if (prevW === 0 || prevH === 0) return true;
    const dLng = Math.abs((next[0] + next[2]) / 2 - (prev[0] + prev[2]) / 2);
    const dLat = Math.abs((next[1] + next[3]) / 2 - (prev[1] + prev[3]) / 2);
    return (dLng / prevW) > MIN_SHIFT_RATIO || (dLat / prevH) > MIN_SHIFT_RATIO;
}

export function useViewport(mapRef: RefObject<maplibregl.Map | null>) {
    const [bbox, setBbox] = useState<Bbox | null>(null);
    const [zoom, setZoom] = useState(12);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevBboxRef = useRef<Bbox | null>(null);
    const prevZoomRef = useRef<number>(12);

    const updateViewport = useCallback(() => {
        const map = mapRef.current;
        if (!map) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const bounds = map.getBounds();
            const nextBbox: Bbox = [
                bounds.getWest(),
                bounds.getSouth(),
                bounds.getEast(),
                bounds.getNorth(),
            ];
            const nextZoom = Math.round(map.getZoom());

            const zoomChanged = nextZoom !== prevZoomRef.current;
            const bboxChanged = !prevBboxRef.current || bboxShiftSignificant(prevBboxRef.current, nextBbox);

            if (zoomChanged || bboxChanged) {
                prevBboxRef.current = nextBbox;
                prevZoomRef.current = nextZoom;
                setBbox(nextBbox);
                setZoom(nextZoom);
            }
        }, DEBOUNCE_MS);
    }, [mapRef]);

    useEffect(() => {
        let map: maplibregl.Map | null = null;
        let rafId: number | null = null;

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
