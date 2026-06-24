'use client';

/**
 * Online/Offline Detection Hook
 * 
 * Detecta quando o app está online ou offline.
 */

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    useEffect(() => {
        const handleOnline = () => {
            console.log('🟢 Network: Online');
            setIsOnline(true);
        };

        const handleOffline = () => {
            console.log('🔴 Network: Offline');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
}
