// ⚠️ ESPELHO de desktop/src/infrastructure/sync/EventBus.ts
// ADR-052 Fase 4: migrado de IndexedDB → SQLite via SqliteSyncEventRepository.
// API pública preservada — TransportService, InboundService e HandlerRegistry
// não requerem alteração.
import { uuidv7 } from '../utils/uuid.js';
import { buildChecksum, createEnvelope } from './EventEnvelope.js';
import { resolveConflict, profileForEventType, ConflictProfile } from './ConflictResolver.js';
import { sqliteAdapter } from '../adapters/CapacitorSqliteAdapter.js';
import { SqliteSyncEventRepository } from '../adapters/MobileKanbanRepository.js';

const syncRepo = new SqliteSyncEventRepository(sqliteAdapter);

export class EventBus {
  constructor(deviceId, routingId, appVersion = '1.0.0') {
    this.deviceId  = deviceId;
    this.routingId = routingId;
    this.appVersion = appVersion;
    this.handlers  = new Map();
    this._localLookup = null;
  }

  setLocalLookup(fn) {
    this._localLookup = fn;
  }

  async publish(type, data, opts = {}) {
    const seq         = await this._nextSeq();
    const prevEventId = await this._lastQueuedEventId();
    const checksum    = await buildChecksum(data);

    const envelope = createEnvelope(
      {
        id:             opts.id || uuidv7(),
        type,
        aggregate_type: opts.aggregateType || type.split('.')[0],
        aggregate_id:   opts.aggregateId || opts.id || uuidv7(),
        data,
        correlation_id: opts.correlationId || null,
        causation_id:   opts.causationId   || null,
        stream_id:      opts.streamId      || null,
        prev_event_id:  prevEventId,
      },
      seq,
      this.deviceId,
      this.routingId,
      this.appVersion,
    );
    envelope.checksum = checksum;

    await syncRepo.enqueue({
      id:            envelope.id,
      tipo:          envelope.type,
      carga:         JSON.stringify(envelope),
      tipo_agregado: envelope.aggregate.type,
      id_agregado:   envelope.aggregate.id,
      id_envelope:   null,
    });

    return envelope;
  }

  onInbound(type, handler) {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async dispatch(envelope) {
    const alreadyProcessed = await this._isProcessed(envelope.id);
    if (alreadyProcessed) return;

    const profile = profileForEventType(envelope.type);
    if (profile === ConflictProfile.A && this._localLookup) {
      try {
        const entityType = envelope.aggregate?.type || envelope.type.split('.')[0];
        const entityId   = envelope.aggregate?.id;
        if (entityId) {
          const localRecord = await this._localLookup(entityType, entityId);
          if (localRecord) {
            const result = resolveConflict(profile, localRecord, envelope.data || {});
            if (result.hasConflict && result.winner === 'local') {
              console.log(`[EventBus] Conflito — local vence: ${envelope.type}:${entityId}`);
              return;
            }
          }
        }
      } catch (err) {
        console.warn(`[EventBus] Conflict resolution falhou para ${envelope.type}:`, err);
      }
    }

    const handlers = this.handlers.get(envelope.type) || [];
    const errors = [];
    for (const handler of handlers) {
      try {
        await handler(envelope, sqliteAdapter);
      } catch (err) {
        errors.push(String(err));
      }
    }

    await sqliteAdapter.execute(
      `INSERT OR IGNORE INTO sync_device_log (id, device_id, seq, event_id, acked, pushed_at)
       VALUES (?, ?, ?, ?, 1, datetime('now'))`,
      [uuidv7(), envelope.source.routing_id, envelope.seq, envelope.id],
    );

    if (errors.length > 0) {
      throw new Error(`dispatch(${envelope.type}): ${errors.join('; ')}`);
    }
  }

  async getPendingEnvelopes() {
    const rows = await syncRepo.getPending(200);
    return rows.map(r => JSON.parse(r.carga));
  }

  async markAsSent(eventId) {
    const seq = await this._queuedEventSeq(eventId);
    await syncRepo.markSent(eventId);
    await sqliteAdapter.execute(
      `INSERT OR IGNORE INTO sync_device_log (id, device_id, seq, event_id, acked, pushed_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      [uuidv7(), this.routingId, seq ?? await this._nextSeq(), eventId],
    );
  }

  async markAsFailed(eventId) {
    await syncRepo.markFailed(eventId);
  }

  async purgeOldSentEvents(daysToKeep = 30) {
    const rows = await sqliteAdapter.query(
      `SELECT id FROM fila_eventos_sync
       WHERE situacao = 'sent' AND enviado_em < datetime('now', ?)`,
      [`-${daysToKeep} days`],
    );
    for (const r of rows) {
      await sqliteAdapter.execute(`DELETE FROM fila_eventos_sync WHERE id = ?`, [r.id]);
    }
    return rows.length;
  }

  async purgeOldFailedEvents(daysToKeep = 7) {
    const rows = await sqliteAdapter.query(
      `SELECT id FROM fila_eventos_sync
       WHERE situacao = 'failed' AND criado_em < datetime('now', ?)`,
      [`-${daysToKeep} days`],
    );
    for (const r of rows) {
      await sqliteAdapter.execute(`DELETE FROM fila_eventos_sync WHERE id = ?`, [r.id]);
    }
    return rows.length;
  }

  // ── privados ───────────────────────────────────────────────────────

  async _nextSeq() {
    const rows = await sqliteAdapter.query(
      `SELECT COALESCE(MAX(seq), 0) AS last_seq FROM (
         SELECT seq FROM sync_device_log WHERE device_id = ?
         UNION ALL
         SELECT CAST(json_extract(carga, '$.seq') AS INTEGER) AS seq
         FROM fila_eventos_sync
       )`,
      [this.routingId],
    );
    return ((rows[0]?.last_seq) ?? 0) + 1;
  }

  async _lastQueuedEventId() {
    const rows = await sqliteAdapter.query(
      `SELECT id FROM fila_eventos_sync
       ORDER BY CAST(json_extract(carga, '$.seq') AS INTEGER) DESC, criado_em DESC, id DESC
       LIMIT 1`,
      [],
    );
    return rows[0]?.id ?? null;
  }

  async _queuedEventSeq(eventId) {
    const rows = await sqliteAdapter.query(
      `SELECT carga FROM fila_eventos_sync WHERE id = ? LIMIT 1`,
      [eventId],
    );
    if (!rows[0]?.carga) return null;
    try {
      const envelope = JSON.parse(rows[0].carga);
      return Number.isInteger(envelope.seq) ? envelope.seq : null;
    } catch {
      return null;
    }
  }

  async _isProcessed(eventId) {
    const rows = await sqliteAdapter.query(
      `SELECT 1 FROM sync_device_log WHERE event_id = ? LIMIT 1`,
      [eventId],
    );
    return rows.length > 0;
  }
}
