import { describe, it, expect, beforeEach, vi } from 'vitest';

// CryptoLayer deriva a chave em memória e limpa o legado raw-key best-effort.
const storeState = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
};

vi.mock('@tauri-apps/plugin-store', () => ({
    Store: {
        load: vi.fn(async () => storeState),
    },
}));

vi.mock('ecoforms-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('ecoforms-core')>();
    let counter = 0;
    return {
        ...actual,
        uuidv7: () => `test-uuid-${++counter}`,
        stableStringify: (obj: unknown) => JSON.stringify(obj),
    };
});
import { CryptoLayer } from '../CryptoLayer';
import { ensureCryptoLayer, resetSyncAdapter } from '../lazy-sync';
import { TransportService } from '../TransportService';
import { InboundService } from '../InboundService';
import { createEnvelope, buildChecksum } from '../EventEnvelope';
import type { EcoFormsEventType, EventEnvelope } from '../EventEnvelope';
import { ensureColumns } from '@/scripts/ensure-columns';
import { migratePtBrIfNeeded } from '@/scripts/migrate-ptbr';
import { ModuleSyncHandler } from '../module/ModuleSyncHandler';
import { SqliteModuleRepository } from '../../persistence/sqlite/SqliteModuleRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import { InMemorySqlitePort } from '../../../test/fakes/InMemorySqlitePort';
import { FakeSyncEventIndex } from '../../../test/fakes/FakeSyncEventIndex';

// ─── helpers ─────────────────────────────────────────────────────────────────

const TEST_PASSWORD = 'senha-teste-1234';
const ROUTING_ID = 'setor-ambiente';
const DEVICE_ID = 'desktop-test-001';

async function makeCrypto(password = TEST_PASSWORD): Promise<CryptoLayer> {
    const crypto = new CryptoLayer();
    await crypto.deriveAndStoreKey(password, 'test-salt-001');
    return crypto;
}

function makeInfra(db?: InMemorySqlitePort, index?: FakeSyncEventIndex) {
    const sqlite = db ?? new InMemorySqlitePort();
    const idx = index ?? new FakeSyncEventIndex();
    return { sqlite, index: idx };
}

// ─── TransportService ─────────────────────────────────────────────────────────

