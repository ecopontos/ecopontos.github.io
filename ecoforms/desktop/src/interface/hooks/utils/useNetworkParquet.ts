/**
 * useNetworkParquet
 *
 * Gerencia a configuração da pasta de rede compartilhada para armazenamento de arquivos Parquet.
 * A pasta é salva na tabela `configuracoes_sistema` (chave `network.parquet_path`) via SQLite local,
 * garantindo que a configuração persista entre sessões e seja acessível ao backend Rust.
 *
 * Retorno:
 *   - `path: string`            — caminho atual configurado (vazio se não configurado)
 *   - `probeResult`             — resultado da última sondagem (acessível, legível, gravável)
 *   - `parquetFiles`            — lista de arquivos .parquet encontrados na pasta
 *   - `isProbing: boolean`      — true enquanto testa o caminho
 *   - `isSaving: boolean`       — true enquanto persiste no banco
 *   - `isListing: boolean`      — true enquanto lista os arquivos
 *   - `setPath(path: string)`   — atualiza o caminho localmente (não salva ainda)
 *   - `probe()`                 — testa o caminho atual (leitura, escrita, existência)
 *   - `save()`                  — persiste o caminho no configuracoes_sistema e faz probe automático
 *   - `listFiles()`             — lista arquivos .parquet na pasta configurada
 */
import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { useSqlite } from "../queries/useSqlite"
import { SISTEMA_CONFIG_GET, SISTEMA_CONFIG_SAVE } from '@/src/application/persistence/sqlite/queries/system'

interface ProbeResult {
    accessible: boolean
    readable: boolean
    writable: boolean
    error: string | null
}

interface ParquetFileInfo {
    name: string
    size: number
    modified: string | null
    full_path: string
}

export function useNetworkParquet() {
    const [path, setPath] = useState("")
    const [probeResult, setProbeResult] = useState<ProbeResult | null>(null)
    const [parquetFiles, setParquetFiles] = useState<ParquetFileInfo[]>([])
    const [isProbing, setIsProbing] = useState(false)
    const [isListing, setIsListing] = useState(false)

    const sqlite = useSqlite()
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        sqlite.query<{ value: string }>(SISTEMA_CONFIG_GET.sql, ['network.parquet_path'])
            .then(rows => { if (rows[0]?.value) setPath(rows[0].value); })
            .catch(() => {});
    }, [sqlite])

    const probe = useCallback(async (targetPath?: string): Promise<ProbeResult | null> => {
        const p = targetPath ?? path
        if (!p.trim()) {
            toast.error("Informe um caminho antes de testar")
            return null
        }
        setIsProbing(true)
        try {
            const result = await invoke<ProbeResult>("network_probe_path", { path: p })
            setProbeResult(result)
            if (!result.accessible) {
                toast.error(`Pasta inacessível: ${result.error ?? "caminho não encontrado"}`)
            } else if (!result.writable) {
                toast.warning("Pasta acessível mas sem permissão de escrita")
            } else {
                toast.success("Pasta acessível — leitura e escrita OK")
            }
            return result
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            toast.error(`Erro ao testar caminho: ${msg}`)
            setProbeResult(null)
            return null
        } finally {
            setIsProbing(false)
        }
    }, [path])

    const save = useCallback(async () => {
        if (!path.trim()) {
            toast.error("Informe um caminho para salvar")
            return
        }

        const result = await probe(path)
        if (!result?.accessible) return

        setIsSaving(true)
        try {
            await sqlite.execute(
                SISTEMA_CONFIG_SAVE.sql,
                ['network.parquet_path', path]
            )
            toast.success("Pasta de rede salva com sucesso")
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            toast.error(`Erro ao salvar configuração: ${msg}`)
        } finally {
            setIsSaving(false)
        }
    }, [sqlite, path, probe])

    const listFiles = useCallback(async () => {
        if (!path.trim()) return
        setIsListing(true)
        try {
            const files = await invoke<ParquetFileInfo[]>("network_list_parquet", { path })
            setParquetFiles(files)
            if (files.length === 0) {
                toast.info("Nenhum arquivo .parquet encontrado na pasta")
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            toast.error(`Erro ao listar arquivos: ${msg}`)
        } finally {
            setIsListing(false)
        }
    }, [path])

    return {
        path,
        setPath,
        probeResult,
        parquetFiles,
        isProbing,
        isSaving,
        isListing,
        probe,
        save,
        listFiles,
    }
}
