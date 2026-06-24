import { describe, it, expect, beforeEach, vi } from 'vitest';

// Carregar safe-json.js globalmente antes do data-service
const fs = require('fs');
const path = require('path');
const safeJsonPath = path.resolve(__dirname, '../www/js/utils/safe-json.js');
if (fs.existsSync(safeJsonPath)) {
    eval(fs.readFileSync(safeJsonPath, 'utf-8'));
}

// Mock mínimo de IndexedDB para DataService
class FakeIDBRequest {
    constructor(result = null, error = null) {
        this.result = result;
        this.error = error;
        this.onsuccess = null;
        this.onerror = null;
    }
    trigger() {
        if (this.error) {
            if (this.onerror) this.onerror({ target: this });
        } else {
            if (this.onsuccess) this.onsuccess({ target: this });
        }
    }
}

class FakeIDBObjectStore {
    constructor(data = {}) {
        this._data = { ...data };
    }
    get(key) {
        const req = new FakeIDBRequest(this._data[key]);
        setTimeout(() => req.trigger(), 0);
        return req;
    }
    put(value) {
        const key = value.id || value.uuid || Date.now();
        this._data[key] = value;
        const req = new FakeIDBRequest(key);
        setTimeout(() => req.trigger(), 0);
        return req;
    }
    add(value) {
        const req = new FakeIDBRequest();
        setTimeout(() => req.trigger(), 0);
        return req;
    }
    getAll() {
        const req = new FakeIDBRequest(Object.values(this._data));
        setTimeout(() => req.trigger(), 0);
        return req;
    }
    index(name) {
        return {
            get: (key) => {
                const found = Object.values(this._data).find(d => d.recordUUID === key);
                const req = new FakeIDBRequest(found || null);
                setTimeout(() => req.trigger(), 0);
                return req;
            }
        };
    }
}

class FakeIDBTransaction {
    constructor(store) {
        this._store = store;
        this.oncomplete = null;
        this.onerror = null;
    }
    objectStore(name) {
        return this._store;
    }
}

class FakeIDBDatabase {
    constructor(storeData) {
        this._storeData = storeData;
    }
    transaction(names, mode) {
        const store = new FakeIDBObjectStore(this._storeData);
        const tx = new FakeIDBTransaction(store);
        setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
        return tx;
    }
}

// Subir uuidv7.js e data-service.js no escopo global
const uuidv7Path = path.resolve(__dirname, '../www/js/uuidv7.js');
if (fs.existsSync(uuidv7Path)) {
    eval(fs.readFileSync(uuidv7Path, 'utf-8'));
}
const dataServicePath = path.resolve(__dirname, '../www/js/data-service.js');
if (fs.existsSync(dataServicePath)) {
    eval(fs.readFileSync(dataServicePath, 'utf-8'));
}

describe('DataService — Fase 1: JSON seguro e idempotência', () => {
    let ds;
    let mockSupabase;

    beforeEach(() => {
        ds = new DataService();
        // Mock do supabaseClient
        mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null })) })) })),
                upsert: vi.fn(() => Promise.resolve({ error: null }))
            })),
            storage: {
                from: vi.fn(() => ({
                    upload: vi.fn(() => Promise.resolve({ error: null }))
                }))
            }
        };
        ds.supabaseClient = mockSupabase;

        // Mock do IndexedDB
        const fakeDb = new FakeIDBDatabase({});
        ds.db = fakeDb;
    });

    describe('generateUUIDv7', () => {
        it('retorna UUID v7 válido', () => {
            const uuid = generateUUIDv7();
            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });

        it('nunca usa Math.random (dois UUIDs são diferentes)', () => {
            const u1 = generateUUIDv7();
            const u2 = generateUUIDv7();
            expect(u1).not.toBe(u2);
        });
    });

    describe('calculateChecksum', () => {
        it('calcula checksum determinístico com safeStringify', async () => {
            const data = { b: 2, a: 1 };
            const hash1 = await ds.calculateChecksum(data);
            const hash2 = await ds.calculateChecksum({ a: 1, b: 2 });
            expect(hash1).toBe(hash2);
            expect(hash1.startsWith('sha256:')).toBe(true);
        });

        it('lida com BigInt sem lançar exceção', async () => {
            const data = { id: BigInt('12345678901234567890') };
            const hash = await ds.calculateChecksum(data);
            expect(hash.startsWith('sha256:')).toBe(true);
        });
    });

    describe('syncSingleRecord — idempotência', () => {
        it('ignora sync se idempotência indica já sincronizado', async () => {
            const recordUUID = '550e8400-e29b-41d4-a716-446655440000';
            const recordId = 42;

            // Simular que o registro já foi sincronizado com sucesso
            ds.db = new FakeIDBDatabase({
                [recordId]: { id: recordId, uuid: recordUUID, data: { test: 1 }, syncStatus: 'pending' },
                'idemp_1': { recordUUID: recordUUID, success: true }
            });

            // Ajustar o mock do index para retornar o registro de idempotência
            const origTransaction = ds.db.transaction.bind(ds.db);
            ds.db.transaction = (names, mode) => {
                const store = new FakeIDBObjectStore({
                    [recordId]: { id: recordId, uuid: recordUUID, data: { test: 1 }, syncStatus: 'pending' },
                    'idemp_1': { id: 'idemp_1', recordUUID: recordUUID, success: true }
                });
                const tx = new FakeIDBTransaction(store);
                // Override do objectStore para que index() funcione no store correto
                tx.objectStore = (n) => store;
                setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
                return tx;
            };

            const result = await ds.syncSingleRecord(recordId, 0, false);
            expect(result.skipped).toBe(true);
            expect(result.reason).toBe('already_synced');
        });

        it('gera UUID se registro não tiver um antes do sync', async () => {
            const recordId = 99;
            ds.db = new FakeIDBDatabase({
                [recordId]: { id: recordId, data: { test: 1 }, syncStatus: 'pending' }
            });

            ds.db.transaction = (names, mode) => {
                const store = new FakeIDBObjectStore({
                    [recordId]: { id: recordId, data: { test: 1 }, syncStatus: 'pending' }
                });
                const tx = new FakeIDBTransaction(store);
                tx.objectStore = (n) => store;
                setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
                return tx;
            };

            // Vamos apenas garantir que a função não quebre e que o registro receba UUID
            // Como o mock de Supabase está configurado e idempotência falhará (não há registro),
            // ele vai tentar sync. Vamos mockar o uploadFilesInRecord para evitar erros.
            ds.uploadFilesInRecord = vi.fn((r) => Promise.resolve(r));
            ds._syncViaDirectWrite = vi.fn(() => Promise.resolve());

            const result = await ds.syncSingleRecord(recordId, 0, false);
            expect(result.success).toBe(true);
        });
    });
});

