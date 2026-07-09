import { describe, expect, it } from 'vitest';
import {
    parseJsonWithValidator,
    validateExpectedUsersSeed,
    validateLanIndex,
    validateOrgConfig,
    validateUserSummary,
} from '../LanJsonCodecs';

describe('LanJsonCodecs', () => {
    it('accepts canonical LAN index', () => {
        expect(validateLanIndex({
            last_entity_uuid: 'user-2',
            entities: {
                'user-1': { v: 1, hash: 'abc', last_event_id: 'evt-1' },
                'user-2': { v: 2, hash: 'def', last_event_id: 'evt-2' },
            },
        })).toBe(true);
    });

    it('rejects malformed LAN index entries', () => {
        expect(validateLanIndex({
            last_entity_uuid: 'user-1',
            entities: { 'user-1': { v: -1, hash: '', last_event_id: 'evt-1' } },
        })).toBe(false);
    });

    it('accepts expected users seed with optional fields', () => {
        expect(validateExpectedUsersSeed({
            version: 1,
            created_at: '2026-06-15T12:00:00.000Z',
            users: [{
                id: 'user-1',
                nome: 'Usuário',
                username: 'usuario',
                password: 'senha',
                perfil: 'operador',
                setor: 'setor-1',
                ativo: true,
            }],
        })).toBe(true);
    });

    it('rejects expected users seed without required credentials', () => {
        expect(validateExpectedUsersSeed({
            version: 1,
            created_at: '2026-06-15T12:00:00.000Z',
            users: [{ nome: 'Usuário', username: 'usuario', perfil: 'operador' }],
        })).toBe(false);
    });

    it('accepts user summary snapshots without credentials', () => {
        expect(validateUserSummary({
            nome: 'Usuário',
            username: 'usuario',
            perfil: 'campo',
            setor: 'setor-1',
        })).toBe(true);
    });

    it('rejects org_config with invalid setor shape', () => {
        expect(validateOrgConfig({
            org_id: 'org-1',
            org_nome: 'Org',
            updated_at: '2026-06-15T12:00:00.000Z',
            setores: [{ id: 'setor-1', nome: 'Setor', ativo: 1 }],
        })).toBe(false);
    });

    it('parses JSON only when validator accepts the shape', () => {
        const valid = parseJsonWithValidator(JSON.stringify({
            org_id: 'org-1',
            org_nome: 'Org',
            updated_at: '2026-06-15T12:00:00.000Z',
            setores: [{ id: 'setor-1', nome: 'Setor', ativo: true }],
        }), validateOrgConfig);

        const invalid = parseJsonWithValidator('{"org_id":"org-1"}', validateOrgConfig);

        expect(valid?.org_id).toBe('org-1');
        expect(invalid).toBeNull();
    });
});
