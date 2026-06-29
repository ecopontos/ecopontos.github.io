"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import { TAREFAS_ATRIBUIDAS_NOTIFICACAO } from "@/src/infrastructure/persistence/sqlite/queries/tarefas";

export interface AssignedTaskNotification {
    id: string;
    titulo: string;
    status: "a_fazer" | "em_progresso" | "concluido";
    prioridade: "baixa" | "media" | "alta";
    prazo: string | null;
    projeto_nome: string;
    abertas_count?: number | string;
    a_fazer_count?: number | string;
    em_progresso_count?: number | string;
    atrasadas_count?: number | string;
}

export function useAssignedTasks(userId: string | undefined) {
    const [tasks, setTasks] = useState<AssignedTaskNotification[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTasks = useCallback(async () => {
        if (!userId) { setLoading(false); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const result = await c.sqlite.query<AssignedTaskNotification>(
                TAREFAS_ATRIBUIDAS_NOTIFICACAO.sql,
                [userId]
            );
            setTasks(result);
        } catch (e) {
            console.error('[useAssignedTasks]', e);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    return { tasks, loading };
}
