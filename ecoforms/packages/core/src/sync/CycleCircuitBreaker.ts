export const BreakerState = {
    NORMAL: 'normal',
    COOLDOWN: 'cooldown',
    PROBE: 'probe',
} as const;

export type BreakerStateType = typeof BreakerState[keyof typeof BreakerState];

interface CycleCircuitBreakerOptions {
    failureThreshold?: number;
    baseCooldownMs?: number;
    maxCooldownMs?: number;
    resetSuccessCount?: number;
}

export class CycleCircuitBreaker {
    private _state: BreakerStateType = BreakerState.NORMAL;
    private _failureCount = 0;
    private _successStreak = 0;
    private _currentCooldownMs: number;
    private _cooldownUntil = 0;
    private _lastTransition = Date.now();

    readonly failureThreshold: number;
    readonly baseCooldownMs: number;
    readonly maxCooldownMs: number;
    readonly resetSuccessCount: number;

    constructor(opts: CycleCircuitBreakerOptions = {}) {
        this.failureThreshold = opts.failureThreshold ?? 5;
        this.baseCooldownMs = opts.baseCooldownMs ?? 30000;
        this.maxCooldownMs = opts.maxCooldownMs ?? 300000;
        this.resetSuccessCount = opts.resetSuccessCount ?? 3;
        this._currentCooldownMs = this.baseCooldownMs;
    }

    get state(): BreakerStateType { return this._state; }
    get failureCount(): number { return this._failureCount; }
    get cooldownMs(): number { return this._currentCooldownMs; }

    canSync(): boolean {
        const now = Date.now();

        switch (this._state) {
            case BreakerState.NORMAL:
                return true;
            case BreakerState.COOLDOWN:
                if (now >= this._cooldownUntil) {
                    this._transitionTo(BreakerState.PROBE);
                    return true;
                }
                return false;
            case BreakerState.PROBE:
                return true;
            default:
                return true;
        }
    }

    recordSuccess(): void {
        this._failureCount = 0;

        if (this._state === BreakerState.PROBE) {
            this._successStreak++;
            if (this._successStreak >= this.resetSuccessCount) {
                this._currentCooldownMs = this.baseCooldownMs;
                this._transitionTo(BreakerState.NORMAL);
            }
        } else if (this._state === BreakerState.NORMAL) {
            this._successStreak++;
            if (this._successStreak >= this.resetSuccessCount && this._currentCooldownMs > this.baseCooldownMs) {
                this._currentCooldownMs = Math.max(this.baseCooldownMs, this._currentCooldownMs / 2);
            }
        }
    }

    recordFailure(): void {
        this._successStreak = 0;
        this._failureCount++;

        if (this._state === BreakerState.PROBE) {
            this._currentCooldownMs = Math.min(this.maxCooldownMs, this._currentCooldownMs * 2);
            this._transitionTo(BreakerState.COOLDOWN);
            return;
        }

        if (this._failureCount >= this.failureThreshold) {
            this._transitionTo(BreakerState.COOLDOWN);
        }
    }

    forceReset(): void {
        this._failureCount = 0;
        this._successStreak = 0;
        this._currentCooldownMs = this.baseCooldownMs;
        this._transitionTo(BreakerState.NORMAL);
    }

    remainingCooldownMs(): number {
        if (this._state !== BreakerState.COOLDOWN) return 0;
        return Math.max(0, this._cooldownUntil - Date.now());
    }

    private _transitionTo(newState: BreakerStateType): void {
        const prev = this._state;
        this._state = newState;
        this._lastTransition = Date.now();

        if (newState === BreakerState.COOLDOWN) {
            this._cooldownUntil = Date.now() + this._currentCooldownMs;
        }

        if (prev !== newState) {
            console.log(`[CycleCircuitBreaker] ${prev} → ${newState} (failures: ${this._failureCount}, cooldown: ${this._currentCooldownMs}ms)`);
        }
    }
}
