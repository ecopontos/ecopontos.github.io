import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
            sql: `SELECT a.id, a.cliente_id AS clienteId, a.cliente_nome AS clienteNome,
                         a.bairro, a.status, a.vagas_solicitadas AS vagasSolicitadas,
                         c.endereco, c.numero, c.cidade,
                         COALESCE(t.centroid_lat, c.latitude)  AS latitude,
                         COALESCE(t.centroid_lng, c.longitude) AS longitude
                  FROM tbl_agendamentos a
                  JOIN clientes c ON c.id = a.cliente_id
                  LEFT JOIN terrenos t ON t.id = c.terreno_id
                  WHERE a.slot_id = ?
                    AND a.status != 'cancelado'
                    AND (t.centroid_lat IS NOT NULL OR c.latitude IS NOT NULL)
                  ORDER BY a.criado_em`,
            params: [slotId],
        })
            .then(rows => setData(Array.isArray(rows) ? rows : []))
            .catch(() => setData([]))
            .finally(() => setLoading(false));
    }, [slotId]);

    return { data, loading };
}