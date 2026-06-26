"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";

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
                `SELECT
                    t.id, t.titulo, t.status, t.prioridade, t.prazo,
                    COALESCE(p.nome, 'Projeto Geral') AS projeto_nome,
                    COUNT(*) OVER() AS abertas_count,
                    SUM(CASE WHEN t.status = 'a_fazer' THEN 1 ELSE 0 END) OVER() AS a_fazer_count,
                    SUM(CASE WHEN t.status = 'em_progresso' THEN 1 ELSE 0 END) OVER() AS em_progresso_count,
                    SUM(CASE WHEN t.prazo IS NOT NULL AND date(t.prazo) < date('now') THEN 1 ELSE 0 END) OVER() AS atrasadas_count
                 FROM tarefas t
                 LEFT JOIN projetos p ON p.id = t.projeto_id
                 WHERE t.arquivado = 0 AND t.atribuido_para = ? AND t.status != 'concluido'
                 ORDER BY
                   CASE WHEN t.prazo IS NOT NULL AND date(t.prazo) < date('now') THEN 0
                        WHEN t.prazo IS NOT NULL AND date(t.prazo) <= date('now', '+2 days') THEN 1 ELSE 2 END,
                   CASE WHEN t.prazo IS NULL THEN 1 ELSE 0 END, date(t.prazo) ASC, t.atualizado_em DESC
                 LIMIT 6`,
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
