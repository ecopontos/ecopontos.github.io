/* eslint-disable react-hooks/set-state-in-effect */
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
 *   - `fetchSolicitacoes(): Promise<void>`            — recarrega as solicitações
 *   - `fetchAvailableForms(): Promise<void>`          — recarrega os formulários disponíveis
 */
import { useState, useEffect, useCallback } from "react"
import { getContainerAsync } from "../utils/useContainer"
import {
  SOLICITACOES_POR_USUARIO,
  FORMS_AD_HOC_DISPONIVEIS,
} from '@/src/infrastructure/persistence/sqlite/queries/solicitacoes';

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

    const fetchSolicitacoes = useCallback(async () => {
        if (!userId) return
        try {
            setLoading(true)
            const c = await getContainerAsync()
            const result = await c.sqlite.query<SolicitacaoPackage>(
                SOLICITACOES_POR_USUARIO.sql,
                [userId],
            )
            setSolicitacoes(result)
        } catch (error) {
            console.error("Erro ao buscar solicitações:", error)
        } finally {
            setLoading(false)
        }
    }, [userId])

    const fetchAvailableForms = useCallback(async () => {
        try {
            const c = await getContainerAsync()
            const result = await c.sqlite.query<{ form_id: string; titulo: string }>(
                FORMS_AD_HOC_DISPONIVEIS.sql,
                [],
            )
            setAvailableForms(result)
        } catch (error) {
            console.error("Erro ao buscar formulários disponíveis:", error)
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
        fetchSolicitacoes,
        fetchAvailableForms,
    }
}
