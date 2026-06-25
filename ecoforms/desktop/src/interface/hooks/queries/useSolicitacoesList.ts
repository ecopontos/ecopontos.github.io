/**
 * useSolicitacoesList
 *
 * Objetivo:
 *   Busca os pacotes da suite (contrato v2) com resource_type = 'solicitacao'
 *   criados pelo usuário logado, e os formulários ad-hoc disponíveis para nova submissão.
 *   Recarrega automaticamente quando `userId` muda.
 *
 * Parâmetros:
 *   - `userId: string | undefined` — ID do usuário autenticado (skip quando undefined)
 *
 * Retorno:
 *   - `solicitacoes: SolicitacaoPackage[]`            — lista de pacotes do usuário
 *   - `availableForms: { form_id, titulo }[]`         — formulários ativos e ad-hoc disponíveis
 *   - `loading: boolean`                              — true durante o carregamento inicial
 *   - `error: string | null`                          — mensagem de erro, se houver
 *   - `hasMore: boolean`                              — true se há mais páginas para carregar
 *   - `loadMore(): void`                              — carrega a próxima página
 *   - `fetchSolicitacoes(): Promise<void>`            — recarrega as solicitações (reseta paginação)
 *   - `fetchAvailableForms(): Promise<void>`          — recarrega os formulários disponíveis
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { getContainerAsync } from "@/src/infrastructure/container"
import {
  SOLICITACOES_POR_USUARIO,
  FORMS_AD_HOC_DISPONIVEIS,
} from '@/src/infrastructure/persistence/sqlite/queries/solicitacoes';

const PAGE_SIZE = 25;

export interface SolicitacaoPackage {
    id_pacote: string
    tipo_recurso: string
    tipo_modulo?: string
    status: string
    id_proprietario: string
    criado_em: string
    carga_json: string
    tarefa_gerada_id: string | null
    tarefa_arquivada: number | null
    motivo_rejeicao: string | null
    revisado_em: string | null
    num_versao?: number
}

export function useSolicitacoesList(userId: string | undefined) {
    const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPackage[]>([])
    const [availableForms, setAvailableForms] = useState<{ form_id: string; titulo: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const offsetRef = useRef(0)

    const fetchPage = useCallback(async (offset: number, append: boolean) => {
        if (!userId) return
        try {
            if (!append) setLoading(true)
            setError(null)
            const c = await getContainerAsync()
            const paginatedSql = SOLICITACOES_POR_USUARIO.sql + ` LIMIT ? OFFSET ?`
            const result = await c.sqlite.query<SolicitacaoPackage>(
                paginatedSql,
                [userId, PAGE_SIZE + 1, offset],
            )
            const page = result.slice(0, PAGE_SIZE)
            setHasMore(result.length > PAGE_SIZE)
            setSolicitacoes(prev => append ? [...prev, ...page] : page)
            offsetRef.current = offset + page.length
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error("Erro ao buscar solicitações:", err)
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [userId])

    const fetchSolicitacoes = useCallback(async () => {
        offsetRef.current = 0
        await fetchPage(0, false)
    }, [fetchPage])

    const loadMore = useCallback(() => {
        if (hasMore) fetchPage(offsetRef.current, true)
    }, [hasMore, fetchPage])

    const fetchAvailableForms = useCallback(async () => {
        try {
            const c = await getContainerAsync()
            const result = await c.sqlite.query<{ form_id: string; titulo: string }>(
                FORMS_AD_HOC_DISPONIVEIS.sql,
                [],
            )
            setAvailableForms(result)
        } catch (err) {
            console.error("Erro ao buscar formulários disponíveis:", err)
        }
    }, [])

    useEffect(() => {
        if (userId) {
            fetchSolicitacoes()
            fetchAvailableForms()
        }
    }, [userId, fetchSolicitacoes, fetchAvailableForms])

    return {
        solicitacoes,
        availableForms,
        loading,
        error,
        hasMore,
        loadMore,
        fetchSolicitacoes,
        fetchAvailableForms,
    }
}
