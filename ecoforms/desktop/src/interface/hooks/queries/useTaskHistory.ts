import { useState, useEffect } from "react";
import { TaskHistoryEvent, TaskHistoryEventTipo } from "@/types";
import { getContainerAsync } from "@/src/infrastructure/container";

const TASK_HISTORY_EVENT_TYPES: TaskHistoryEventTipo[] = [
    'criacao',
    'edicao',
    'status',
    'atribuicao',
    'comentario',
    'anexo',
    'formulario',
    'patch',
    'arquivamento',
];

function normalizeTaskHistoryEventTipo(value: string): TaskHistoryEventTipo {
    return TASK_HISTORY_EVENT_TYPES.includes(value as TaskHistoryEventTipo)
        ? (value as TaskHistoryEventTipo)
        : 'edicao';
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

/**
 * Returns a unified, chronological timeline of events for a task.
 */
export function useTaskHistory(taskId: string, enabled: boolean = true) {
    const [events, setEvents] = useState<TaskHistoryEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!enabled || !taskId) { if (!cancelled) setEvents([]); return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const rows = await c.taskRepository.getTaskHistory(taskId);
                if (!cancelled) {
                    setEvents(rows.map(r => ({
                        id: String(r.id),
                        tarefa_id: r.tarefaId,
                        tipo: normalizeTaskHistoryEventTipo(r.tipo),
                        descricao: r.descricao ?? null,
                        usuario_id: r.usuarioId ?? null,
                        usuario_nome: r.usuarioNome ?? null,
                        metadata: normalizeMetadata(r.metadata),
                        created_at: r.createdAt,
                    })));
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) { setError(err instanceof Error ? err : new Error(String(err))); setEvents([]); }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [taskId, enabled]);

    const refetch = () => {
        setLoading(true);
        getContainerAsync()
            .then(c => c.taskRepository.getTaskHistory(taskId))
            .then(rows => {
                setEvents(rows.map(r => ({
                    id: String(r.id),
                    tarefa_id: r.tarefaId,
                    tipo: normalizeTaskHistoryEventTipo(r.tipo),
                    descricao: r.descricao ?? null,
                    usuario_id: r.usuarioId ?? null,
                    usuario_nome: r.usuarioNome ?? null,
                    metadata: normalizeMetadata(r.metadata),
                    created_at: r.createdAt,
                })));
                setError(null);
            })
            .catch(err => {
                setError(err);
                setEvents([]);
            })
            .finally(() => setLoading(false));
    };

    return { events, loading, error, refetch };
}
