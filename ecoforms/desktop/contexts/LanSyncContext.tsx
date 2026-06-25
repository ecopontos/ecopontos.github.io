'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { LanWebSocketClient } from '../src/infrastructure/sync/LanWebSocketClient';

interface PeerInfo {
    device_id: string;
    display_name: string;
    addr: string;
    role: string;
}

interface LanSyncState {
    serverRunning: boolean;
    role: 'hub' | 'spoke' | 'disabled';
    peers: PeerInfo[];
    connectionStatus: 'connected' | 'disconnected' | 'connecting';
    port: number;
    hubAddress: string | null;
}

interface LanSyncContextValue extends LanSyncState {
    startServer: (role?: 'hub' | 'spoke', port?: number) => Promise<void>;
    stopServer: () => Promise<void>;
    setRole: (role: 'hub' | 'spoke' | 'disabled', hubAddr?: string) => Promise<void>;
    discoverPeers: () => Promise<PeerInfo[]>;
    refreshStatus: () => Promise<void>;
}

const LanSyncContext = createContext<LanSyncContextValue | null>(null);

export function LanSyncProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<LanSyncState>({
        serverRunning: false,
        role: 'disabled',
        peers: [],
        connectionStatus: 'disconnected',
        port: 9400,
        hubAddress: null,
    });

    const wsClientRef = useRef<LanWebSocketClient | null>(null);

    const invoke = useCallback(async <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
        const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
        return tauriInvoke<T>(cmd, args);
    }, []);

    const refreshStatus = useCallback(async () => {
        try {
            const info = await invoke<{
                running: boolean;
                role: string;
                port: number;
                peer_count: number;
                hub_addr: string | null;
            }>('lan_server_status');

            setState((prev) => ({
                ...prev,
                serverRunning: info.running,
                role: (info.role as 'hub' | 'spoke' | 'disabled') ?? 'disabled',
                port: info.port,
                hubAddress: info.hub_addr,
            }));
        } catch {
            // server not available
        }
    }, [invoke]);

    const startServer = useCallback(async (role?: 'hub' | 'spoke', port?: number) => {
        setState((prev) => ({ ...prev, connectionStatus: 'connecting' }));
        try {
            const info = await invoke<{ running: boolean; role: string; port: number; hub_addr: string | null }>(
                'lan_server_start',
                { port: port ?? state.port, role: role ?? undefined },
            );

            setState((prev) => ({
                ...prev,
                serverRunning: true,
                role: info.role as 'hub' | 'spoke' | 'disabled',
                port: info.port,
                hubAddress: info.hub_addr,
                connectionStatus: 'connected',
            }));

            if (info.role === 'spoke' && info.hub_addr) {
                connectWs(`ws://${info.hub_addr}/ws`);
            }
        } catch (e) {
            setState((prev) => ({ ...prev, connectionStatus: 'disconnected' }));
            throw e;
        }
    }, [invoke, state.port]);

    const stopServer = useCallback(async () => {
        wsClientRef.current?.disconnect();
        wsClientRef.current = null;
        await invoke('lan_server_stop');
        setState((prev) => ({
            ...prev,
            serverRunning: false,
            connectionStatus: 'disconnected',
            peers: [],
        }));
    }, [invoke]);

    const setRole = useCallback(async (role: 'hub' | 'spoke' | 'disabled', hubAddr?: string) => {
        await invoke('lan_server_set_role', { role, hubAddr: hubAddr ?? null });
        setState((prev) => ({ ...prev, role }));
    }, [invoke]);

    const discoverPeers = useCallback(async (): Promise<PeerInfo[]> => {
        const peers = await invoke<PeerInfo[]>('lan_server_discover_peers');
        setState((prev) => ({ ...prev, peers }));
        return peers;
    }, [invoke]);

    const connectWs = useCallback((url: string) => {
        wsClientRef.current?.disconnect();

        const deviceId = `device-${Math.random().toString(36).slice(2, 10)}`;
        const client = new LanWebSocketClient(url, deviceId, 'EcoForms Desktop');
        wsClientRef.current = client;

        client.on('connected', () => {
            setState((prev) => ({ ...prev, connectionStatus: 'connected' }));
        });

        client.on('disconnected', () => {
            setState((prev) => ({ ...prev, connectionStatus: 'disconnected' }));
        });

        client.on('presence', (data) => {
            const peers = (data.peers as PeerInfo[]) ?? [];
            setState((prev) => ({ ...prev, peers }));
        });

        client.on('peer_joined', () => {
            discoverPeers().catch(() => {});
        });

        client.on('peer_left', () => {
            discoverPeers().catch(() => {});
        });

        client.connect();
    }, [discoverPeers]);

    useEffect(() => {
        refreshStatus();
        return () => {
            wsClientRef.current?.disconnect();
        };
    }, [refreshStatus]);

    const value: LanSyncContextValue = {
        ...state,
        startServer,
        stopServer,
        setRole,
        discoverPeers,
        refreshStatus,
    };

    return (
        <LanSyncContext.Provider value={value}>
            {children}
        </LanSyncContext.Provider>
    );
}

export function useLanSync(): LanSyncContextValue {
    const ctx = useContext(LanSyncContext);
    if (!ctx) throw new Error('useLanSync must be used within LanSyncProvider');
    return ctx;
}