describe('TransportService', () => {
    let crypto: CryptoLayer;
    let sqlite: InMemorySqlitePort;
    let index: FakeSyncEventIndex;
    let transport: TransportService;

    beforeEach(async () => {
        crypto = await makeCrypto();
        ({ sqlite, index } = makeInfra());
        transport = new TransportService(crypto, sqlite, index, ROUTING_ID, DEVICE_ID);
    });

    it('publish() enfileira evento com seq=1 e status=pending', async () => {
        await transport.publish({ type: 'task.criada', data: { id: 't1', titulo: 'Teste' } });

        const queue = sqlite.getTable('fila_eventos_sync');
        expect(queue).toHaveLength(1);
        expect(queue[0].status).toBe('pending');
        expect(queue[0].seq).toBe(1);
        expect(queue[0].type).toBe('task.criada');
    });

    it('publish() incrementa seq a cada evento', async () => {
        await transport.publish({ type: 'task.criada', data: { id: 't1' } });
        await transport.publish({ type: 'task.concluida', data: { tarefa_id: 't1' } });

        const queue = sqlite.getTable('fila_eventos_sync');
        expect(queue[0].seq).toBe(1);
        expect(queue[1].seq).toBe(2);
    });

    it('publish() encadeia eventos pendentes com prev_event_id antes do push', async () => {
        await transport.publish({ type: 'task.criada', data: { id: 't1' } });
        await transport.publish({ type: 'task.concluida', data: { tarefa_id: 't1' } });

        const queue = sqlite.getTable('fila_eventos_sync');
        const first = JSON.parse(queue[0].payload as string) as EventEnvelope;
        const second = JSON.parse(queue[1].payload as string) as EventEnvelope;
        expect(first.prev_event_id).toBeNull();
        expect(second.prev_event_id).toBe(first.id);
    });

    it('publish() rejeita envelope sem data estruturado', async () => {
        await expect(
            transport.publish({ type: 'task.criada', data: null }),
        ).rejects.toThrow('Invalid EventEnvelope');

        expect(sqlite.getTable('fila_eventos_sync')).toHaveLength(0);
    });

    it('pushPending() envia o evento ao sync_event_index com o seq atribuído pelo servidor', async () => {
        await transport.publish({ type: 'task.criada', data: { id: 't1' } });
        const queue = sqlite.getTable('fila_eventos_sync');
        const eventId = queue[0].id as string;

        const result = await transport.pushPending();

        expect(result.sent).toBe(1);
        expect(result.failed).toBe(0);

        const rows = await index.pullEvents(ROUTING_ID, 0);
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(eventId);
        expect(rows[0].seq).toBe(1);
        expect(rows[0].routing_id).toBe(ROUTING_ID);
        expect(rows[0].device_id).toBe(DEVICE_ID);
    });

    it('pushPending() marca evento como sent após envio', async () => {
        await transport.publish({ type: 'task.criada', data: { id: 't1' } });
        await transport.pushPending();

        const queue = sqlite.getTable('fila_eventos_sync');
        expect(queue[0].status).toBe('sent');
    });

    it('pushPending() cifra o envelope e ele decifra de volta ao payload original', async () => {
        await transport.publish({
            type: 'task.criada',
            data: { id: 't1', titulo: 'Teste' },
            aggregate_type: 'task',
            aggregate_id: 't1',
        });
        await transport.pushPending();

        const rows = await index.pullEvents(ROUTING_ID, 0);
        const envelope = await crypto.decryptJson<EventEnvelope>(rows[0].payload_enc);
        expect(envelope.data).toEqual({ id: 't1', titulo: 'Teste' });
        expect(envelope.aggregate).toEqual({ type: 'task', id: 't1' });
    });

    it('pushPending() concorrente não duplica envio', async () => {
        await transport.publish({ type: 'task.criada', data: { id: 't1' } });

        const [r1, r2] = await Promise.all([
            transport.pushPending(),
            transport.pushPending(),
        ]);

        // Um dos dois vê o lock e retorna sem enviar — total de sent = 1
        expect(r1.sent + r2.sent).toBe(1);
        // Apenas 1 row deve existir no sync_event_index
        const rows = await index.pullEvents(ROUTING_ID, 0);
        expect(rows).toHaveLength(1);
    });
});

// ─── Crypto: formato de wire ──────────────────────────────────────────────────

describe('CryptoLayer — formato de wire', () => {
    beforeEach(() => {
        storeState.get.mockClear();
        storeState.set.mockClear();
        storeState.delete.mockClear();
        storeState.save.mockClear();
    });

    it('blob produzido tem nonce(12) || ciphertext — idêntico ao mobile', async () => {
        const crypto = await makeCrypto();
        const blob = await crypto.encrypt('hello world');

        // Os primeiros 12 bytes são o nonce (aleatório, mas não zero)
        const nonce = blob.slice(0, 12);
        const ciphertext = blob.slice(12);

        expect(nonce.length).toBe(12);
        expect(ciphertext.length).toBeGreaterThan(0);
        // ciphertext deve ser diferente do plaintext
        expect(Buffer.from(ciphertext).toString()).not.toBe('hello world');
    });

    it('encrypt → decrypt roundtrip com mesma chave', async () => {
        const crypto = await makeCrypto();
        const original = JSON.stringify({ tipo: 'task.criada', data: { id: 't1', titulo: 'Teste' } });

        const blob = await crypto.encrypt(original);
        const recovered = await crypto.decrypt(blob);

        expect(recovered).toBe(original);
    });

    it('chaves derivadas da mesma senha são compatíveis (simula desktop ↔ mobile)', async () => {
        const desktopCrypto = await makeCrypto(TEST_PASSWORD);
        const mobileCrypto = await makeCrypto(TEST_PASSWORD);

        const payload = { event: 'task.criada', id: 'abc' };
        const blob = await desktopCrypto.encryptJson(payload);
        const decoded = await mobileCrypto.decryptJson<typeof payload>(blob);

        expect(decoded).toEqual(payload);
    });

    it('deriveAndStoreKey não persiste a chave raw no store', async () => {
        const crypto = new CryptoLayer();
        await crypto.deriveAndStoreKey(TEST_PASSWORD, 'test-salt-001');

        expect(storeState.set).not.toHaveBeenCalled();
    });

    it('cold start exige novo login para recarregar a chave', async () => {
        const firstSession = await makeCrypto(TEST_PASSWORD);
        const blob = await firstSession.encrypt('segredo');

        const restarted = new CryptoLayer();
        await restarted.loadKey();

        await expect(restarted.decrypt(blob)).rejects.toThrow('Chave não carregada');
    });

    it('chave errada falha no decrypt', async () => {
        const crypto1 = await makeCrypto('senha-correta');
        const crypto2 = await makeCrypto('senha-errada');

        const blob = await crypto1.encrypt('segredo');

        await expect(crypto2.decrypt(blob)).rejects.toThrow();
    });
});

