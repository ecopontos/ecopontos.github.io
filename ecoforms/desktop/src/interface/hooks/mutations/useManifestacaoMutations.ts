import { useState, useCallback } from 'react';
import { useContainerAsync } from '@/src/interface/hooks/utils/useContainer';
import type { ManifestacaoInput, Tramitacao, Resposta, Despacho, Anexo, Prazo, Notificacao, HistoricoAlteracao, EnvioResposta } from '@/src/domain/ouvidoria/ManifestacaoRepository';

export function useManifestacaoMutations() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const getContainer = useContainerAsync();

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

    const save = useCallback(async (manifestacao: ManifestacaoInput) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.save(manifestacao);
        });
    }, [getContainer]);

    const updateStatus = useCallback(async (id: string, status: string, responsavelId?: string) => {
        return withLoading(async () => {
            const c = await getContainer();
            // ADR-017: passa pela FSM e publica domain event via use case
            await c.updateManifestacaoStatus.execute({ id, status, responsavelId });
        });
    }, [getContainer]);

    const remove = useCallback(async (id: string) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.delete(id);
        });
    }, [getContainer]);

    const addTramitacao = useCallback(async (t: Tramitacao) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.addTramitacao(t);
        });
    }, [getContainer]);

    const addResposta = useCallback(async (r: Resposta) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.addResposta(r);
        });
    }, [getContainer]);

    const addDespacho = useCallback(async (d: Despacho) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.addDespacho(d);
        });
    }, [getContainer]);

    const addAnexo = useCallback(async (a: Anexo) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.addAnexo(a);
        });
    }, [getContainer]);

    const removeAnexo = useCallback(async (anexoId: string) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.removeAnexo(anexoId);
        });
    }, [getContainer]);

    const addPrazo = useCallback(async (p: Prazo) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.addPrazo(p);
        });
    }, [getContainer]);

    const updatePrazoStatus = useCallback(async (prazoId: string, status: string, cumpridoEm?: string) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.updatePrazoStatus(prazoId, status, cumpridoEm);
        });
    }, [getContainer]);

    const addNotificacao = useCallback(async (n: Notificacao) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.addNotificacao(n);
        });
    }, [getContainer]);

    const marcarNotificacaoLida = useCallback(async (notificacaoId: string) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.marcarNotificacaoLida(notificacaoId);
        });
    }, [getContainer]);

    const addHistorico = useCallback(async (h: HistoricoAlteracao) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.addHistorico(h);
        });
    }, [getContainer]);

    const formatarResposta = useCallback(async (
        manifestacaoId: string,
        data: { respostaId: string; respostaFormatada: string; modeloId?: string; revisadaPorId: string; marcarRespondida: boolean },
    ) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.formatarResposta(manifestacaoId, data);
        });
    }, [getContainer]);

    const classificar = useCallback(async (
        id: string,
        data: { subassuntoId?: string; subunidadeId?: string; programaOrcamentarioId?: string },
    ) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.classificar(id, data);
        });
    }, [getContainer]);

    const verificarCompetencia = useCallback(async (
        id: string,
        competencia: 'compete' | 'nao_compete',
        motivo?: string,
        orgaoDestino?: string,
    ) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.verificarCompetencia(id, competencia, motivo, orgaoDestino);
        });
    }, [getContainer]);

    const registrarEnvio = useCallback(async (e: EnvioResposta) => {
        return withLoading(async () => {
            const c = await getContainer();
            await c.manifestacaoRepository.registrarEnvio(e);
        });
    }, [getContainer]);

    const criarDemandaDeManifestacao = useCallback(async (input: {
        manifestacaoId: string;
        solicitanteId: string;
        destinatarioId: string;
        descricao: string;
        tipoAcao?: string;
    }) => {
        return withLoading(async () => {
            const c = await getContainer();
            return c.demandas.create.execute({
                origemTipo: 'ouvidoria',
                origemId: input.manifestacaoId,
                solicitanteId: input.solicitanteId,
                destinatarioId: input.destinatarioId,
                descricao: input.descricao,
                tipoAcao: input.tipoAcao,
                politicaConclusao: 'todas',
            });
        });
    }, [getContainer]);

    return {
        save, updateStatus, remove,
        addTramitacao, addResposta, addDespacho,
        addAnexo, removeAnexo,
        addPrazo, updatePrazoStatus,
        addNotificacao, marcarNotificacaoLida,
        addHistorico,
        classificar,
        formatarResposta,
        verificarCompetencia,
        registrarEnvio,
        criarDemandaDeManifestacao,
        loading, error,
    };
}
