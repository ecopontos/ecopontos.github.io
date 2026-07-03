/**
 * Fila client-side de rate-limit (Fase 2 — georreferenciamento).
 * Garante no mínimo `minIntervalMs` entre inícios de execuções consecutivas,
 * respeitando a política de 1 req/s do Nominatim.
 *
 * Simples, determinístico e testável com `vi.useFakeTimers`.
 */

interface Pending {
    resolve: (waitMs: number) => void;
}

export interface RateLimiter {
    /** Reserva um slot; resolve com o tempo (ms) aguardado. */
    acquire(): Promise<number>;
    /** Executa `fn` após adquirir o slot. */
    run<T>(fn: () => Promise<T>): Promise<T>;
    /** Reseta o estado interno (útil em testes). */
    reset(): void;
}

export function createRateLimiter(minIntervalMs: number): RateLimiter {
    let lastStart = 0;
    const queue: Pending[] = [];
    let running = false;

    const tick = () => {
        if (running || queue.length === 0) return;
        const now = Date.now();
        const elapsed = now - lastStart;
        const wait = Math.max(0, minIntervalMs - elapsed);
        if (wait > 0) {
            setTimeout(tick, wait);
            return;
        }
        running = true;
        lastStart = Date.now();
        const pending = queue.shift()!;
        pending.resolve(0);
    };

    return {
        acquire() {
            return new Promise<number>((resolve) => {
                queue.push({ resolve });
                tick();
            }).finally(() => {
                running = false;
                if (queue.length > 0) tick();
            });
        },
        async run<T>(fn: () => Promise<T>): Promise<T> {
            await this.acquire();
            return fn();
        },
        reset() {
            queue.length = 0;
            lastStart = 0;
            running = false;
        },
    };
}

/** Singleton do rate-limit do Nominatim (1 req/s). */
export const nominatimLimiter = createRateLimiter(1000);