// ─── InboundService ───────────────────────────────────────────────────────────

describe('lazy sync crypto singleton', () => {
    it('ensureCryptoLayer reusa a mesma instância entre login e sync', async () => {
        resetSyncAdapter();
        const a = await ensureCryptoLayer();
        const b = await ensureCryptoLayer();
        expect(a).toBe(b);
    });
});

describe('InboundService', () => {
    it('pull() decripta e chama o handler correto', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();

        // Simula evento enviado por remetente remoto (mobile)
        const remoteRoutingId = 'setor-campo';
        const envelope: EventEnvelope = {
            v: 2,
            id: 'evt-001',
            type: 'ecoforms.registro.criado',
            source: { device_id: 'mobile-001', routing_id: remoteRoutingId, routing_type: 'setor', module: 'ecoforms-mobile', app_version: '1.0.0' },
            aggregate: { type: 'registro', id: 'reg-001' },
            time: '2026-05-07T10:00:00Z',
            schema_version: 1,
            seq: 1,
            prev_event_id: null,
            correlation_id: null,
            causation_id: null,
            stream_id: null,
            data: { tipo: 'coleta', quantidade: 5 },
            checksum: await buildChecksum({ tipo: 'coleta', quantidade: 5 }),
        };

        await seedEvent(index, crypto, remoteRoutingId, envelope);

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);

        const received: EventEnvelope[] = [];
        inbound.on('ecoforms.registro.criado', async (env) => { received.push(env); });

        const result = await inbound.pull([remoteRoutingId]);

        expect(result.processed).toBe(1);
        expect(result.errors).toHaveLength(0);
        expect(received).toHaveLength(1);
        expect(received[0].data).toEqual({ tipo: 'coleta', quantidade: 5 });
    });

    it('pull() atualiza seq local após processar evento', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const remoteRoutingId = 'setor-campo';

        const envelope = makeEnvelope('task.criada', { id: 't1' }, 1, remoteRoutingId);
        await seedEvent(index, crypto, remoteRoutingId, envelope);

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);
        inbound.on('task.criada', async () => {});

        await inbound.pull([remoteRoutingId]);

        const localSeq = await getLocalSeq(sqlite, remoteRoutingId);
        expect(localSeq).toBe(1);
    });

    it('pull() para ao detectar gap de sequência', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const remoteRoutingId = 'setor-campo';

        // Publica seq=1 e seq=3 (gap: seq=2 ausente)
        const env1 = makeEnvelope('task.criada', { id: 't1' }, 1, remoteRoutingId);
        const env3 = makeEnvelope('task.criada', { id: 't3' }, 3, remoteRoutingId);

        await seedEvent(index, crypto, remoteRoutingId, env1);
        await seedEvent(index, crypto, remoteRoutingId, env3);

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);
        const processed: number[] = [];
        inbound.on('task.criada', async (env) => { processed.push(env.seq); });

        const result = await inbound.pull([remoteRoutingId]);

        // Processa seq=1, para no seq=3 (gap)
        expect(processed).toEqual([1]);
        expect(result.errors.some(e => e.includes('Gap de sequência'))).toBe(true);
    });

    it('pull() ignora próprio routingId', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);
        let called = false;
        inbound.on('task.criada', async () => { called = true; });

        // Tenta puxar o próprio routing — deve pular
        const result = await inbound.pull([ROUTING_ID]);
        expect(result.skipped).toBe(0); // pulou sem processar, nem contar como skipped
        expect(called).toBe(false);
    });

    it('pull() é idempotente — não reprocessa evento já aplicado', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const remoteRoutingId = 'setor-campo';

        const envelope = makeEnvelope('task.criada', { id: 't1' }, 1, remoteRoutingId);
        await seedEvent(index, crypto, remoteRoutingId, envelope);

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);
        let callCount = 0;
        inbound.on('task.criada', async () => { callCount++; });

        await inbound.pull([remoteRoutingId]);
        // Reseta seq local para forçar repull
        sqlite.getTable('manifesto_sync')[0].seq = 0;
        await inbound.pull([remoteRoutingId]);

        // Handler chamado apenas 1 vez — idempotência via log_eventos_aplicados
        expect(callCount).toBe(1);
    });
});

