'use client';

import { useLanSync } from '../../contexts/LanSyncContext';

export function LanStatusBadge() {
    const { serverRunning, role, connectionStatus, peers } = useLanSync();

    if (role === 'disabled' && !serverRunning) return null;

    const statusColor =
        connectionStatus === 'connected'
            ? 'bg-green-500'
            : connectionStatus === 'connecting'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-gray-400';

    const label = role === 'hub' ? 'Hub' : role === 'spoke' ? 'Spoke' : 'LAN';
    const peerCount = peers.length;

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-xs">
            <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
            <span className="font-medium">{label}</span>
            {peerCount > 0 && (
                <span className="text-gray-500">({peerCount})</span>
            )}
        </div>
    );
}
