import { describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { LanDomainSyncService } from '../LanDomainSyncService';
import type { LanFileStorage, LanIndex } from '../../storage/LanFileStorage';

if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
}

function makeLan() {
    let index: LanIndex | null = null;
    const writes: Array<{ path: string; data: unknown }> = [];

    const lan = {
        getLanPath: vi.fn(async () => '/tmp/lan'),
        readIndex: vi.fn(async () => index),
        writeJson: vi.fn(async (path: string, data: unknown) => {
            writes.push({ path, data });
        }),
        updateIndex: vi.fn(async (_domain: string, entityId: string, v: number, hash: string, lastEventId: string) => {
            index = {
                last_entity_uuid: entityId,
                entities: { [entityId]: { v, hash, last_event_id: lastEventId } },
            };
        }),
        listUsersFromLan: vi.fn(async () => []),
        readJson: vi.fn(async () => null),
    } as unknown as LanFileStorage;

    return { lan, writes };
}

describe('LanDomainSyncService', () => {
    it('uses stable JSON hashing so key order does not republish snapshots', async () => {
        const { lan, writes } = makeLan();
        const service = new LanDomainSyncService(lan);

        await service.syncEntity('usuarios', 'user-1', { id: 'user-1', nome: 'A', perfil: 'operador' });
        await service.syncEntity('usuarios', 'user-1', { perfil: 'operador', nome: 'A', id: 'user-1' });

        expect(writes).toHaveLength(1);
        expect(lan.updateIndex).toHaveBeenCalledTimes(1);
    });
});