// ─── Roundtrip desktop → mobile ──────────────────────────────────────────────

describe('Roundtrip completo: desktop publica → mobile consome', () => {
    it('evento publicado pelo desktop chega íntegro ao inbound do mobile', async () => {
        // Desktop: publica e faz push
        const desktopCrypto = await makeCrypto(TEST_PASSWORD);
        const { sqlite: desktopDb, index } = makeInfra();

        const transport = new TransportService(
            desktopCrypto, desktopDb, index, ROUTING_ID, DEVICE_ID,
        );

        await transport.publish({
            type: 'task.criada',
            data: { id: 'task-abc', titulo: 'Tarefa de campo', status: 'a_fazer' },
            aggregate_type: 'task',
            aggregate_id: 'task-abc',
        });
        await transport.pushPending();

        // Mobile: consome com mesma senha, mesmo sync_event_index compartilhado
        const mobileCrypto = await makeCrypto(TEST_PASSWORD);
        const { sqlite: mobileDb } = makeInfra(new InMemorySqlitePort(), index);

        const inbound = new InboundService(mobileCrypto, mobileDb, index, 'setor-campo');
        const received: EventEnvelope[] = [];
        inbound.on('task.criada', async (env) => { received.push(env); });

        const result = await inbound.pull([ROUTING_ID]);

        expect(result.processed).toBe(1);
        expect(result.errors).toHaveLength(0);
        expect(received[0].data).toEqual({ id: 'task-abc', titulo: 'Tarefa de campo', status: 'a_fazer' });
        expect(received[0].source.device_id).toBe(DEVICE_ID);
        expect(received[0].source.module).toBe('ecoforms-desktop');
        expect(received[0].seq).toBe(1);
    });
});

// ─── Correções de gaps ───────────────────────────────────────────────────────

