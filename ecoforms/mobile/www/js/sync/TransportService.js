// ⚠️ ESPELHO de desktop/src/infrastructure/sync/TransportService.ts
// Alterações aqui devem ser refletidas lá.
import { TokenBucketRateLimiter } from './RateLimiter.js';
import { CycleCircuitBreaker } from './CycleCircuitBreaker.js';
import { pushEventToIndex, TRANSPORT_BATCH_SIZE, TRANSPORT_MAX_RETRIES } from '/js/ecoforms-core.js';

export class TransportService {
  static BATCH_SIZE = TRANSPORT_BATCH_SIZE;
  static MAX_RETRIES = TRANSPORT_MAX_RETRIES;
  static INBOUND_PAGE_SIZE = 50;
  static RATE_MAX_TOKENS = 5;
  static RATE_REFILL_PER_SECOND = 2;

  constructor(cryptoLayer, index, routingId, deviceId) {
    this.crypto = cryptoLayer;
    this.index = index;
    this.routingId = routingId;
    this.deviceId = deviceId;
    this._pushing = false;
    this.rateLimiter = new TokenBucketRateLimiter(TransportService.RATE_MAX_TOKENS, TransportService.RATE_REFILL_PER_SECOND);
    this.circuitBreaker = new CycleCircuitBreaker({ failureThreshold: 5, baseCooldownMs: 30000, maxCooldownMs: 300000, resetSuccessCount: 3 });
  }

  async pushPending(eventBus) {
    if (this._pushing) return { sent: 0, failed: 0, errors: ['Push já em andamento'] };
    this._pushing = true;
    try { return await this._doPush(eventBus); } finally { this._pushing = false; }
  }

  async _doPush(eventBus) {
    if (!this.circuitBreaker.canSync()) {
      const remaining = this.circuitBreaker.remainingCooldownMs();
      return { sent: 0, failed: 0, errors: [`Circuit breaker cooldown: ${Math.ceil(remaining / 1000)}s remaining`] };
    }
    const pending = await eventBus.getPendingEnvelopes();
    if (pending.length === 0) return { sent: 0, failed: 0, errors: [] };
    const batch = pending.slice(0, TransportService.BATCH_SIZE);
    const result = { sent: 0, failed: 0, errors: [] };
    for (const envelope of batch) {
      await this.rateLimiter.acquire();
      const pushResult = await pushEventToIndex({
        envelope, crypto: this.crypto, index: this.index, deviceId: this.deviceId, maxRetries: TransportService.MAX_RETRIES,
      });
      if (pushResult.success) {
        await eventBus.markAsSent(envelope.id);
        result.sent++;
      } else {
        await eventBus.markAsFailed(envelope.id);
        result.failed++;
        result.errors.push(`${envelope.id}: ${pushResult.error}`);
        break;
      }
    }
    if (result.sent > 0) this.circuitBreaker.recordSuccess();
    if (result.failed > 0 || result.errors.length > 0) this.circuitBreaker.recordFailure();
    if (result.sent > 0) {
      await eventBus.purgeOldSentEvents(30).catch(() => {});
      await eventBus.purgeOldFailedEvents(7).catch(() => {});
    }
    return result;
  }
}
