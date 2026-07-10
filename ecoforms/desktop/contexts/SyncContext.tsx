'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSqlite } from '@/src/interface/hooks/catalog/tauri';
import { useOnlineStatus } from '@/src/interface/hooks/catalog/sync';
import { loadSyncConfig, saveSyncAutoEnabled, getRuntimeDeviceId } from '@/src/infrastructure/sync/sync-settings';
import { LazySyncAdapter } from '@/src/infrastructure/sync/lazy-sync';
import { getContainer } from '@/src/infrastructure/container';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SyncHistoryEntry {
    timestamp: Date;
    status: 'success' | 'error';
    pushed: number;
    pulled: number;
    error?: string;
    duration: number;
}

interface SyncState {
    status: 'idle' | 'syncing' | 'success' | 'error' | 'offline';
    lastSync: Date | null;
    error: string | null;
    isOnline: boolean;
    stats: { pushed: number; pulled: number; errors: number };
    history: SyncHistoryEntry[];
    autoSyncEnabled: boolean;
    progress: number;
    retryAttempt: number;
}

interface SyncContextValue extends SyncState {
    syncNow: (forcePush?: boolean) => Promise<void>;
    syncOnFocus: boolean;
    syncInterval: number;
    enableAutoSync: () => void;
    disableAutoSync: () => void;
    resetStats: () => void;
    clearHistory: () => void;
    offlineQueueSize: number;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const DEFAULT_SYNC_CONFIG = loadSyncConfig();

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const sqlite = useSqlite();
    const isOnline = useOnlineStatus();
    const { user } = useAuth();

    const [state, setState] = useState<SyncState>({
        status: 'idle',
        lastSync: null,
        error: null,
        isOnline: true,
        stats: { pushed: 0, pulled: 0, errors: 0 },
        history: [],
        autoSyncEnabled: DEFAULT_SYNC_CONFIG.autoSync,
        progress: 0,
        retryAttempt: 0,
    });

    const [offlineQueueSize, setOfflineQueueSize] = useState(0);

    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isSyncingRef = useRef(false);
    const pendingSyncRef = useRef(false);
    const syncNowRef = useRef<(forcePush?: boolean) => Promise<void>>(() => Promise.resolve());
    const routingWarnedRef = useRef(false);

    const deviceId = getRuntimeDeviceId();
    const routingId = user?.setores?.[0] ?? null;

    // Avisa uma vez por sessão quando routing_id está indefinido.
    useEffect(() => {
        if (routingId === null && !routingWarnedRef.current) {
            routingWarnedRef.current = true;
            console.warn('[Sync] routing_id indefinido — atribua um setor ao usuário para sincronizar eventos.');
            toast.warning('Sync indisponível', {
                description: 'Usuário sem setor atribuído — eventos não serão sincronizados.',
            });
        }
    }, [routingId]);

