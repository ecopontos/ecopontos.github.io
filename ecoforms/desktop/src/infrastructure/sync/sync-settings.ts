import { getDeviceId, saveDeviceConfig } from '../config/device-config';

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
 * Returns the runtime device ID, sourced from the canonical device config store
 * (`ecoforms_device_config`, edited via the Settings UI). Migra o valor legacy
 * `routing_id`/`device_id` uma única vez se o store canônico estiver vazio.
 */
export function getRuntimeDeviceId(): string {
    if (typeof localStorage === 'undefined') return 'runtime-unknown';

    // Migração one-shot: se o store canônico não existe mas há valor legacy.
    if (!localStorage.getItem('ecoforms_device_config')) {
        const legacy = localStorage.getItem('routing_id') ?? localStorage.getItem('device_id');
        if (legacy) {
            saveDeviceConfig({
                deviceName: `Desktop-${Date.now().toString().slice(-6)}`,
                deviceId: legacy,
                setupDate: new Date().toISOString(),
            });
            localStorage.removeItem('routing_id');
            localStorage.removeItem('device_id');
        }
    }

    return getDeviceId();
}
