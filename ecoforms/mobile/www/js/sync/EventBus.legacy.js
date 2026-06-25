// ⚠️ ESPELHO de desktop/src/infrastructure/sync/EventBus.ts
// Alterações aqui devem ser refletidas lá.
import { uuidv7 } from '../utils/uuid.js';
import { buildChecksum, createEnvelope } from './EventEnvelope.js';
import { openSyncEventDB } from './SyncEventDB.js';
import { resolveConflict, profileForEventType, ConflictProfile } from './ConflictResolver.js';

export class EventBus {
  constructor(deviceId, routingId, appVersion = '1.0.0') {
    this.deviceId = deviceId;
    this.routingId = routingId;
    this.appVersion = appVersion;
    this.handlers = new Map();
    this._localLookup = null; // fn(type, id) => localRecord | null
  }

  /**
   * Registra função para lookup de registros locais para resolução de conflitos.
   * @param {Function} fn — async (entityType, entityId) => localRecord | null
   */
  setLocalLookup(fn) {
    this._localLookup = fn;
  }

  async publish(type, data, opts = {}) {
    const db = await openSyncEventDB();
    const seq = await this._nextSeq(db);
    const prevEventId = await this._lastSentEventId(db);
    const checksum = await buildChecksum(data);

    const envelope = createEnvelope(
      {
        id: opts.id || uuidv7(),
        type,
        aggregate_type: opts.aggregateType || type.split('.')[0],
        aggregate_id: opts.aggregateId || opts.id || uuidv7(),
        data,
        correlation_id: opts.correlationId || null,
        causation_id: opts.causationId || null,
        stream_id: opts.streamId || null,
        prev_event_id: prevEventId,
      },
      seq,
      this.deviceId,
      this.routingId,
      this.appVersion
    );
    envelope.checksum = checksum;

    const aggregateId = envelope.aggregate.id;
    await new Promise((resolve, reject) => {
      const tx = db.transaction('syncEventQueue', 'readwrite');
      const store = tx.objectStore('syncEventQueue');
      store.put({
        id: envelope.id,
        type: envelope.type,
        payload: JSON.stringify(envelope),
        aggregate_type: envelope.aggregate.type,
        aggregate_id: aggregateId,
        correlation_id: envelope.correlation_id,
        causation_id: envelope.causation_id,
        stream_id: envelope.stream_id,
        seq: envelope.seq,
        status: 'pending',
        attempts: 0,
        created_at: envelope.time,
        sent_at: null,
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    return envelope;
  }

  onInbound(type, handler) {
    const list = this.handlers.get(type) || [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  async dispatch(envelope) {
    const db = await openSyncEventDB();

    const alreadyProcessed = await this._isProcessed(db, envelope.id);
    if (alreadyProcessed) return;

    // Conflict resolution: check if remote should be applied
    const profile = profileForEventType(envelope.type);
    if (profile === ConflictProfile.A && this._localLookup) {
      try {
        const entityType = envelope.aggregate?.type || envelope.type.split('.')[0];
        const entityId = envelope.aggregate?.id;
        if (entityId) {
          const localRecord = await this._localLookup(entityType, entityId);
          if (localRecord) {
            const result = resolveConflict(profile, localRecord, envelope.data || {});
            if (result.hasConflict && result.winner === 'local') {
              console.log(`[EventBus] Conflito resolvido — local vence para ${envelope.type}:${entityId} (${result.strategy})`);
              return; // Local wins, skip remote event
            }
          }
        }
      } catch (err) {
        console.warn(`[EventBus] Conflict resolution failed for ${envelope.type}, proceeding with dispatch:`, err);
      }
    }

    const handlers = this.handlers.get(envelope.type) || [];
    const errors = [];
    for (const handler of handlers) {
      try {
        await handler(envelope, db);
      } catch (err) {
        errors.push(String(err));
      }
    }

    await new Promise((resolve, reject) => {
      const tx = db.transaction('syncDeviceLog', 'readwrite');
      const store = tx.objectStore('syncDeviceLog');
      store.put({
        device_id: envelope.source.routing_id,
        seq: envelope.seq,
        event_id: envelope.id,
        acked: 1,
        pushed_at: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    if (errors.length > 0) {
      throw new Error(`dispatch(${envelope.type}): ${errors.join('; ')}`);
    }
  }

  async getPendingEnvelopes() {
    const db = await openSyncEventDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncEventQueue', 'readonly');
      const store = tx.objectStore('syncEventQueue');
      const index = store.index('statusSeq');
      const range = IDBKeyRange.bound(['pending', 0], ['pending', Infinity]);
      const request = index.getAll(range);
      request.onsuccess = () => {
        const results = request.result
          .sort((a, b) => a.seq - b.seq)
          .map(r => JSON.parse(r.payload));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markAsSent(eventId) {
    const db = await openSyncEventDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['syncEventQueue', 'syncDeviceLog'], 'readwrite');
      const queueStore = tx.objectStore('syncEventQueue');
      const logStore = tx.objectStore('syncDeviceLog');

      const getReq = queueStore.get(eventId);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.status = 'sent';
          record.sent_at = new Date().toISOString();
          queueStore.put(record);

          logStore.put({
            device_id: this.routingId,
            seq: record.seq,
            event_id: eventId,
            acked: 0,
            pushed_at: new Date().toISOString(),
          });
        }
      };

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async markAsFailed(eventId) {
    const db = await openSyncEventDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('syncEventQueue', 'readwrite');
      const store = tx.objectStore('syncEventQueue');
      const getReq = store.get(eventId);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.status = 'failed';
          record.attempts = (record.attempts || 0) + 1;
          store.put(record);
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async _nextSeq(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncDeviceLog', 'readonly');
      const store = tx.objectStore('syncDeviceLog');
      const index = store.index('deviceId');
      const request = index.openCursor(IDBKeyRange.only(this.routingId), 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value.seq + 1 : 1);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async _lastSentEventId(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncDeviceLog', 'readonly');
      const store = tx.objectStore('syncDeviceLog');
      const index = store.index('deviceId');
      const request = index.openCursor(IDBKeyRange.only(this.routingId), 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value.event_id : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async purgeOldSentEvents(daysToKeep = 30) {
    const db = await openSyncEventDB();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const cutoffISO = cutoff.toISOString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncEventQueue', 'readwrite');
      const store = tx.objectStore('syncEventQueue');
      const index = store.index('status');
      const request = index.getAll('sent');
      let deleted = 0;

      request.onsuccess = () => {
        for (const record of (request.result || [])) {
          if (record.sent_at && record.sent_at < cutoffISO) {
            store.delete(record.id);
            deleted++;
          }
        }
      };

      tx.oncomplete = () => resolve(deleted);
      tx.onerror = () => reject(tx.error);
    });
  }

  async purgeOldFailedEvents(daysToKeep = 7) {
    const db = await openSyncEventDB();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const cutoffISO = cutoff.toISOString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncEventQueue', 'readwrite');
      const store = tx.objectStore('syncEventQueue');
      const index = store.index('status');
      const request = index.getAll('failed');
      let deleted = 0;

      request.onsuccess = () => {
        for (const record of (request.result || [])) {
          if (record.created_at && record.created_at < cutoffISO) {
            store.delete(record.id);
            deleted++;
          }
        }
      };

      tx.oncomplete = () => resolve(deleted);
      tx.onerror = () => reject(tx.error);
    });
  }

  async _isProcessed(db, eventId) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncDeviceLog', 'readonly');
      const store = tx.objectStore('syncDeviceLog');
      const index = store.index('eventId');
      const request = index.get(eventId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
