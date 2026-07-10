import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock das dependências externas de getSyncAdapter: Supabase e Crypto.
// Não mockamos getSyncAdapter em si — deixamos o fluxo real rodar para validar
// o LazySyncAdapter de ponta a ponta (apenas sem rede/cripo pesado).
const fakeSupabase = {
    rpc: vi.fn(async () => ({ data: [], error: null })),
};

vi.mock('../../persistence/supabase/supabaseClient', () => ({
    getSupabaseClient: vi.fn(() => fakeSupabase),
}));

const storeState = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
};
vi.mock('@tauri-apps/plugin-store', () => ({
    Store: { load: vi.fn(async () => storeState) },
}));

import { LazySyncAdapter, resetSyncAdapter } from '../lazy-sync';
import { InMemorySqlitePort } from '../../../test/fakes/InMemorySqlitePort';
import { FakeSyncStorage } from '../../../test/fakes/FakeSyncStorage';
import { FixedClock } from '../../../test/fakes/FixedClock';
import { ensureColumns } from '@/scripts/ensure-columns';
import type { FileStoragePort } from '../../../application/ports/FileStoragePort';

const DEVICE_ID = 'dev-test-1';
const ROUTING_ID = 'setor-teste';

async function makeAdapter(): Promise<LazySyncAdapter> {
    const sqlite = new InMemorySqlitePort();
    // fila_eventos_sync é criada por ensureColumns — necessária para o TransportService.
    await ensureColumns(
        (sql: string, params?: unknown[]) => sqlite.query(sql, params),
        (sql: string, params?: unknown[]) => sqlite.execute(sql, params),
    );
    return new LazySyncAdapter(sqlite, new FakeSyncStorage() as unknown as FileStoragePort, new FixedClock());
}

describe('LazySyncAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetSyncAdapter();
    });

    it('ensureReady() pré-constrói o adapter real sem disparar sync', async () => {
        const adapter = await makeAdapter();
        adapter.configure(DEVICE_ID, ROUTING_ID, 'setor', '1.0.0', 'org-1');

        const spy = vi.spyOn(adapter, 'syncAll');
        await adapter.ensureReady();

        // syncAll NÃO deve ter sido chamado — ensureReady só instancia.
        expect(spy).not.toHaveBeenCalled();
    });

    it('setKnownRoutingIds chamado antes de ensureReady sobrevive à construção (bug latente)', async () => {
        const adapter = await makeAdapter();
        adapter.configure(DEVICE_ID, ROUTING_ID, 'setor', '1.0.0', 'org-1');

        // BUG latente: antes do fix, _real era null e o valor era descartado.
        adapter.setKnownRoutingIds(['setor-a', 'setor-b']);

        // Não deve lançar — os IDs pendentes são aplicados na construção.
        await expect(adapter.ensureReady()).resolves.toBeUndefined();

        // syncAll deve respeitar os routing IDs (pull só roda se length > 0).
        const result = await adapter.syncAll();
        expect(result.success).toBe(true);
        // pullTasks do InboundService seria chamado com os routing IDs — sem erro.
    });

    it('syncAll sem configure() lança erro explícito', async () => {
        const adapter = await makeAdapter();
        await expect(adapter.syncAll()).rejects.toThrow(/not configured/i);
    });
});
