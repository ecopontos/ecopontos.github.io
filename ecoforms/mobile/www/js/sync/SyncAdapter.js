import { CryptoLayer } from './CryptoLayer.js';
import { EventBus } from './EventBus.js';
import { TransportService } from './TransportService.js';
import { InboundService } from './InboundService.js';
import { SyncBootstrap } from './SyncBootstrap.js';
import { SupabaseStorage } from './SupabaseStorage.js';
import { registerAllHandlers } from './HandlerRegistry.js';
import { openSyncEventDB, closeSyncEventDB } from './SyncEventDB.js';
import { createSupabaseSyncEventIndex } from '/js/ecoforms-core.js';

export class SyncAdapter {
  constructor() {
    this.cryptoLayer = null;
    this.eventBus = null;
    this.transportService = null;
    this.inboundService = null;
    this.index = null;
    this.bootstrap = null;
    this.storage = null;
    this.routingId = null;
    this.deviceId = null;
    this.knownRoutingIds = [];
    this._syncInterval = null;
    this._started = false;
  }

  async start(password, user) {
    if (this._started) return;

    this.deviceId = user.id;
    this.routingId = user.setor || 'mobile-default';

    await openSyncEventDB();

    this.storage = new SupabaseStorage();
    this.cryptoLayer = new CryptoLayer();
    await this.cryptoLayer.deriveKey(password, user.sync_salt);

    this.eventBus = new EventBus(this.deviceId, this.routingId);
    // ADR-056 §8: sync_event_index via RPCs Supabase (substitui Manifest + .enc Storage)
    this.index = createSupabaseSyncEventIndex({
      rpc: async (fn, params) => {
        const { data, error } = await this.storage.getClient().rpc(fn, params);
        return { data, error };
      },
    });
    this.transportService = new TransportService(
      this.cryptoLayer, this.index, this.routingId, this.deviceId
    );
    this.inboundService = new InboundService(
      this.cryptoLayer, this.index, this.eventBus, this.routingId
    );
    this.bootstrap = new SyncBootstrap(this.storage);

    registerAllHandlers(this.eventBus);

    const { knownRoutingIds } = await this.bootstrap.bootstrap(user.setor);
    this.knownRoutingIds = knownRoutingIds;

    this._started = true;
    console.log('[SyncAdapter] Iniciado', { routingId: this.routingId, routingIds: this.knownRoutingIds });
  }

  async stop() {
    this.stopAutoSync();
    this.cryptoLayer?.clearKey();
    this.cryptoLayer = null;
    this.eventBus = null;
    this.transportService = null;
    this.inboundService = null;
    this.index = null;
    this.bootstrap = null;
    this.storage = null;
    this._started = false;
    closeSyncEventDB();
    console.log('[SyncAdapter] Parado');
  }

  isStarted() {
    return this._started;
  }

  async syncNow() {
    if (!this._started) throw new Error('SyncAdapter não iniciado');

    const result = { pushed: 0, pulled: 0, errors: [] };

    try {
      const pushResult = await this.transportService.pushPending(this.eventBus);
      result.pushed = pushResult.sent;
      result.errors.push(...pushResult.errors);
    } catch (err) {
      result.errors.push(`push: ${String(err)}`);
    }

    try {
      const pullResult = await this.inboundService.pull(this.knownRoutingIds);
      result.pulled = pullResult.processed;
      result.errors.push(...pullResult.errors);
    } catch (err) {
      result.errors.push(`pull: ${String(err)}`);
    }

    return result;
  }

  startAutoSync(intervalMs = 60000) {
    this.stopAutoSync();
    this._syncInterval = setInterval(async () => {
      try {
        await this.syncNow();
      } catch (err) {
        console.warn('[SyncAdapter] Erro no auto-sync:', err);
      }
    }, intervalMs);
  }

  stopAutoSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
  }

  async publishEvent(type, data, opts = {}) {
    if (!this._started) throw new Error('SyncAdapter não iniciado');
    return this.eventBus.publish(type, data, opts);
  }
}
