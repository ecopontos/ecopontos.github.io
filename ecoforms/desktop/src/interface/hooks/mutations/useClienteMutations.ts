import { useState, useCallback } from 'react';
import { getContainerAsync } from '../utils/useContainer';
import type { Cliente, ClienteContato, ConfiancaVinculo, OrigemVinculo, TipoRelacaoVinculo } from '@/types/clientes';

export function useClienteMutations() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
        setLoading(true);
        setError(null);
        try {
            return await fn();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro desconhecido');
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const save = useCallback(async (cliente: Cliente) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.save(cliente);
        });
    }, []);

    const remove = useCallback(async (id: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.delete(id);
        });
    }, []);

    const saveContato = useCallback(async (contato: ClienteContato) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.saveContato(contato);
        });
    }, []);

    const removeContato = useCallback(async (contatoId: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.deleteContato(contatoId);
        });
    }, []);

    const linkPfToPj = useCallback(async (pfId: string, pjId: string, funcao?: string | null) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.linkPfToPj(pfId, pjId, funcao);
        });
    }, []);

    const unlinkPfFromPj = useCallback(async (pfId: string, pjId: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.unlinkPfFromPj(pfId, pjId);
        });
    }, []);

    const updateVinculoFuncao = useCallback(async (vinculoId: string, funcao: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.updateVinculoFuncao(vinculoId, funcao);
        });
    }, []);

    const toggleAtivo = useCallback(async (id: string, ativoAtual: number) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            const existing = await c.clienteRepository.findById(id);
            if (!existing) throw new Error('Cliente não encontrado');
            existing.ativo = ativoAtual ? 0 : 1;
            await c.clienteRepository.save(existing);
        });
    }, []);

    // ── Fase 3: vínculo cliente↔imóvel ──
    const linkClienteToImovel = useCallback(async (
        clienteId: string,
        imovelId: string,
        tipo_relacao?: TipoRelacaoVinculo | null,
        principal?: boolean,
        confianca?: ConfiancaVinculo | null,
        origem?: OrigemVinculo | null,
    ) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.linkClienteToImovel(clienteId, imovelId, tipo_relacao ?? null, principal ?? false, confianca ?? null, origem ?? 'manual');
        });
    }, []);

    const unlinkClienteFromImovel = useCallback(async (vinculoId: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.unlinkClienteFromImovel(vinculoId);
        });
    }, []);

    const updateVinculoImovel = useCallback(async (
        vinculoId: string,
        update: { tipo_relacao?: TipoRelacaoVinculo | null; principal?: boolean; confianca?: ConfiancaVinculo | null },
    ) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.clienteRepository.updateVinculoImovel(vinculoId, update);
        });
    }, []);

    return { save, remove, saveContato, removeContato, linkPfToPj, unlinkPfFromPj, updateVinculoFuncao, toggleAtivo, linkClienteToImovel, unlinkClienteFromImovel, updateVinculoImovel, loading, error };
}
