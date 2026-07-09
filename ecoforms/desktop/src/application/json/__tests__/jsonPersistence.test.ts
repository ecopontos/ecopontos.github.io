import { describe, expect, it } from 'vitest';
import {
    getPersistedFormFields,
    parsePersistedJson,
    parsePersistedJsonRecord,
} from '../jsonPersistence';

describe('jsonPersistence', () => {
    it('parses plain persisted JSON values', () => {
        expect(parsePersistedJson('{"a":1}')).toEqual({ a: 1 });
        expect(parsePersistedJson('[1,2]')).toEqual([1, 2]);
    });

    it('parses double-encoded JSON values used by some legacy rows', () => {
        expect(parsePersistedJson('"{\\"a\\":1}"')).toEqual({ a: 1 });
    });

    it('returns null for invalid JSON strings', () => {
        expect(parsePersistedJson('{invalid')).toBeNull();
    });

    it('returns only object records for record parser', () => {
        expect(parsePersistedJsonRecord('{"a":1}')).toEqual({ a: 1 });
        expect(parsePersistedJsonRecord('[1,2]')).toBeNull();
        expect(parsePersistedJsonRecord('"texto"')).toBeNull();
    });

    it('extracts only object form fields', () => {
        expect(getPersistedFormFields({
            campos: [{ id: 'a' }, null, 'x', { id: 'b' }],
        })).toEqual([{ id: 'a' }, { id: 'b' }]);
    });
});
