/* eslint-disable react-hooks/refs */
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { OSM_STYLE, SATELLITE_STYLE } from '@/lib/map-styles';

/**
 * Cria e gerencia a instância do MapLibre: container, controles padrão,
 * troca satélite/OSM e o evento `style.load` (disparado na criação inicial
 * e a cada troca de estilo, quando todas as fontes/camadas precisam ser
 * recriadas). `mapContainer`/`mapRef` são recebidos do orquestrador para
 * que outros hooks (camadas) possam compartilhar a mesma instância do mapa.
 */
export function useMapInstance(
    mapContainer: RefObject<HTMLDivElement | null>,
    mapRef: RefObject<maplibregl.Map | null>,
    onStyleLoad: (map: maplibregl.Map) => void,
) {
    const [isSatellite, setIsSatellite] = useState(false);

    // Ref para a callback evita reexecutar o efeito de inicialização
    // quando a identidade de onStyleLoad mudar entre renders.
    const onStyleLoadRef = useRef(onStyleLoad);
    onStyleLoadRef.current = onStyleLoad;

    // Init mapa
    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;
        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: OSM_STYLE,
            center: [-51.2177, -30.0346],
            zoom: 9,
        });
        map.addControl(new maplibregl.NavigationControl(), 'top-left');
        map.addControl(new maplibregl.FullscreenControl(), 'top-left');
        map.addControl(new maplibregl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
        }), 'top-left');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
        map.on('style.load', () => onStyleLoadRef.current(map));
        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Troca de estilo
    useEffect(() => {
        mapRef.current?.setStyle(isSatellite ? SATELLITE_STYLE : OSM_STYLE);
    }, [isSatellite, mapRef]);

    return { isSatellite, setIsSatellite };
}
