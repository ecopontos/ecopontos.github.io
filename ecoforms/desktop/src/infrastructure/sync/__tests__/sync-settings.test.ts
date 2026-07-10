import { describe, expect, it, beforeEach } from 'vitest';

import { getRuntimeDeviceId } from '../sync-settings';

const DEVICE_CONFIG_KEY = 'ecoforms_device_config';

describe('getRuntimeDeviceId', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('delega ao store canônico device-config quando já existe', () => {
        const config = {
            deviceName: 'Desktop-001',
            deviceId: 'desktop-abc-123',
            setupDate: new Date().toISOString(),
        };
        localStorage.setItem(DEVICE_CONFIG_KEY, JSON.stringify(config));

        expect(getRuntimeDeviceId()).toBe('desktop-abc-123');
        // Não cria chave legacy.
        expect(localStorage.getItem('routing_id')).toBeNull();
    });

    it('migra valor legacy routing_id para o store canônico (one-shot)', () => {
        localStorage.setItem('routing_id', 'legacy-runtime-id');

        const id = getRuntimeDeviceId();

        expect(id).toBe('legacy-runtime-id');
        // Store canônico agora populado.
        const config = JSON.parse(localStorage.getItem(DEVICE_CONFIG_KEY)!);
        expect(config.deviceId).toBe('legacy-runtime-id');
        // Chave legacy removida.
        expect(localStorage.getItem('routing_id')).toBeNull();
        expect(localStorage.getItem('device_id')).toBeNull();
    });

    it('migra valor legacy device_id quando routing_id ausente', () => {
        localStorage.setItem('device_id', 'legacy-device-id');

        expect(getRuntimeDeviceId()).toBe('legacy-device-id');
        expect(localStorage.getItem('device_id')).toBeNull();
    });

    it('gera novo device config quando não há valor algum', () => {
        const id = getRuntimeDeviceId();

        expect(id).toMatch(/^desktop-/);
        const config = JSON.parse(localStorage.getItem(DEVICE_CONFIG_KEY)!);
        expect(config.deviceId).toBe(id);
    });
});
