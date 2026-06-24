import { describe, it, expect } from 'vitest';
import { uuidv7 } from 'ecoforms-core';

describe('uuidv7', () => {
    const UUIDV7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it('gera string UUID v7 válida', () => {
        const id = uuidv7();
        expect(id).toMatch(UUIDV7_REGEX);
    });

    it('gera IDs únicos consecutivamente', () => {
        const ids = new Set(Array.from({ length: 100 }, () => uuidv7()));
        expect(ids.size).toBe(100);
    });

    it('IDs com timestamps diferentes são ordenáveis lexicograficamente', async () => {
        const early = uuidv7();
        await new Promise(r => setTimeout(r, 5));
        const late = uuidv7();
        expect(early < late).toBe(true);
    });
});
