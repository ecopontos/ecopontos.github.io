import { describe, it, expect, beforeEach, vi } from 'vitest';

// CryptoLayer.deriveAndStoreKey persiste a chave raw via @tauri-apps/plugin-store
// (Central Crypto / sessão Rust) — mock em memória, sem invoke real.
vi.mock('@tauri-apps/plugin-store', () => ({
    Store: {
        load: vi.fn(async () => ({
            get: vi.fn(async () => null),
            set: vi.fn(async () => {}),
            save: vi.fn(async () => {}),
        })),
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
import { TransportService } from '../TransportService';
import { InboundService } from '../InboundService';
import { createEnvelope, buildChecksum } from '../EventEnvelope';
import type { EcoFormsEventType, EventEnvelope } from '../EventEnvelope';
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

    it('chave errada falha no decrypt', async () => {
        const crypto1 = await makeCrypto('senha-correta');
        const crypto2 = await makeCrypto('senha-errada');

        const blob = await crypto1.encrypt('segredo');

        await expect(crypto2.decrypt(blob)).rejects.toThrow();
    });
});

// ─── InboundService ───────────────────────────────────────────────────────────

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
