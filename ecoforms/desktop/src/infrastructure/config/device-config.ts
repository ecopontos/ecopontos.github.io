import { uuidv7 } from 'ecoforms-core';
/**
 * Device Configuration Utilities
 * Gerencia configuração do dispositivo (nome, ID, etc.)
 */

export interface DeviceConfig {
    deviceName: string;
    deviceId: string;
    setupDate: string;
}

const DEVICE_CONFIG_KEY = 'ecoforms_device_config';

function sanitizeDeviceId(id: string): string {
    return id.replace(/_/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Obtém a configuração atual do dispositivo
 */
export function getDeviceConfig(): DeviceConfig {
    if (typeof window === 'undefined') {
        // SSR fallback — retorna config padrão sem tocar no localStorage
        return {
            deviceName: `Desktop-SSR`,
            deviceId: `desktop-ssr-${Date.now()}`,
            setupDate: new Date().toISOString()
        };
    }

    try {
        const configStr = localStorage.getItem(DEVICE_CONFIG_KEY);
        if (configStr) {
            const config: DeviceConfig = JSON.parse(configStr);
            const clean = sanitizeDeviceId(config.deviceId);
            if (clean !== config.deviceId) {
                config.deviceId = clean;
                localStorage.setItem(DEVICE_CONFIG_KEY, JSON.stringify(config));
            }
            return config;
        }
    } catch (error) {
        console.warn('Erro ao carregar configuração do dispositivo:', error);
    }

    // Criar configuração padrão se não existir
    const rawDeviceId = `desktop-${uuidv7()}`;
    const defaultConfig: DeviceConfig = {
        deviceName: `Desktop-${Date.now().toString().slice(-6)}`,
        deviceId: sanitizeDeviceId(rawDeviceId),
        setupDate: new Date().toISOString()
    };

    saveDeviceConfig(defaultConfig);
    return defaultConfig;
}

/**
 * Salva a configuração do dispositivo
 */
export function saveDeviceConfig(config: DeviceConfig): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(DEVICE_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
        console.error('Erro ao salvar configuração do dispositivo:', error);
        throw error;
    }
}

/**
 * Obtém apenas o nome do dispositivo
 */
export function getDeviceName(): string {
    return getDeviceConfig().deviceName;
}

/**
 * Obtém apenas o ID do dispositivo
 */
export function getDeviceId(): string {
    return getDeviceConfig().deviceId;
}

/**
 * Atualiza apenas o nome do dispositivo
 */
export function updateDeviceName(deviceName: string): void {
    const config = getDeviceConfig();
    const updatedConfig: DeviceConfig = {
        ...config,
        deviceName: deviceName.trim()
    };
    saveDeviceConfig(updatedConfig);
}

/**
 * Gera um novo ID para o dispositivo
 */
export function regenerateDeviceId(): string {
    const rawId = `desktop-${uuidv7()}`;
    const newId = sanitizeDeviceId(rawId);
    const config = getDeviceConfig();
    const updatedConfig: DeviceConfig = {
        ...config,
        deviceId: newId,
        setupDate: new Date().toISOString()
    };
    saveDeviceConfig(updatedConfig);
    return newId;
}
