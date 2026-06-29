/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { getContainerAsync } from '../../../infrastructure/container';
import type { AgendamentoProps } from '../../../domain/service/Agendamento';
import type { AgendamentoFiltros } from '../../../domain/service/AgendamentoRepository';

export function useAgendamentos(filtros?: AgendamentoFiltros) {
    const [agendamentos, setAgendamentos] = useState<AgendamentoProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const list = await c.listAgendamentosUseCase.execute(filtros);
            setAgendamentos(list.map(a => a.toProps()));
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [JSON.stringify(filtros)]);

    return { agendamentos, loading, error, refresh: load };
}
