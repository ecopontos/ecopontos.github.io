interface CacheEntry {
    data: unknown[];
    timestamp: number;
    ttl: number;
}

export class VisualQueryCache {
    private cache = new Map<string, CacheEntry>();
    private defaultTTL = 30000;

    get(sql: string, params: unknown[]): unknown[] | null {
        const key = this.hash(sql, params);
        const entry = this.cache.get(key);

        if (!entry) return null;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    set(sql: string, params: unknown[], data: unknown[], ttl?: number): void {
        const key = this.hash(sql, params);
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttl ?? this.defaultTTL,
        });
    }

    invalidate(moduleId: string): void {
        for (const [key] of this.cache) {
            if (key.includes(moduleId)) {
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }

    private hash(sql: string, params: unknown[]): string {
        let h = 0;
        const s = sql + JSON.stringify(params);
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return h.toString(36);
    }
}
