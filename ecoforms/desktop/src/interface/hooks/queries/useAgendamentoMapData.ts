import { useState, useEffect } from 'react';
import { getContainerAsync } from '../../../infrastructure/container';
import type { AgendamentoMapPoint } from '../../../domain/service/AgendamentoRepository';

export type { AgendamentoMapPoint };

export function useAgendamentoMapData(slotId: string | null) {
    const [data, setData] = useState<AgendamentoMapPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slotId) { setData([]); return; }
        let cancelled = false;
        setLoading(true);
        setError(null);
        getContainerAsync()
            .then(c => c.agendamentoRepo.findMapDataBySlotId(slotId))
            .then(rows => { if (!cancelled) setData(rows); })
            .catch(e => { if (!cancelled) setError(String(e)); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [slotId]);

    return { data, loading, error };
}
