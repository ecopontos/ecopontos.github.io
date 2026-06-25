import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadScript(relativePath) {
    const fullPath = path.resolve(__dirname, relativePath);
    if (fs.existsSync(fullPath)) {
        eval(fs.readFileSync(fullPath, 'utf-8'));
    }
}

// Load utility dependencies
loadScript('../www/js/utils/safe-json.js');
loadScript('../www/js/utils/uuid.js');
loadScript('../www/js/utils/date-utils.js');
loadScript('../www/js/utils/professional-jsonb-builder.js');

// Load module dependencies
loadScript('../www/js/persistence/FormStore.js');
loadScript('../www/js/sync/FormSyncService.js');
loadScript('../www/js/services/FileUploadService.js');
loadScript('../www/js/domain/EcopontoService.js');
loadScript('../www/js/services/SchemaCacheService.js');

// Load DataService (facade)
loadScript('../www/js/data-service.js');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRecord(overrides = {}) {
    return {
        id: 'rec-1',
        formId: 'form-a',
        syncStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dados: { campo: 'valor' },
        ...overrides,
    };
}

function makeFakeDb(storeData = {}) {
    const data = { ...storeData };
    const store = {
        _data: data,
        get(key) {
            return promiseRequest(data[key] ?? null);
        },
        put(value) {
            const k = value.id || value.recordUUID || value.uuid;
            data[k] = value;
            return promiseRequest(k);
        },
        getAll() {
            return promiseRequest(Object.values(data));
        },
        index() {
            return {
                getAll(query) {
                    const vals = Object.values(data).filter(
                        v => !query || v.syncStatus === query
                    );
                    return promiseRequest(vals);
                },
            };
        },
        delete(key) {
            delete data[key];
            return promiseRequest(undefined);
        },
    };

    return {
        _store: store,
        transaction(_, __) {
            const tx = {
                objectStore: () => store,
                oncomplete: null,
                onerror: null,
            };
            setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
            return tx;
        },
    };
}

function promiseRequest(result) {
    const req = { result, onsuccess: null, onerror: null };
    setTimeout(() => req.onsuccess && req.onsuccess({ target: req }), 0);
    return req;
}

// ── detectAndResolveConflict (pure logic, no DB) ──────────────────────────────

describe('DataService.detectAndResolveConflict — LWW', () => {
    let ds;

    beforeEach(() => {
        ds = new DataService();
    });

    it('retorna no_remote quando remoto é null', () => {
        const result = ds.detectAndResolveConflict(makeRecord(), null);
        expect(result.hasConflict).toBe(false);
        expect(result.winner).toBe('local');
        expect(result.strategy).toBe('no_remote');
    });

    it('local mais recente ganha (diff > 5s)', () => {
        const local = makeRecord({ updatedAt: new Date(Date.now()).toISOString() });
        const remote = { updated_at: new Date(Date.now() - 10000).toISOString(), dados: {} };
        const result = ds.detectAndResolveConflict(local, remote);
        expect(result.winner).toBe('local');
        expect(result.strategy).toBe('last_write_wins');
    });

    it('remoto mais recente ganha (diff > 5s)', () => {
        const local = makeRecord({ updatedAt: new Date(Date.now() - 10000).toISOString() });
        const remote = { updated_at: new Date(Date.now()).toISOString(), dados: {} };
        const result = ds.detectAndResolveConflict(local, remote);
        expect(result.winner).toBe('remote');
        expect(result.strategy).toBe('last_write_wins');
    });

    it('timestamps iguais com conteúdo idêntico — sem conflito', () => {
        const ts = new Date().toISOString();
        const dados = { campo: 'x' };
        const local = makeRecord({ updatedAt: ts, dados });
        const remote = { updated_at: ts, dados };
        const result = ds.detectAndResolveConflict(local, remote);
        expect(result.hasConflict).toBe(false);
        expect(result.strategy).toBe('identical_content');
    });

    it('timestamps próximos com conteúdo diferente — local ganha (operador em campo)', () => {
        const ts = new Date().toISOString();
        const local = makeRecord({ updatedAt: ts, dados: { campo: 'local' } });
        const remote = { updated_at: ts, dados: { campo: 'remoto' } };
        const result = ds.detectAndResolveConflict(local, remote);
        expect(result.winner).toBe('local');
        expect(result.strategy).toBe('content_hash_tiebreak');
    });
});

// ── _quickHash ────────────────────────────────────────────────────────────────

describe('DataService._quickHash', () => {
    let ds;

    beforeEach(() => {
        ds = new DataService();
    });

    it('retorna string hex', () => {
        const h = ds._quickHash('hello');
        expect(typeof h).toBe('string');
        expect(/^[0-9a-f]+$/.test(h)).toBe(true);
    });

    it('mesmo input → mesmo hash', () => {
        expect(ds._quickHash('abc')).toBe(ds._quickHash('abc'));
    });

    it('inputs diferentes → hashes diferentes', () => {
        expect(ds._quickHash('abc')).not.toBe(ds._quickHash('xyz'));
    });
});

// ── updateSyncStatus ──────────────────────────────────────────────────────────

describe('DataService.updateSyncStatus', () => {
    let ds;
    let recordId;

    beforeEach(async () => {
        ds = new DataService();
        await ds.init();
        recordId = await ds.store.save(makeRecord({ id: undefined, syncStatus: 'pending' }));
    });

    afterEach(() => { ds.store.db.close(); });

    it('atualiza syncStatus do registro', async () => {
        await ds.updateSyncStatus(recordId, 'synced');
        const stored = await ds.store.getById(recordId);
        expect(stored.syncStatus).toBe('synced');
    });
});

// ── getPendingSync ────────────────────────────────────────────────────────────

describe('DataService.getPendingSync', () => {
    let ds;

    beforeEach(async () => {
        ds = new DataService();
        await ds.init();
        await ds.store.save(makeRecord({ id: undefined, syncStatus: 'pending' }));
        await ds.store.save(makeRecord({ id: undefined, syncStatus: 'synced' }));
        await ds.store.save(makeRecord({ id: undefined, syncStatus: 'pending' }));
    });

    afterEach(() => { ds.store.db.close(); });

    it('retorna apenas registros com syncStatus pending', async () => {
        const pending = await ds.getPendingSync();
        const statuses = pending.map(r => r.syncStatus);
        expect(statuses.every(s => s === 'pending')).toBe(true);
        expect(pending.length).toBe(2);
    });
});
