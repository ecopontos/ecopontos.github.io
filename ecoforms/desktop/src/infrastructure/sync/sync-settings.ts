import { uuidv7 } from 'ecoforms-core';

/**
 * Persistent sync configuration — reads/writes from localStorage.
 */

export interface SyncConfig {
    autoSync: boolean;
    interval: number;
    syncOnFocus: boolean;
    notifyOnSuccess: boolean;
    notifyOnError: boolean;
}

export function loadSyncConfig(): SyncConfig {
    if (typeof localStorage === 'undefined') {
        return {
            autoSync: true,
            interval: 5 * 60 * 1000,
            syncOnFocus: true,
            notifyOnSuccess: true,
            notifyOnError: true,
        };
    }

    return {
        autoSync: localStorage.getItem('sync_auto_enabled') !== 'false',
        interval: parseInt(localStorage.getItem('sync_interval') || '300000'),
        syncOnFocus: localStorage.getItem('sync_on_focus') !== 'false',
        notifyOnSuccess: localStorage.getItem('notify_on_success') !== 'false',
        notifyOnError: localStorage.getItem('notify_on_error') !== 'false',
    };
}

export function saveSyncAutoEnabled(enabled: boolean): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sync_auto_enabled', enabled ? 'true' : 'false');
    }
}

/**
 * Returns or generates a stable runtime device ID stored in localStorage.
 */
export function getRuntimeDeviceId(): string {
    if (typeof localStorage !== 'undefined') {
        let id = localStorage.getItem('routing_id');
        if (!id) {
            // Migrate legacy key
            const legacy = localStorage.getItem('device_id');
            if (legacy) {
                id = legacy;
                localStorage.setItem('routing_id', id);
                localStorage.removeItem('device_id');
            }
        }
        if (!id) {
            id = `runtime-${uuidv7()}`;
            localStorage.setItem('routing_id', id);
        }
        return id;
    }
    return 'runtime-unknown';
}
