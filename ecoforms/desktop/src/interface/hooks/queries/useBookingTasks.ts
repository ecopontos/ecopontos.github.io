"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";

const PAGE_SIZE = 25;

export interface BookingRow {
    id: string;
    titulo: string;
    status: string;
    criadoEm: string;
    atribuidoPara: string | null;
}

export function useBookingTasks(slotId: string | null) {
    const [tasks, setTasks] = useState<BookingRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const offsetRef = useRef(0);

    const mapAgendamentos = (agendamentos: { id: string; clienteNome: string; status: string; criadoEm: string; responsavelId?: string | null }[]): BookingRow[] =>
        agendamentos.map(a => ({
            id:            a.id,
            titulo:        a.clienteNome,
            status:        a.status,
            criadoEm:      a.criadoEm,
            atribuidoPara: a.responsavelId ?? null,
        }));

    const reload = useCallback(async () => {
        if (!slotId) { setTasks([]); setHasMore(false); return; }
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
        try {
            const container = await getContainerAsync();
            const agendamentos = await container.listAgendamentosUseCase.execute({
                slotId,
                limit: PAGE_SIZE + 1,
                offset: 0,
            });
            const more = agendamentos.length > PAGE_SIZE;
            const page = more ? agendamentos.slice(0, PAGE_SIZE) : agendamentos;
            setTasks(mapAgendamentos(page));
            setHasMore(more);
            offsetRef.current = page.length;
        } catch (e) {
            setError(String(e));
            setTasks([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [slotId]);

    const loadMore = useCallback(async () => {
        if (!slotId || loading || !hasMore) return;
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const agendamentos = await container.listAgendamentosUseCase.execute({
                slotId,
                limit: PAGE_SIZE + 1,
                offset: offsetRef.current,
            });
            const more = agendamentos.length > PAGE_SIZE;
            const page = more ? agendamentos.slice(0, PAGE_SIZE) : agendamentos;
            setTasks(prev => [...prev, ...mapAgendamentos(page)]);
            setHasMore(more);
            offsetRef.current += page.length;
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, [slotId, loading, hasMore]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { tasks, loading, error, hasMore, loadMore, reload };
}
