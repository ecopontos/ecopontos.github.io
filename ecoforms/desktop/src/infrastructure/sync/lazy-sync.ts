import { EventSyncAdapter } from './EventSyncAdapter';
import type { CryptoLayer } from './CryptoLayer';
import type { OrgConfigService } from './OrgConfigService';
import type { SqlitePort } from '../../application/ports/SqlitePort';
import type { FileStoragePort } from '../../application/ports/FileStoragePort';
import type { ClockPort } from '../../application/ports/ClockPort';
import type { SyncPort, SyncResult } from '../../application/ports/SyncPort';
import { NullSyncAdapter } from './NullSyncAdapter';
import type { SyncStoragePort } from './SyncStoragePort';
import type { TransportService } from './TransportService';
import type { InboundService } from './InboundService';
import { createSupabaseSyncEventIndex } from 'ecoforms-core';
import { getSupabaseClient } from '../persistence/supabase/supabaseClient';

function isSyncStoragePort(storage: unknown): storage is SyncStoragePort {
    return typeof (storage as SyncStoragePort).ensureBucket === 'function';
}

import type { LanTransport } from './LanTransport';

let _adapter: EventSyncAdapter | null = null;
let _cryptoLayer: CryptoLayer | null = null;
let _transport: TransportService | null = null;
let _inbound: InboundService | null = null;
let _orgConfigService: OrgConfigService | null = null;
let _bootstrapService: import('./StorageBootstrapService').StorageBootstrapService | null = null;
let _lanTransport: LanTransport | null = null;

export async function getSyncAdapter(
    sqlite: SqlitePort,
    fileStorage: FileStoragePort,
    _clock: ClockPort,
    deviceId: string,
    routingId: string,
    _routingType: 'setor' | 'user',
    _appVersion: string,
    _orgId: string = 'ecoforms-org-001'
): Promise<EventSyncAdapter> {
    if (_adapter) return _adapter;

    if (!isSyncStoragePort(fileStorage)) {
        throw new Error('Configured fileStorage does not implement the sync storage contract');
    }

    const syncStorage = fileStorage;

    const { CryptoLayer } = await import('./CryptoLayer');
    const { OrgConfigService } = await import('./OrgConfigService');
    const { StorageBootstrapService } = await import('./StorageBootstrapService');
    const { TransportService: TS } = await import('./TransportService');
    const { InboundService: IS } = await import('./InboundService');
    const { registerAllHandlers } = await import('./HandlerRegistry');

    _cryptoLayer = new CryptoLayer();

    // ADR-056 §8: sync_event_index via RPCs Supabase (substitui Manifest + .enc Storage)
    const supabase = getSupabaseClient();
    if (!supabase) {
        throw new Error('Supabase not configured — sync unavailable in standalone mode');
    }
    const index = createSupabaseSyncEventIndex({
        rpc: async (fn, params) => {
            const { data, error } = await supabase.rpc(fn, params);
            return { data, error };
        },
    });

    // ADR-020: LanFileStorage como canal secundário opcional
    const { LanFileStorage } = await import('../storage/LanFileStorage');
    const lanStorage = new LanFileStorage(sqlite);

    _transport = new TS(_cryptoLayer, sqlite, index, routingId, deviceId);
    _inbound = new IS(_cryptoLayer, sqlite, index, routingId);

    registerAllHandlers(_inbound, sqlite);

    _orgConfigService = new OrgConfigService(syncStorage, sqlite, lanStorage);
    _bootstrapService = new StorageBootstrapService(syncStorage, sqlite, lanStorage);

    _adapter = new EventSyncAdapter(sqlite, _transport, _inbound, _orgConfigService);

    return _adapter;
}

export function getCryptoLayer(): CryptoLayer | null {
    return _cryptoLayer;
}

export function getTransport(): TransportService | null {
    return _transport;
}

export function getLanTransport(): LanTransport | null {
    return _lanTransport;
}

export function setLanTransport(transport: LanTransport | null): void {
    _lanTransport = transport;
}

export function getInbound(): InboundService | null {
    return _inbound;
}

export function getOrgConfigService(): OrgConfigService | null {
    return _orgConfigService;
}

export function getBootstrapService(): import('./StorageBootstrapService').StorageBootstrapService | null {
    return _bootstrapService;
}

export type SyncEventIndexFactory = () => import('ecoforms-core').SyncEventIndexPort;

let _syncEventIndexFactory: SyncEventIndexFactory | null = null;

export function setSyncEventIndexFactory(factory: SyncEventIndexFactory): void {
    _syncEventIndexFactory = factory;
}

export function getSyncEventIndexFactory(): SyncEventIndexFactory | null {
    return _syncEventIndexFactory;
}

export function getSyncTransportService(): TransportService | null {
    return _transport;
}

export function resetSyncAdapter(): void {
    _adapter?.stop?.();
    _adapter = null;
    _cryptoLayer = null;
    _transport = null;
    _inbound = null;
    _orgConfigService = null;
    _bootstrapService = null;
}

export class LazySyncAdapter implements SyncPort {
    private _real: EventSyncAdapter | null = null;
    private _null = new NullSyncAdapter();
    private _config: {
        deviceId: string;
        routingId: string;
        routingType: 'setor' | 'user';
        appVersion: string;
        orgId: string;
    } | null = null;

    constructor(
        private sqlite: SqlitePort,
        private fileStorage: FileStoragePort,
        private clock: ClockPort,
    ) {}

    configure(
        deviceId: string,
        routingId: string,
        routingType: 'setor' | 'user',
        appVersion: string,
        orgId: string = 'ecoforms-org-001'
    ): void {
        this._config = { deviceId, routingId, routingType, appVersion, orgId };
    }

    private async _ensureAdapter(): Promise<EventSyncAdapter> {
        if (this._real) return this._real;
        if (!this._config) {
            throw new Error('LazySyncAdapter not configured — call configure() before using sync');
        }
        this._real = await getSyncAdapter(
            this.sqlite,
            this.fileStorage,
            this.clock,
            this._config.deviceId,
            this._config.routingId,
            this._config.routingType,
            this._config.appVersion,
            this._config.orgId
        );
        return this._real;
    }

    async syncAll(options?: { forcePush?: boolean }): Promise<SyncResult> {
        const adapter = await this._ensureAdapter();
        return adapter.syncAll(options);
    }

    async pushTasks(): Promise<{ sent: number; failed: number; errors: string[] }> {
        try {
            const adapter = await this._ensureAdapter();
            return adapter.pushTasks();
        } catch {
            return this._null.pushTasks();
        }
    }

    async pullTasks(): Promise<void> {
        try {
            const adapter = await this._ensureAdapter();
            return adapter.pullTasks();
        } catch {
            return this._null.pullTasks();
        }
    }

    async getOfflineQueueSize(): Promise<number> {
        try {
            const adapter = await this._ensureAdapter();
            return adapter.getOfflineQueueSize();
        } catch {
            return this._null.getOfflineQueueSize();
        }
    }

    async processOfflineQueue(): Promise<{ processed: number; failed: number }> {
        try {
            const adapter = await this._ensureAdapter();
            return adapter.processOfflineQueue();
        } catch {
            return this._null.processOfflineQueue();
        }
    }

    setKnownRoutingIds(ids: string[]): void {
        if (this._real) {
            this._real.setKnownRoutingIds(ids);
        }
    }
}
