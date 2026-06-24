// ⚠️ ESPELHO de desktop/src/infrastructure/sync/InboundService.ts
// Alterações aqui devem ser refletidas lá.
import { buildChecksum, uuidv7 } from '/js/ecoforms-core.js';
import { sqliteAdapter } from '../adapters/CapacitorSqliteAdapter.js';

const INBOUND_PAGE_SIZE = 50;
const APPLIED_PLACEHOLDER = 'sync_event_index';

export class InboundService {
  constructor(cryptoLayer, index, eventBus, localRoutingId) {
    this.crypto = cryptoLayer;
    this.index = index;
    this.eventBus = eventBus;
    this.localRoutingId = localRoutingId;
  }

  async pull(knownRoutingIds) {
    const result = { processed: 0, skipped: 0, errors: [], remaining: 0 };

    for (const remoteRoutingId of knownRoutingIds) {
      if (remoteRoutingId === this.localRoutingId) continue;

      try {
        let localSeq = await this._getLocalSeq(remoteRoutingId);

        while (true) {
          const rows = await this.index.pullEvents(remoteRoutingId, localSeq, INBOUND_PAGE_SIZE);
          if (rows.length === 0) break;

          let gapDetected = false;

          for (const row of rows) {
            try {
              const alreadyApplied = await this._isApplied(row.id);
              if (alreadyApplied) {
                result.skipped++;
                continue;
              }

              const envelope = await this.crypto.decryptJson(row.payload_enc);
              const expectedChecksum = await buildChecksum(envelope.data);
              if (envelope.checksum && envelope.checksum !== expectedChecksum) {
                result.errors.push(`${row.id}: checksum inválido — possível corrupção ou tampering`);
                continue;
              }

              if (row.seq !== localSeq + 1) {
                result.errors.push(`Gap de sequência de ${remoteRoutingId}: esperado ${localSeq + 1}, recebido ${row.seq}`);
                await this._recordGap(remoteRoutingId, localSeq + 1);
                gapDetected = true;
                break;
              }

              await this.eventBus.dispatch(envelope);
              await this._markApplied(envelope);

              localSeq = row.seq;
              result.processed++;
            } catch (err) {
              result.errors.push(`${row.id}: ${String(err)}`);
            }
          }

          if (gapDetected || rows.length < INBOUND_PAGE_SIZE) break;
        }
      } catch (err) {
        result.errors.push(`${remoteRoutingId}: ${String(err)}`);
      }
    }

    return result;
  }

  async _getLocalSeq(routingId) {
    const rows = await sqliteAdapter.query(
      'SELECT MAX(seq) AS seq FROM sync_device_log WHERE device_id = ? AND acked = 1',
      [routingId],
    );
    return rows[0]?.seq ?? 0;
  }

  async _isApplied(envelopeId) {
    const rows = await sqliteAdapter.query(
      'SELECT 1 AS e FROM log_eventos_aplicados WHERE envelope_id = ? LIMIT 1',
      [envelopeId],
    );
    return rows.length > 0;
  }

  async _markApplied(envelope) {
    await sqliteAdapter.execute(
      `INSERT OR IGNORE INTO log_eventos_aplicados
       (envelope_id, tipo_entidade, id_entidade, caminho_storage, dispositivo_origem)
       VALUES (?, ?, ?, ?, ?)`,
      [envelope.id, envelope.aggregate.type, envelope.aggregate.id, APPLIED_PLACEHOLDER, envelope.source.device_id],
    );
  }

  async _recordGap(routingId, missingSeq) {
    try {
      await sqliteAdapter.execute(
        `INSERT OR IGNORE INTO log_gaps_sync (id, id_roteamento, sequencia_faltante, situacao, detectado_em)
         VALUES (?, ?, ?, 'pending', datetime('now'))`,
        [uuidv7(), routingId, missingSeq],
      );
    } catch {
      /* Tabela pode não existir em bancos legados — não quebrar o pull */
    }
  }
}
