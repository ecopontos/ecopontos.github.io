import type { ClockPort } from '../../application/ports/ClockPort';

export class FixedClock implements ClockPort {
    private current: Date;

    constructor(iso: string = '2026-04-24T12:00:00.000Z') {
        this.current = new Date(iso);
    }

    now(): Date {
        return new Date(this.current);
    }

    nowIso(): string {
        return this.current.toISOString();
    }

    advance(ms: number): void {
        this.current = new Date(this.current.getTime() + ms);
    }
}
