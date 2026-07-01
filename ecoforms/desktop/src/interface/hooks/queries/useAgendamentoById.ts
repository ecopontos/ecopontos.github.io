/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { getContainerAsync } from '../utils/useContainer';
import type { AgendamentoProps } from '../../../domain/service/Agendamento';

export function useAgendamentoById(id: string | null) {
    const [agendamento, setAgendamento] = useState<AgendamentoProps | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) { setAgendamento(null); return; }
        setLoading(true);
        getContainerAsync()
            .then(c => c.getAgendamentoUseCase.execute(id))
            .then(a => setAgendamento(a.toProps()))
            .catch(e => setError(String(e)))
            .finally(() => setLoading(false));
    }, [id]);

    return { agendamento, loading, error };
}
