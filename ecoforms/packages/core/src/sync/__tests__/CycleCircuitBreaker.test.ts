import { describe, it, expect } from 'vitest';
import { CycleCircuitBreaker } from '../CycleCircuitBreaker';

describe('CycleCircuitBreaker', () => {
    function createBreaker(failureThreshold = 5, successReset = 3, baseCooldown = 30000) {
        return new CycleCircuitBreaker({
            failureThreshold,
            resetSuccessCount: successReset,
            baseCooldownMs: baseCooldown,
        });
    }

    describe('estado NORMAL', () => {
        it('inicia em NORMAL', () => {
            const cb = createBreaker();
            expect(cb.state).toBe('normal');
        });

        it('canSync retorna true em NORMAL', () => {
            const cb = createBreaker();
            expect(cb.canSync()).toBe(true);
        });

        it('recordSuccess mantém NORMAL', () => {
            const cb = createBreaker();
            cb.recordSuccess();
            expect(cb.state).toBe('normal');
        });

        it('atinge COOLDOWN após failureThreshold falhas', () => {
            const cb = createBreaker(3);
            cb.recordFailure();
            cb.recordFailure();
            expect(cb.state).toBe('normal');
            cb.recordFailure();
            expect(cb.state).toBe('cooldown');
        });
    });

    describe('estado COOLDOWN', () => {
        it('canSync retorna false quando em cooldown ativo', () => {
            const cb = createBreaker(2);
            cb.recordFailure();
            cb.recordFailure();
            expect(cb.state).toBe('cooldown');
            expect(cb.canSync()).toBe(false);
        });
    });

    describe('forceReset', () => {
        it('forceReset de qualquer estado volta para NORMAL', () => {
            const cb = createBreaker(2);
            cb.recordFailure();
            cb.recordFailure();
            expect(cb.state).toBe('cooldown');

            cb.forceReset();
            expect(cb.state).toBe('normal');
            expect(cb.canSync()).toBe(true);
        });

        it('forceReset zera contadores', () => {
            const cb = createBreaker(3);
            cb.recordFailure();
            cb.recordFailure();

            cb.forceReset();
            cb.recordFailure();
            expect(cb.state).toBe('normal');
        });
    });

    describe('limites', () => {
        it('cooldown não excede maxCooldownMs', () => {
            const cb = createBreaker(1, 1, 30000);
            cb.recordFailure();
            expect(cb.cooldownMs).toBeLessThanOrEqual(300000);
        });
    });
});
