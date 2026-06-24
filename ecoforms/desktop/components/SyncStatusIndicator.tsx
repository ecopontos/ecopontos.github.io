'use client';

/**
 * Sync Status Indicator - Enhanced Version
 * 
 * Indicador visual com progress, history e offline detection.
 */

import { useState } from 'react';
import { useSyncStatus } from '@/contexts/SyncContext';
import { useKeyboardShortcuts } from '@/src/interface/hooks/catalog/utils';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2, WifiOff, History } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function SyncStatusIndicator() {
    const {
        status,
        lastSync,
        syncNow,
        stats,
        autoSyncEnabled,
        enableAutoSync,
        disableAutoSync,
        isOnline,
        progress,
        history,
        retryAttempt,
        clearHistory,
    } = useSyncStatus();
    const [isOpen, setIsOpen] = useState(false);

    // Atalho Ctrl+S para sync manual
    useKeyboardShortcuts([
        {
            key: 's',
            ctrl: true,
            description: 'Sincronizar agora',
            callback: () => {
                syncNow();
            },
        },
    ]);

    // Determinar ícone e cor baseado no status
    const getStatusIcon = () => {
        if (!isOnline) {
            return <WifiOff className="h-4 w-4 text-gray-400" />;
        }

        switch (status) {
            case 'syncing':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'offline':
                return <WifiOff className="h-4 w-4 text-orange-500" />;
            default:
                return <Clock className="h-4 w-4 text-gray-400" />;
        }
    };

    const getStatusText = () => {
        if (!isOnline) return 'Offline';

        switch (status) {
            case 'syncing':
                return retryAttempt > 0
                    ? `Tentativa ${retryAttempt}/3...`
                    : 'Sincronizando...';
            case 'success':
                return lastSync
                    ? `Sincronizado ${formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })}`
                    : 'Sincronizado';
            case 'error':
                return 'Erro no sync';
            case 'offline':
                return 'Offline';
            default:
                return 'Nunca sincronizado';
        }
    };

    const handleSyncNow = async () => {
        setIsOpen(false);
        await syncNow();
    };

    const toggleAutoSync = () => {
        if (autoSyncEnabled) {
            disableAutoSync();
        } else {
            enableAutoSync();
        }
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 relative"
                    title={getStatusText()}
                >
                    {getStatusIcon()}
                    <span className="hidden md:inline text-xs text-gray-600">
                        {status === 'syncing' ? `${progress}%` : 'Sync'}
                    </span>

                    {/* Progress bar durante sync */}
                    {status === 'syncing' && (
                        <div className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all"
                            style={{ width: `${progress}%` }} />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <div className="px-2 py-1.5">
                    <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon()}
                        <span className="text-sm font-medium">{getStatusText()}</span>
                        {!isOnline && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                Sem internet
                            </span>
                        )}
                    </div>

                    {lastSync && (
                        <div className="text-xs text-gray-500 mb-2">
                            Último sync: {lastSync.toLocaleString('pt-BR')}
                        </div>
                    )}

                    {/* Estatísticas */}
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 bg-gray-50 rounded p-2 mb-2">
                        <div>
                            <div className="font-medium">Enviados</div>
                            <div className="text-lg font-bold text-blue-600">{stats.pushed}</div>
                        </div>
                        <div>
                            <div className="font-medium">Recebidos</div>
                            <div className="text-lg font-bold text-green-600">{stats.pulled}</div>
                        </div>
                        <div>
                            <div className="font-medium">Erros</div>
                            <div className="text-lg font-bold text-red-600">{stats.errors}</div>
                        </div>
                    </div>

                    {/* Histórico */}
                    {history.length > 0 && (
                        <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
                                    <History className="h-3 w-3" />
                                    Histórico ({history.length})
                                </div>
                                <button
                                    onClick={clearHistory}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                    Limpar
                                </button>
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {history.map((entry, idx) => (
                                    <div key={idx} className="text-xs p-1.5 bg-gray-50 rounded flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            {entry.status === 'success' ? (
                                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <XCircle className="h-3 w-3 text-red-500" />
                                            )}
                                            <span className="text-gray-600">
                                                {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: ptBR })}
                                            </span>
                                        </div>
                                        <span className="text-gray-500">
                                            {entry.status === 'success'
                                                ? `${entry.pushed + entry.pulled} itens (${entry.duration}ms)`
                                                : entry.error?.substring(0, 20) + '...'
                                            }
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={handleSyncNow}
                    disabled={status === 'syncing' || !isOnline}
                    className="cursor-pointer"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizar Agora {!isOnline && '(Offline)'}
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={toggleAutoSync}
                    className="cursor-pointer"
                >
                    <div className="flex items-center justify-between w-full">
                        <span>Sync Automático</span>
                        <div className={`w-10 h-5 rounded-full transition-colors ${autoSyncEnabled ? 'bg-green-500' : 'bg-gray-300'
                            }`}>
                            <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${autoSyncEnabled ? 'ml-5' : 'ml-0.5'
                                }`} />
                        </div>
                    </div>
                </DropdownMenuItem>

                {autoSyncEnabled && (
                    <div className="px-2 py-1 text-xs text-gray-500">
                        Sync automático a cada 5 minutos
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
