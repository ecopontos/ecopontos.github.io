/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AGENDAMENTOS_MAP_POINTS_BY_SLOT } from '@/src/infrastructure/persistence/sqlite/queries/service';

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

export function useAgendamentoMapData(slotId: string | null) {
    const [data, setData] = useState<AgendamentoMapPoint[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!slotId) { setData([]); return; }
        setLoading(true);
        invoke<AgendamentoMapPoint[]>('db_query', {
            sql: AGENDAMENTOS_MAP_POINTS_BY_SLOT.sql,
            params: [slotId],
        })
            .then(rows => setData(Array.isArray(rows) ? rows : []))
            .catch(() => setData([]))
            .finally(() => setLoading(false));
    }, [slotId]);

    return { data, loading };
}