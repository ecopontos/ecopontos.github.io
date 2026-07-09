import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const state = {
  queue: [],
  sentLog: [],
};

class SqliteSyncEventRepository {
  constructor(db) {
    this.db = db;
  }

  async enqueue(event) {
    let seq = null;
    try {
      seq = JSON.parse(event.carga).seq ?? null;
    } catch {
      seq = null;
    }
    state.queue.push({
      id: event.id,
      tipo: event.tipo,
      carga: event.carga,
      seq,
      tipo_agregado: event.tipo_agregado ?? null,
      id_agregado: event.id_agregado ?? null,
      id_envelope: event.id_envelope ?? null,
    });
  }

  async getPending(limit = 200) {
    return state.queue.slice(0, limit);
  }

  async markSent(eventId) {
    const row = state.queue.find((item) => item.id === eventId);
    if (row) row.situacao = 'sent';
  }

  async markFailed(eventId) {
    const row = state.queue.find((item) => item.id === eventId);
    if (row) row.situacao = 'failed';
  }
}

const adapterState = {
  query: vi.fn(async (sql, params = []) => {
    const text = String(sql);
    if (text.includes('MAX(seq)')) {
      const queueSeq = state.queue
        .map((row) => Number(row.seq) || 0)
        .reduce((max, seq) => Math.max(max, seq), 0);
      const logSeq = state.sentLog.reduce((max, row) => Math.max(max, Number(row.seq) || 0), 0);
      return [{ last_seq: Math.max(queueSeq, logSeq) }];
    }
    if (text.includes("ORDER BY CAST(json_extract(carga, '$.seq') AS INTEGER) DESC")) {
      const last = [...state.queue].sort((a, b) => Number(b.seq || 0) - Number(a.seq || 0))[0];
      return last ? [{ id: last.id }] : [];
    }
    if (text.includes('SELECT carga FROM fila_eventos_sync WHERE id = ? LIMIT 1')) {
      const row = state.queue.find((item) => item.id === params[0]);
      return row ? [{ carga: row.carga }] : [];
    }
    if (text.includes('sync_device_log')) return [];
    return [];
  }),
  execute: vi.fn(async (sql, params = []) => {
    const text = String(sql);
    if (text.includes('INSERT OR IGNORE INTO sync_device_log')) {
      const [id, deviceId, seq, eventId, acked] = params;
      state.sentLog.push({ id, device_id: deviceId, seq, event_id: eventId, acked });
      return;
    }
    if (text.includes('INSERT OR IGNORE INTO fila_eventos_sync')) {
      const [id, tipo, carga, tipoAgregado, idAgregado, idEnvelope] = params;
      state.queue.push({ id, tipo, carga, tipo_agregado: tipoAgregado, id_agregado: idAgregado, id_envelope: idEnvelope });
      return;
    }
  }),
};

vi.mock('../www/js/adapters/CapacitorSqliteAdapter.js', () => ({
  sqliteAdapter: adapterState,
}));

vi.mock('../www/js/adapters/MobileKanbanRepository.js', () => ({
  SqliteSyncEventRepository,
}));

describe('mobile EventBus publish', () => {
  beforeEach(() => {
    state.queue = [];
    state.sentLog = [];
    adapterState.query.mockClear();
    adapterState.execute.mockClear();
  });

  it('encadeia eventos enfileirados com prev_event_id e seq crescente', async () => {
    const { EventBus } = await import('../www/js/sync/EventBus.js');
    const bus = new EventBus('device-1', 'setor-1', '1.0.0');

    const first = await bus.publish('task.criada', { id: 'task-1', titulo: 'A' });
    const second = await bus.publish('task.concluida', { id: 'task-1' });

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(first.prev_event_id).toBeNull();
    expect(second.prev_event_id).toBe(first.id);

    const storedFirst = JSON.parse(state.queue[0].carga);
    const storedSecond = JSON.parse(state.queue[1].carga);
    expect(storedFirst.prev_event_id).toBeNull();
    expect(storedSecond.prev_event_id).toBe(first.id);
    expect(storedSecond.seq).toBe(2);
  });


  it('markAsSent grava a seq do envelope enviado sem pular a proxima publicacao', async () => {
    const { EventBus } = await import('../www/js/sync/EventBus.js');
    const bus = new EventBus('device-1', 'setor-1', '1.0.0');

    const first = await bus.publish('task.criada', { id: 'task-1', titulo: 'A' });
    await bus.markAsSent(first.id);
    const second = await bus.publish('task.concluida', { id: 'task-1' });

    expect(state.sentLog[0].event_id).toBe(first.id);
    expect(state.sentLog[0].seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(second.prev_event_id).toBe(first.id);
  });
});
