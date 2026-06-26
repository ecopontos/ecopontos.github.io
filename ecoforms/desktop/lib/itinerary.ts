/**
 * Utilitários de itinerário compartilhados entre o modal de itinerário e a aba
 * Mapa do detalhe do roteiro (gaps G2/G3 da auditoria do mapa).
 */

export interface GeoStop {
    id: string;
    lat: number | null;
    lng: number | null;
}

/** Distância em km (Haversine) entre dois pontos. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const lat1 = (aLat * Math.PI) / 180;
    const lat2 = (bLat * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Reordena por vizinho-mais-próximo (greedy), começando pelo primeiro stop com
 * coordenada. Stops sem coordenada mantêm a ordem relativa e vão para o final.
 * Retorna os ids na nova ordem. Não muta a entrada.
 */
export function nearestNeighborOrder(stops: GeoStop[]): string[] {
    const withGeo = stops.filter(
        (s): s is GeoStop & { lat: number; lng: number } => s.lat != null && s.lng != null,
    );
    const withoutGeo = stops.filter((s) => s.lat == null || s.lng == null);

    // Com 0–2 pontos geo não há o que otimizar.
    if (withGeo.length <= 2) return stops.map((s) => s.id);

    const remaining = [...withGeo];
    const ordered: typeof withGeo = [remaining.shift()!];
    while (remaining.length) {
        const cur = ordered[ordered.length - 1];
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = haversineKm(cur.lat, cur.lng, remaining[i].lat, remaining[i].lng);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        ordered.push(remaining.splice(bestIdx, 1)[0]);
    }

    return [...ordered.map((s) => s.id), ...withoutGeo.map((s) => s.id)];
}

/** Distância total (km) ao percorrer os stops geocodificados na ordem dada. */
export function totalRouteKm(stops: GeoStop[]): number {
    const geo = stops.filter(
        (s): s is GeoStop & { lat: number; lng: number } => s.lat != null && s.lng != null,
    );
    let total = 0;
    for (let i = 1; i < geo.length; i++) {
        total += haversineKm(geo[i - 1].lat, geo[i - 1].lng, geo[i].lat, geo[i].lng);
    }
    return total;
}

/** Conta quantos stops estão sem coordenada (não aparecem no mapa). */
export function countSemLocalizacao(stops: GeoStop[]): number {
    return stops.filter((s) => s.lat == null || s.lng == null).length;
}
