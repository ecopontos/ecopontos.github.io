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

// ─── Origem da coordenada / motivo de parada sem localização ──────────────────
//
// Ordem de fallback usada por ROTEIRO_CLIENTES_ITINERARIO (ver comentário e SQL em
// desktop/src/infrastructure/persistence/sqlite/queries/terrenos.ts) para resolver a posição
// de cada parada — hoje só existia implícita no SQL, documentada aqui explicitamente:
//   0. imovel_pontos_operacionais  — ponto operacional principal do imóvel vinculado (Fase 4)
//   1. cliente_imovel_vinculos      — vínculo principal do cliente resolve o imóvel (Fase 3)
//   2. terrenos.centroid_lat/lng    — centroide do imóvel resolvido em 1, se tiver centroide
//   3. clientes.latitude/longitude  — coordenada do próprio cliente, usada se não houver vínculo/centroide
// Se nada disso resolver, a parada fica sem localização (ver deriveMotivoSemLocalizacao).

/** Rótulo de origem da coordenada final usada por uma parada do itinerário. */
export type CoordOrigem = 'ponto_operacional' | 'cliente_latlng' | 'terreno_centroid';

export interface CoordOrigemStop {
    latitude: number | null;
    longitude: number | null;
    /** imovel_pontos_operacionais.latitude "cru" do terreno resolvido (Fase 4). */
    ponto_operacional_lat?: number | null | undefined;
    /** imovel_pontos_operacionais.longitude "cru" do terreno resolvido (Fase 4). */
    ponto_operacional_lng?: number | null | undefined;
    /** terrenos.centroid_lat "cru" do terreno resolvido (vínculo principal). */
    terreno_centroid_lat: number | null | undefined;
    /** terrenos.centroid_lng "cru" do terreno resolvido (vínculo principal). */
    terreno_centroid_lng: number | null | undefined;
}

/**
 * Deriva de onde veio a coordenada final de uma parada, comparando os valores "crus" que a
 * query ROTEIRO_CLIENTES_ITINERARIO já retorna (sem precisar de coluna nova no banco nem de
 * uma nova query): tem precedência o ponto operacional (Fase 4), depois o centroide do terreno
 * e por fim clientes.latitude/longitude.
 * Retorna null quando a parada não tem localização resolvida.
 */
export function deriveCoordOrigem(stop: CoordOrigemStop): CoordOrigem | null {
    if (stop.latitude == null || stop.longitude == null) return null;
    const usouPontoOperacional = stop.ponto_operacional_lat != null && stop.ponto_operacional_lng != null;
    if (usouPontoOperacional) return 'ponto_operacional';
    const usouCentroideDoTerreno = stop.terreno_centroid_lat != null && stop.terreno_centroid_lng != null;
    if (!usouCentroideDoTerreno) return 'cliente_latlng';
    return 'terreno_centroid';
}

/** Motivo provável de uma parada não ter localização resolvida. */
export type MotivoSemLocalizacao = 'cliente_sem_lat_lng' | 'cliente_sem_terreno_vinculado' | 'terreno_sem_centroide';

export interface MotivoSemLocalizacaoStop {
    latitude: number | null;
    longitude: number | null;
    /** terreno_id final (COALESCE(rc.terreno_id, c.terreno_id)) já retornado pela query. */
    terreno_id: string | null | undefined;
    /** terrenos.centroid_lat "cru" do terreno resolvido, se houver. */
    terreno_centroid_lat: number | null | undefined;
}

/**
 * Deriva o motivo provável de uma parada sem coordenada resolvida, usando os mesmos campos que
 * ROTEIRO_CLIENTES_ITINERARIO já retorna. Retorna null quando a parada já tem localização.
 */
export function deriveMotivoSemLocalizacao(stop: MotivoSemLocalizacaoStop): MotivoSemLocalizacao | null {
    if (stop.latitude != null && stop.longitude != null) return null;
    if (!stop.terreno_id) return 'cliente_sem_terreno_vinculado';
    if (stop.terreno_centroid_lat == null) return 'terreno_sem_centroide';
    // Estado defensivo/inconsistente: há terreno com centroide, mas a posição ainda não foi
    // resolvida (não deveria ocorrer dado o COALESCE da query, mas cobre dados legados/corrompidos).
    return 'cliente_sem_lat_lng';
}

/** Rótulos amigáveis (pt-BR) para exibição de CoordOrigem na UI. */
export const COORD_ORIGEM_LABELS: Record<CoordOrigem, string> = {
    ponto_operacional: 'Ponto operacional do imóvel',
    cliente_latlng: 'Coordenada do cadastro do cliente',
    terreno_centroid: 'Centroide do terreno vinculado ao cliente',
};

/** Rótulos amigáveis (pt-BR) para exibição de MotivoSemLocalizacao na UI. */
export const MOTIVO_SEM_LOCALIZACAO_LABELS: Record<MotivoSemLocalizacao, string> = {
    cliente_sem_lat_lng: 'Cliente sem latitude/longitude cadastrada',
    cliente_sem_terreno_vinculado: 'Cliente sem terreno vinculado e sem latitude/longitude cadastrada',
    terreno_sem_centroide: 'Terreno vinculado ainda sem centroide calculado',
};
