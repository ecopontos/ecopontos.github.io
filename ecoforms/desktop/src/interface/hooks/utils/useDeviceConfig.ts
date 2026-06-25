/**
 * useDeviceConfig
 *
 * Objetivo:
 *   Lê e persiste a configuração do dispositivo local (nome e ID únicos do dispositivo).
 *   Os dados são armazenados via `lib/device-config` (localStorage + Tauri store).
 *   Usado na página de configurações do admin para identificar o dispositivo na sincronização.
 *
 * Parâmetros:
 *   Nenhum — carrega a configuração automaticamente no mount.
 *
 * Retorno:
 *   - `deviceConfig: DeviceConfig | null`  — configuração completa { deviceId, deviceName }
 *   - `deviceName: string`                 — rascunho editável do nome do dispositivo
 *   - `setDeviceName`                      — setter para atualizar o rascunho antes de salvar
 *   - `isLoading: boolean`                 — true durante a leitura inicial
 *   - `isSaving: boolean`                  — true durante o `save()`
 *   - `save(): Promise<void>`              — persiste `deviceName` (validado: não pode ser vazio)
 *   - `regenerateId(): void`               — gera um novo UUID de dispositivo e atualiza o estado
 *
 * Exemplo de uso:
 *   ```tsx
 *   const { deviceName, setDeviceName, isSaving, save, regenerateId } = useDeviceConfig();
 *   return (
 *     <>
 *       <Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
 *       <Button onClick={save} disabled={isSaving}>Salvar</Button>
 *       <Button variant="outline" onClick={regenerateId}>Regenerar ID</Button>
 *     </>
 *   );
 *   ```
 */
import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
    getDeviceConfig,
    updateDeviceName,
    regenerateDeviceId,
    type DeviceConfig
} from "@/src/infrastructure/config/device-config"

export function useDeviceConfig() {
    const [deviceConfig, setDeviceConfig] = useState<DeviceConfig | null>(null)
    const [deviceName, setDeviceName] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        setIsLoading(true)
        try {
            const config = getDeviceConfig()
            setDeviceConfig(config)
            setDeviceName(config.deviceName)
        } catch (error) {
            console.error("Erro ao carregar configuração do dispositivo:", error)
            toast.error("Falha ao carregar configuração do dispositivo")
        } finally {
            setIsLoading(false)
        }
    }, [])

    const save = async () => {
        if (!deviceName.trim()) {
            toast.error("O nome do dispositivo não pode estar vazio")
            return
        }
        setIsSaving(true)
        try {
            updateDeviceName(deviceName.trim())
            setDeviceConfig(getDeviceConfig())
            toast.success("Configuração do dispositivo salva com sucesso")
        } catch (error) {
            console.error("Erro ao salvar configuração:", error)
            toast.error("Falha ao salvar configuração do dispositivo")
        } finally {
            setIsSaving(false)
        }
    }

    const regenerateId = () => {
        regenerateDeviceId()
        setDeviceConfig(getDeviceConfig())
        toast.success("Novo ID do dispositivo gerado")
    }

    return {
        deviceConfig,
        deviceName,
        setDeviceName,
        isLoading,
        isSaving,
        save,
        regenerateId,
    }
}
