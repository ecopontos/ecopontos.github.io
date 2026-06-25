/**
 * useSyncSettings
 *
 * Objetivo:
 *   Lê e persiste as preferências de sincronização automática do usuário no localStorage.
 *   Controla intervalo de sync, sync ao focar a janela e notificações de sucesso/erro.
 *   Usado na página de configurações de admin; as mudanças são aplicadas no próximo ciclo
 *   do `SyncContext` (que lê o localStorage ao inicializar via `loadSyncConfig()`).
 *
 * Parâmetros:
 *   Nenhum — carrega os valores do localStorage automaticamente no mount.
 *
 * Retorno:
 *   - `syncInterval: string`            — intervalo em ms como string (ex: `'300000'`)
 *   - `setSyncInterval`                 — setter
 *   - `syncOnFocus: boolean`            — se true, sincroniza ao focar a janela do browser
 *   - `setSyncOnFocus`                  — setter
 *   - `notifyOnSuccess: boolean`        — se true, exibe toast de sucesso após sync
 *   - `setNotifyOnSuccess`              — setter
 *   - `notifyOnError: boolean`          — se true, exibe toast de erro em falhas
 *   - `setNotifyOnError`                — setter
 *   - `save(): void`                    — grava todos os valores no localStorage e exibe confirmação
 *
 * Exemplo de uso:
 *   ```tsx
 *   const { syncInterval, setSyncInterval, notifyOnSuccess, setNotifyOnSuccess, save } =
 *     useSyncSettings();
 *   return (
 *     <>
 *       <Select value={syncInterval} onValueChange={setSyncInterval}>...</Select>
 *       <Switch checked={notifyOnSuccess} onCheckedChange={setNotifyOnSuccess} />
 *       <Button onClick={save}>Aplicar</Button>
 *     </>
 *   );
 *   ```
 */
import { useState, useEffect } from "react"
import { toast } from "sonner"

export function useSyncSettings() {
    const [syncInterval, setSyncInterval] = useState('300000')
    const [syncOnFocus, setSyncOnFocus] = useState(true)
    const [notifyOnSuccess, setNotifyOnSuccess] = useState(true)
    const [notifyOnError, setNotifyOnError] = useState(true)

    useEffect(() => {
        const load = () => {
            if (typeof localStorage === 'undefined') return;
            const savedInterval = localStorage.getItem('sync_interval');
            const savedSyncOnFocus = localStorage.getItem('sync_on_focus');
            const savedNotifySuccess = localStorage.getItem('notify_on_success');
            const savedNotifyError = localStorage.getItem('notify_on_error');
            if (savedInterval) setSyncInterval(savedInterval);
            if (savedSyncOnFocus) setSyncOnFocus(savedSyncOnFocus === 'true');
            if (savedNotifySuccess) setNotifyOnSuccess(savedNotifySuccess === 'true');
            if (savedNotifyError) setNotifyOnError(savedNotifyError === 'true');
        };
        load();
    }, [])

    const save = () => {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem('sync_interval', syncInterval)
        localStorage.setItem('sync_on_focus', syncOnFocus.toString())
        localStorage.setItem('notify_on_success', notifyOnSuccess.toString())
        localStorage.setItem('notify_on_error', notifyOnError.toString())
        toast.success("Configurações de sincronização aplicadas!")
    }

    return {
        syncInterval,
        setSyncInterval,
        syncOnFocus,
        setSyncOnFocus,
        notifyOnSuccess,
        setNotifyOnSuccess,
        notifyOnError,
        setNotifyOnError,
        save,
    }
}