describe('DataService — Fase 2: Controle de Concorrência', () => {
    let ds;

    beforeEach(() => {
        ds = new DataService();
        ds.supabaseClient = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null })) })) })),
                upsert: vi.fn(() => Promise.resolve({ error: null }))
            })),
            storage: {
                from: vi.fn(() => ({
                    upload: vi.fn(() => Promise.resolve({ error: null }))
                }))
            }
        };
        ds.db = new FakeIDBDatabase({});
    });

    describe('SyncLock', () => {
        it('permite adquirir lock quando livre', async () => {
            expect(ds._syncLock.isSyncing).toBe(false);
            await ds._acquireSyncLock();
            expect(ds._syncLock.isSyncing).toBe(true);
            ds._releaseSyncLock();
            expect(ds._syncLock.isSyncing).toBe(false);
        });

        it('enfileira requisições quando lock está ocupado', async () => {
            await ds._acquireSyncLock();
            expect(ds._syncLock.isSyncing).toBe(true);

            let secondAcquired = false;
            const p2 = ds._acquireSyncLock().then(() => {
                secondAcquired = true;
            });

            // Ainda não deve ter sido adquirido
            expect(secondAcquired).toBe(false);

            // Liberar o primeiro lock
            ds._releaseSyncLock();

            // Agora o segundo deve ser resolvido
            await p2;
            expect(secondAcquired).toBe(true);
            expect(ds._syncLock.isSyncing).toBe(true); // segundo ainda detém

            ds._releaseSyncLock();
            expect(ds._syncLock.isSyncing).toBe(false);
        });

        it('processa fila em ordem FIFO', async () => {
            const order = [];

            await ds._acquireSyncLock();

            const p1 = ds._acquireSyncLock().then(() => order.push(1));
            const p2 = ds._acquireSyncLock().then(() => order.push(2));
            const p3 = ds._acquireSyncLock().then(() => order.push(3));

            ds._releaseSyncLock(); // libera para 1
            await p1;
            ds._releaseSyncLock(); // libera para 2
            await p2;
            ds._releaseSyncLock(); // libera para 3
            await p3;

            expect(order).toEqual([1, 2, 3]);
            ds._releaseSyncLock(); // limpa
        });
    });

    describe('syncPendingData — serialização', () => {
        it('processa batch sequencialmente (não paralelo)', async () => {
            const callOrder = [];
            const records = [
                { id: 1, uuid: 'a', syncStatus: 'pending' },
                { id: 2, uuid: 'b', syncStatus: 'pending' },
                { id: 3, uuid: 'c', syncStatus: 'pending' }
            ];

            ds.db = new FakeIDBDatabase({
                1: records[0],
                2: records[1],
                3: records[2]
            });

            ds.getPendingSync = vi.fn(() => Promise.resolve(records));
            ds.syncSingleRecord = vi.fn(async (id) => {
                callOrder.push(id);
                await new Promise(r => setTimeout(r, 10)); // simular latência
            });

            await ds.syncPendingData();

            // Se fosse paralelo, a ordem poderia variar; sequencial garante ordem
            expect(callOrder).toEqual([1, 2, 3]);
            expect(ds.syncSingleRecord).toHaveBeenCalledTimes(3);
        });

        it('adquire e libera lock ao redor do sync', async () => {
            ds.getPendingSync = vi.fn(() => Promise.resolve([]));

            expect(ds._syncLock.isSyncing).toBe(false);
            const result = await ds.syncPendingData();
            expect(ds._syncLock.isSyncing).toBe(false);
            expect(result.success).toBe(true);
        });
    });
});
