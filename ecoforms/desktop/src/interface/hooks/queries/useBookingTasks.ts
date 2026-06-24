"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";

export interface BookingRow {
    id: string;
    titulo: string;
    status: string;
    criado_em: string;
    atribuido_para: string | null;
}

export function useBookingTasks(slotId: string | null) {
    const [tasks, setTasks] = useState<BookingRow[]>([]);
    const [loading, setLoading] = useState(false);

    const reload = useCallback(async () => {
        if (!slotId) { setTasks([]); return; }
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const agendamentos = await container.listAgendamentosUseCase.execute({ slotId });
            setTasks(agendamentos.map(a => ({
                id:             a.id,
                titulo:         a.clienteNome,
                status:         a.status,
                criado_em:      a.criadoEm,
                atribuido_para: a.responsavelId ?? null,
            })));
        } catch (e) {
            console.error(e);
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, [slotId]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { tasks, loading, reload };
}