    const syncNow = useCallback(async (forcePush?: boolean) => {
        if (!isOnline) {
            setState(prev => ({ ...prev, status: 'offline' }));
            toast.warning('Offline', {
                description: 'Sem conexão com a internet',
            });
            return;
        }

        if (!sqlite) return;

        const containerNow = getContainer();
        if (!containerNow.syncReady) {
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'Banco de dados não inicializado — reinicie o app.',
            }));
            toast.error('Sync indisponível', {
                description: 'Banco de dados não inicializado — reinicie o app.',
            });
            return;
        }

        if (routingId === null) {
            setState(prev => ({
                ...prev,
                status: 'error',
                error: 'routing_id indefinido — atribua um setor ao usuário.',
            }));
            return;
        }

        if (isSyncingRef.current) {
            pendingSyncRef.current = true;
            return;
        }

        isSyncingRef.current = true;
        const startTime = Date.now();
        setState(prev => ({ ...prev, status: 'syncing', error: null, progress: 0, retryAttempt: 0 }));

        try {
            const container = getContainer();
            const syncAdapter = container.sync;
            const orgId = user?.org_id ?? 'ecoforms-org-001';
            
            if (syncAdapter instanceof LazySyncAdapter) {
                syncAdapter.configure(deviceId, routingId, 'setor', '1.0.0', orgId);
                await syncAdapter.ensureReady();
            }

            // Popula routing IDs ativos a partir do OrgConfig para habilitar pull/inbound.
            try {
                const { getOrgConfigService } = await import('@/src/infrastructure/sync/lazy-sync');
                const orgConfigService = getOrgConfigService();
                if (orgConfigService) {
                    const orgConfig = await orgConfigService.load();
                    syncAdapter.setKnownRoutingIds(orgConfigService.getActiveRoutingIds(orgConfig));
                }
            } catch (e) {
                console.warn('[Sync] OrgConfig indisponível — inbound desativado neste ciclo:', e);
            }

            const result = await syncAdapter.syncAll(forcePush ? { forcePush } : undefined);
            const pushed = result.synced.tasks_push;
            const pulled = result.synced.tasks_pull;

            const historyEntry: SyncHistoryEntry = {
                timestamp: new Date(),
                status: result.success ? 'success' : 'error',
                pushed,
                pulled,
                error: result.errors[0],
                duration: Date.now() - startTime,
            };

            setState(prev => ({
                ...prev,
                status: result.success ? 'success' as const : 'error' as const,
                lastSync: new Date(),
                error: result.errors[0] ?? null,
                progress: 100,
                stats: {
                    ...prev.stats,
                    pushed: prev.stats.pushed + pushed,
                    pulled: prev.stats.pulled + pulled,
                    errors: prev.stats.errors + result.errors.length,
                },
                history: [historyEntry, ...prev.history].slice(0, 10),
            }));

            setOfflineQueueSize(await syncAdapter.getOfflineQueueSize());

            if (pushed > 0 || pulled > 0) {
                toast.success('Sync completo', {
                    description: `${pushed} eventos enviados, ${pulled} recebidos`,
                });
            }

            if (result.errors.length > 0) {
                toast.warning('Sync com erros', {
                    description: `${result.errors.length} erro(s)`,
                });
            }
        } catch (err) {
            const errorEntry: SyncHistoryEntry = {
                timestamp: new Date(),
                status: 'error' as const,
                pushed: 0,
                pulled: 0,
                error: err instanceof Error ? err.message : String(err),
                duration: Date.now() - startTime,
            };

            setState(prev => ({
                ...prev,
                status: 'error' as const,
                error: err instanceof Error ? err.message : String(err),
                progress: 0,
                stats: { ...prev.stats, errors: prev.stats.errors + 1 },
                history: [errorEntry, ...prev.history].slice(0, 10),
            }));

            if (DEFAULT_SYNC_CONFIG.notifyOnError) {
                toast.error('Erro no sync', {
                    description: err instanceof Error ? err.message : String(err),
                });
            }
        } finally {
            isSyncingRef.current = false;

            if (pendingSyncRef.current) {
                pendingSyncRef.current = false;
                setTimeout(() => { syncNowRef.current(); }, 500);
            }
        }
    }, [sqlite, isOnline, deviceId, routingId]);

    useEffect(() => {
        syncNowRef.current = syncNow;
    }, [syncNow]);

    // Inicializa o adapter real no mount (configure + ensureReady) para que o
    // TransportService fique disponível antes do primeiro syncNow, evitando que
    // mutações enfileiradas em cold-start sejam descartadas pelo SyncOutbox.
    useEffect(() => {
        if (!sqlite || !user || routingId === null) return;
        const container = getContainer();
        const syncAdapter = container.sync;
        if (!(syncAdapter instanceof LazySyncAdapter)) return;
        const orgId = user.org_id ?? 'ecoforms-org-001';
        syncAdapter.configure(deviceId, routingId, 'setor', '1.0.0', orgId);
        syncAdapter.ensureReady().catch(e => {
            console.warn('[Sync] ensureReady falhou no mount — mutações podem ser perdidas até o primeiro sync:', e);
        });
    }, [sqlite, user, deviceId, routingId]);

    const enableAutoSync = useCallback(() => {
        setState(prev => ({ ...prev, autoSyncEnabled: true }));
        saveSyncAutoEnabled(true);
    }, []);

    const disableAutoSync = useCallback(() => {
        setState(prev => ({ ...prev, autoSyncEnabled: false }));
        saveSyncAutoEnabled(false);
        if (syncIntervalRef.current) {
            clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = null;
        }
    }, []);

    const resetStats = useCallback(() => {
        setState(prev => ({ ...prev, stats: { pushed: 0, pulled: 0, errors: 0 } }));
    }, []);

    const clearHistory = useCallback(() => {
        setState(prev => ({ ...prev, history: [] }));
    }, []);

    useEffect(() => {
        setState(prev => ({
            ...prev,
            isOnline,
            status: !isOnline && prev.status === 'syncing' ? 'offline' : prev.status,
        }));
    }, [isOnline]);

    useEffect(() => {
        if (!state.autoSyncEnabled) return;

        const initialTimeout = setTimeout(() => {
            syncNow();
        }, 5000);

        syncIntervalRef.current = setInterval(() => {
            syncNow();
        }, DEFAULT_SYNC_CONFIG.interval);

        return () => {
            clearTimeout(initialTimeout);
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [state.autoSyncEnabled, syncNow]);

    // Bootstrap storage on first mount (first install seeds shared/org_config.json)
    useEffect(() => {
        if (!isOnline || !sqlite || routingId === null) return;

        const bootstrap = async () => {
            try {
                const container = getContainer();
                const { StorageBootstrapService } = await import('@/src/infrastructure/sync/StorageBootstrapService');
                const bootstrapService = new StorageBootstrapService(
                    container.fileStorage as unknown as ConstructorParameters<typeof StorageBootstrapService>[0],
                    container.sqlite
                );
                const result = await bootstrapService.bootstrapIfNeeded(routingId);
                if (result.created) {
                    toast.success('Storage inicializado', {
                        description: result.message,
                    });
                }
                console.log('[Bootstrap]', result.message);
            } catch (e) {
                console.warn('[Bootstrap] Storage bootstrap skipped:', e);
            }
        };

        bootstrap();
    }, [isOnline, sqlite, routingId]);

    // Job de cobrança automática — roda ao iniciar e a cada 60 minutos
    useEffect(() => {
        if (!sqlite || !user) return;

        const run = async () => {
            try {
                const { verificarPrazosVencidos } = await import('@/src/application/ouvidoria/VerificarPrazosVencidosJob');
                const container = getContainer();
                await verificarPrazosVencidos(container.sqlite, container.syncOutbox);
            } catch (e) {
                console.warn('[PrazosJob]', e);
            }
        };

        run();
        const intervalId = setInterval(run, 60 * 60 * 1000);
        return () => clearInterval(intervalId);
    }, [sqlite, user]);

    useEffect(() => {
        if (!DEFAULT_SYNC_CONFIG.syncOnFocus) return;

        const handleFocus = () => {
            if (state.lastSync) {
                const timeSinceLastSync = Date.now() - state.lastSync.getTime();
                if (timeSinceLastSync > 60 * 1000) {
                    syncNow();
                }
            } else {
                syncNow();
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [state.lastSync, syncNow]);

    const value: SyncContextValue = {
        ...state,
        autoSyncEnabled: state.autoSyncEnabled,
        syncNow,
        syncOnFocus: DEFAULT_SYNC_CONFIG.syncOnFocus,
        syncInterval: DEFAULT_SYNC_CONFIG.interval,
        enableAutoSync,
        disableAutoSync,
        resetStats,
        clearHistory,
        offlineQueueSize,
    };

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    );
}

export function useSyncStatus() {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSyncStatus must be used within SyncProvider');
    }
    return context;
}