describe('Correções de gaps', () => {
    it('pushPending() reprocessa eventos failed dentro do limite de tentativas', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const transport = new TransportService(crypto, sqlite, index, ROUTING_ID, DEVICE_ID);

        await transport.publish({ type: 'task.criada', data: { id: 't1' } });

        // Simula indisponibilidade do sync_event_index (esgota todas as tentativas)
        const pushSpy = vi.spyOn(index, 'pushEvent').mockRejectedValue(new Error('sync_event_index indisponível'));

        const result1 = await transport.pushPending();
        expect(result1.sent).toBe(0);
        expect(result1.failed).toBe(1);

        // Restaura e reprocessa — deve enviar o evento failed
        pushSpy.mockRestore();
        const result2 = await transport.pushPending();
        expect(result2.sent).toBe(1);
    });

    it('pushPending() continua batch mesmo após erro em um evento', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const transport = new TransportService(crypto, sqlite, index, ROUTING_ID, DEVICE_ID);

        await transport.publish({ type: 'task.criada', data: { id: 't1' }, aggregate_id: 't1' });
        await transport.publish({ type: 'task.criada', data: { id: 't2' }, aggregate_id: 't2' });

        // Faz o push falhar apenas para o primeiro evento (aggregate_id='t1')
        const realPush = index.pushEvent.bind(index);
        vi.spyOn(index, 'pushEvent').mockImplementation(async (params) => {
            if (params.aggregateId === 't1') throw new Error('sync_event_index indisponível');
            return realPush(params);
        });

        const result = await transport.pushPending();
        expect(result.failed).toBe(1);
        expect(result.sent).toBe(1); // segundo evento deve ser enviado
        expect(result.errors).toHaveLength(1);
    });

    it('pull() rejeita evento com checksum inválido', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const remoteRoutingId = 'setor-campo';

        const envelope = makeEnvelope('task.criada', { id: 't1' }, 1, remoteRoutingId);
        envelope.checksum = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
        await seedEvent(index, crypto, remoteRoutingId, envelope);

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);
        let called = false;
        inbound.on('task.criada', async () => { called = true; });

        const result = await inbound.pull([remoteRoutingId]);
        expect(result.processed).toBe(0);
        expect(result.errors.some(e => e.includes('checksum inválido'))).toBe(true);
        expect(called).toBe(false);
    });


    it('pull() rejeita payload de domínio malformado antes de chamar handler', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const remoteRoutingId = 'setor-campo';

        const envelope = makeEnvelope('task.criada', { titulo: 'Sem id' }, 1, remoteRoutingId);
        await seedEvent(index, crypto, remoteRoutingId, envelope);

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);
        let called = false;
        inbound.on('task.criada', async () => { called = true; });

        const result = await inbound.pull([remoteRoutingId]);
        expect(result.processed).toBe(0);
        expect(result.errors.some(e => e.includes('Invalid EventPayload for task.criada'))).toBe(true);
        expect(called).toBe(false);
        expect(await getLocalSeq(sqlite, remoteRoutingId)).toBe(0);
    });

    it('pull() rejeita envelope malformado antes de chamar handler', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const remoteRoutingId = 'setor-campo';
        const payload_enc = await crypto.encryptJson({ id: 'evt-malformado', data: { id: 't1' } });

        index._seed({
            id: 'evt-malformado',
            routing_id: remoteRoutingId,
            routing_type: 'setor',
            seq: 1,
            event_type: 'task.criada',
            aggregate_type: 'task',
            aggregate_id: 't1',
            device_id: 'mobile-1',
            checksum: '',
            prev_event_id: null,
            payload_enc,
            created_at: new Date().toISOString(),
        });

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);
        let called = false;
        inbound.on('task.criada', async () => { called = true; });

        const result = await inbound.pull([remoteRoutingId]);
        expect(result.processed).toBe(0);
        expect(result.errors.some(e => e.includes('Invalid EventEnvelope'))).toBe(true);
        expect(called).toBe(false);
    });

    it('pull() registra gap em log_gaps_sync ao detectar sequência faltante', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const remoteRoutingId = 'setor-campo';

        // Publica seq=1 e seq=3 (gap: seq=2 ausente)
        const env1 = makeEnvelope('task.criada', { id: 't1' }, 1, remoteRoutingId);
        const env3 = makeEnvelope('task.criada', { id: 't3' }, 3, remoteRoutingId);

        await seedEvent(index, crypto, remoteRoutingId, env1);
        await seedEvent(index, crypto, remoteRoutingId, env3);

        const inbound = new InboundService(crypto, sqlite, index, ROUTING_ID);
        inbound.on('task.criada', async () => {});

        await inbound.pull([remoteRoutingId]);

        const gaps = sqlite.getTable('log_gaps_sync');
        expect(gaps).toHaveLength(1);
        expect(gaps[0].id_roteamento).toBe(remoteRoutingId);
        expect(gaps[0].sequencia_faltante).toBe(2);
    });

    it('purgeOldSentEvents() remove eventos sent antigos', async () => {
        const crypto = await makeCrypto();
        const { sqlite, index } = makeInfra();
        const transport = new TransportService(crypto, sqlite, index, ROUTING_ID, DEVICE_ID);

        await transport.publish({ type: 'task.criada', data: { id: 't1' } });
        await transport.pushPending();

        const beforePurge = sqlite.getTable('fila_eventos_sync');
        expect(beforePurge).toHaveLength(1);

        await transport.purgeOldSentEvents(0); // remove imediatamente (dias = 0)

        const afterPurge = sqlite.getTable('fila_eventos_sync');
        expect(afterPurge).toHaveLength(0);
    });

});

// ─── Helpers locais ───────────────────────────────────────────────────────────

function makeEnvelope(type: EcoFormsEventType, data: Record<string, unknown>, seq: number, routingId: string): EventEnvelope {
    const env = createEnvelope(
        { type, data },
        seq,
        'remote-device',
        routingId,
    );
    return { ...env, checksum: '' };
}

