/**
 * Catálogo: Sincronização e Conectividade
 *
 * Hooks para o sistema de sync de eventos, configuração do dispositivo,
 * status de rede e barramento de eventos de domínio.
 */
// --- Contextos de sync/LAN ---
export { useSyncStatus } from '@/contexts/SyncContext';
export { useLanSync } from '@/contexts/LanSyncContext';


export { useSync } from '../queries/useSync';                           // ativo — acesso ao SyncAdapter
export { useSyncSettings } from '../queries/useSyncSettings';           // ativo — prefs de sync (intervalo, on-focus)
export { useDeviceConfig } from '../utils/useDeviceConfig';             // ativo — deviceId e deviceName locais
export { useOnlineStatus } from '../utils/useOnlineStatus';             // ativo — online/offline detector
export { useSyncOutbox, useEventBus } from '../utils/useEventBus';      // ativo — acesso ao SyncOutbox (useEventBus: deprecated alias)
