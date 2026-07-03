/**
 * Cache local de geocodificação por hash da query normalizada (Fase 2).
 * Modelo em `VisualQueryCache`, porém TTL maior (24h) — geocoding é estável.
 * Evita nova chamada ao Nominatim quando o endereço não mudou.
 */

import { normalizeQuery } from "./geocoding";

interface CacheEntry {
    data: unknown;
    timestamp: number;
    ttl: number;
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24h

export class GeocodeCache {
    private cache = new Map<string, CacheEntry>();
    private defaultTTL = DEFAULT_TTL;

    get(query: string): unknown | null {
        const key = this.hash(query);
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    set(query: string, data: unknown, ttl?: number): void {
        const key = this.hash(query);
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttl ?? this.defaultTTL,
        });
    }

    clear(): void {
        this.cache.clear();
    }

    /** Remove expirados. Útil para evitar crescimento ilimitado. */
    prune(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > entry.ttl) this.cache.delete(key);
        }
    }

    private hash(query: string): string {
        const normalized = normalizeQuery(query);
        let h = 0;
        for (let i = 0; i < normalized.length; i++) {
            h = ((h << 5) - h) + normalized.charCodeAt(i);
            h |= 0;
        }
        return h.toString(36);
    }
}

/** Singleton do cache de geocodificação. */
export const geocodeCache = new GeocodeCache();