async function seedEvent(
    index: FakeSyncEventIndex,
    crypto: CryptoLayer,
    routingId: string,
    envelope: EventEnvelope,
): Promise<void> {
    if (!envelope.checksum) {
        envelope.checksum = await buildChecksum(envelope.data);
    }
    const payload_enc = await crypto.encryptJson(envelope);
    index._seed({
        id: envelope.id,
        routing_id: routingId,
        routing_type: envelope.source.routing_type,
        seq: envelope.seq,
        event_type: envelope.type,
        aggregate_type: envelope.aggregate.type,
        aggregate_id: envelope.aggregate.id,
        device_id: envelope.source.device_id ?? '',
        checksum: envelope.checksum,
        prev_event_id: envelope.prev_event_id,
        payload_enc,
        created_at: new Date().toISOString(),
    });
}

async function getLocalSeq(sqlite: InMemorySqlitePort, routingId: string): Promise<number> {
    const rows = await sqlite.query<{ sequencia: number }>(
        'SELECT sequencia FROM manifesto_sync WHERE id_roteamento = ? LIMIT 1',
        [routingId],
    );
    return rows[0]?.sequencia ?? 0;
}


function normalizeModuleSchemaSql(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
}

describe('Module schema canonicalization', () => {
    it('ensureColumns defines module tables with canonical constraints', async () => {
        const executed: string[] = [];

        await ensureColumns(
            async () => [],
            async (sql: string) => {
                executed.push(normalizeModuleSchemaSql(sql));
            },
        );

        const createRegistro = executed.find(sql => sql.includes('CREATE TABLE IF NOT EXISTS registro_modulos'));
        const createPermissoes = executed.find(sql => sql.includes('CREATE TABLE IF NOT EXISTS permissoes_modulos'));

        expect(createRegistro).toContain('tipo_entidade TEXT NOT NULL UNIQUE');
        expect(createRegistro).toContain("prefix TEXT NOT NULL DEFAULT ''");
        expect(executed).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_module_registry_entity_type ON registro_modulos(tipo_entidade)');
        expect(executed).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_module_registry_prefix ON registro_modulos(prefix)');
        expect(executed).toContain('CREATE INDEX IF NOT EXISTS idx_module_registry_status ON registro_modulos(status)');
        expect(createPermissoes).toContain('CHECK (can_create = 0 OR can_view = 1)');
        expect(executed).toContain('CREATE INDEX IF NOT EXISTS idx_module_permissions_module_id ON permissoes_modulos(module_id)');
    });

    it('migratePtBrIfNeeded keeps canonical module column names after table rename', async () => {
        const executed: string[] = [];

        await migratePtBrIfNeeded(
            async (sql: string) => sql.includes("name='suite'") ? [{ name: 'suite' }] : [],
            async (sql: string) => {
                executed.push(normalizeModuleSchemaSql(sql));
            },
        );

        expect(executed).toContain('ALTER TABLE module_permissions RENAME TO permissoes_modulos');
        expect(executed).toContain('ALTER TABLE module_visual_views RENAME TO visuais_modulos');
        expect(executed.some(sql => sql.includes('ALTER TABLE permissoes_modulos RENAME COLUMN profile TO perfil'))).toBe(false);
        expect(executed.some(sql => sql.includes('ALTER TABLE permissoes_modulos RENAME COLUMN can_view TO pode_visualizar'))).toBe(false);
        expect(executed.some(sql => sql.includes('ALTER TABLE visuais_modulos RENAME COLUMN visual_type TO tipo_visual'))).toBe(false);
        expect(executed.some(sql => sql.includes('ALTER TABLE visuais_modulos RENAME COLUMN name TO nome'))).toBe(false);
    });

    it('ModuleSyncHandler writes visuais_modulos using canonical physical columns', async () => {
        const executed: string[] = [];
        const db = {
            execute: async (sql: string) => {
                executed.push(normalizeModuleSchemaSql(sql));
            },
        } as unknown as SqlitePort;

        const handler = new ModuleSyncHandler(db);
        const env: EventEnvelope = {
            v: 2,
            id: 'evt-1',
            type: 'visuais_modulos.created',
            source: {
                device_id: 'dev-1',
                routing_id: 'route-1',
                routing_type: 'setor',
                module: 'ecoforms-desktop',
                app_version: '1.0.0',
            },
            aggregate: { type: 'visuais_modulos', id: 'vis-1' },
            time: '2026-06-26T12:00:00.000Z',
            schema_version: 1,
            seq: 1,
            prev_event_id: null,
            correlation_id: null,
            causation_id: null,
            stream_id: null,
            data: {
                id: 'vis-1',
                module_id: 'mod-1',
                visual_type: 'table',
                name: 'Visao',
                config: '{}',
                is_default: 1,
                user_id: null,
                sync_status: 'synced',
            },
            checksum: 'sha256:test',
        };

        await (handler as unknown as { onVisualCriado(env: EventEnvelope): Promise<void> }).onVisualCriado(env);

        expect(executed).toHaveLength(1);
        expect(executed[0]).toContain('INSERT OR REPLACE INTO visuais_modulos');
        expect(executed[0]).toContain('id, module_id, visual_type, name, config, is_default, user_id, sync_status, criado_em, atualizado_em');
        expect(executed[0].includes('tipo_visual')).toBe(false);
        expect(executed[0].includes('configuracao')).toBe(false);
        expect(executed[0].includes('padrao')).toBe(false);
    });
    it('ModuleSyncHandler writes module.publicado using canonical module columns', async () => {
        const executed: string[] = [];
        const db = {
            execute: async (sql: string) => {
                executed.push(normalizeModuleSchemaSql(sql));
            },
        } as unknown as SqlitePort;

        const handler = new ModuleSyncHandler(db);
        const env: EventEnvelope = {
            v: 2,
            id: 'evt-mod-1',
            type: 'module.publicado',
            source: {
                device_id: 'dev-1',
                routing_id: 'route-1',
                routing_type: 'setor',
                module: 'ecoforms-desktop',
                app_version: '1.0.0',
            },
            aggregate: { type: 'registro_modulos', id: 'mod-1' },
            time: '2026-06-26T12:00:00.000Z',
            schema_version: 1,
            seq: 1,
            prev_event_id: null,
            correlation_id: null,
            causation_id: null,
            stream_id: null,
            data: {
                id: 'mod-1',
                slug: 'fiscalizacao',
                name: 'Fiscalização',
                entity_type: 'fiscalizacao',
                status: 'published',
                version: 3,
                config_version: 7,
                config: { forms: [] },
                publicado_em: '2026-06-26T12:00:00.000Z',
            },
            checksum: 'sha256:test',
        };

        await (handler as unknown as { onPublicado(env: EventEnvelope): Promise<void> }).onPublicado(env);

        expect(executed).toHaveLength(1);
        expect(executed[0]).toContain('INSERT OR REPLACE INTO registro_modulos');
        expect(executed[0]).toContain('config_version');
        expect(executed[0]).toContain('versao');
    });
    it('SqliteModuleRepository save persists config_version in registro_modulos', async () => {
        const executes: string[] = [];
        let boundConfigVersion: unknown;
        const db = {
            query: async () => [],
            execute: async (sql: string, params: unknown[] = []) => {
                executes.push(normalizeModuleSchemaSql(sql));
                boundConfigVersion = params[11];
            },
            all: async () => [],
            transaction: async <T>(cb: (tx: SqlitePort) => Promise<T>) => cb(db as unknown as SqlitePort),
        } as unknown as SqlitePort;

        const repo = new SqliteModuleRepository(db);
        await repo.save({
            id: 'mod-1',
            slug: 'fiscalizacao',
            name: 'Fiscalização',
            description: null,
            entity_type: 'fiscalizacao',
            icon: null,
            color: null,
            prefix: '/fiscal',
            ordem: 1,
            status: 'draft',
            version: 1,
            config_version: 9,
            config: {},
            suite_config: null,
            criado_em: '2026-01-01T00:00:00.000Z',
            atualizado_em: '2026-01-01T00:00:00.000Z',
            publicado_em: null,
        } as never);

        expect(executes).toHaveLength(1);
        expect(executes[0]).toContain('config_version');
        expect(boundConfigVersion).toBe(9);
    });
});
