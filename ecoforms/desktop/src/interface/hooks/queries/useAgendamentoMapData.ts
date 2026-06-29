/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { AGENDAMENTOS_MAP_POINTS_BY_SLOT } from '@/src/infrastructure/persistence/sqlite/queries/service';
import { useSqlite } from '../queries/useSqlite';

export interface AgendamentoMapPoint {
    id: string;
    clienteId: string;
    clienteNome: string;
    bairro: string | null;
    endereco: string | null;
    numero: string | null;
    cidade: string | null;
    latitude: number;
    longitude: number;
    status: string;
    vagasSolicitadas: number;
}

function isTauri() { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; }

export function useAgendamentoMapData(slotId: string | null) {
    const [data, setData] = useState<AgendamentoMapPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const sqlite = useSqlite();

    useEffect(() => {
        if (!slotId) { setData([]); return; }
        if (!isTauri()) { setData([]); return; }
        let cancelled = false;
        setLoading(true);
        sqlite.query<AgendamentoMapPoint>(AGENDAMENTOS_MAP_POINTS_BY_SLOT.sql, [slotId])
            .then(rows => { if (!cancelled) setData(Array.isArray(rows) ? rows : []); })
            .catch(() => { if (!cancelled) setData([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [slotId, sqlite]);

    return { data, loading };
}