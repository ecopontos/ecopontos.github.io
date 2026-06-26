import maplibregl from 'maplibre-gl';
import { OSM_STYLE } from './map-styles';

export interface BaseMapOptions {
    /** Centro inicial [lng, lat]. Padrão: Grande Florianópolis. */
    center?: [number, number];
    /** Zoom inicial. Padrão: 12. */
    zoom?: number;
}

/**
 * Cria um mapa MapLibre base (OSM) com os controles padrão usados pelos modais
 * de mapa (Itinerário, Roteiro/Agendamentos): NavigationControl sem bússola +
 * AttributionControl compacto.
 *
 * Centraliza o setup que antes estava duplicado byte-a-byte em ItinerarioMap e
 * RoteiroMap (cada um com seu próprio OSM_STYLE inline). O mapa principal da aba
 * Mapa usa `useMapInstance` (com troca satélite/OSM e mais controles) e portanto
 * não consome este helper, mas compartilha o mesmo `OSM_STYLE` de `map-styles`.
 */
export function createBaseMap(container: HTMLElement, opts: BaseMapOptions = {}): maplibregl.Map {
    const map = new maplibregl.Map({
        container,
        style: OSM_STYLE,
        attributionControl: false,
        zoom: opts.zoom ?? 12,
        center: opts.center ?? [-48.5, -27.6],
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    return map;
}
