/**
 * Orquestrador de geocodificação: cache + rate-limit + fetch (Fase 2).
 * Mantém geocoding.ts focado em tipos/heurísticas; este módulo centraliza I/O.
 *
 * Política: 1 req/s ao Nominatim (nominatimLimiter), cache de 24h por query.
 */

import { geocodeCache } from "./geocodeCache";
import { nominatimLimiter } from "./rateLimit";

interface NominatimHit {
    lat: string;
    lon: string;
    display_name?: string;
    class?: string;
    type?: string;
    address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        postcode?: string;
    };
}

/**
 * Busca candidatos via Nominatim, com cache e rate-limit.
 * Cache hit → sem rede. Miss → respeita 1 req/s antes do fetch.
 * Devolve o array bruto de hits (geocodeCandidates em geocoding.ts mapeia p/ GeoResult).
 */
export async function geocodeWithCache(query: string, limit = 5): Promise<NominatimHit[]> {
    const cached = geocodeCache.get(query);
    if (cached) return cached as NominatimHit[];

    const q = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=${limit}&countrycodes=br&addressdetails=1`;

    const hits = await nominatimLimiter.run(async () => {
        const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? (data as NominatimHit[]) : [];
    });

    // Não cacheia falha/miss vazio: um erro transitório de rede (Nominatim fora do ar,
    // 429/5xx) não deve suprimir novas tentativas pelo TTL inteiro do cache (24h).
    if (hits.length) geocodeCache.set(query, hits);
    return hits;
}
