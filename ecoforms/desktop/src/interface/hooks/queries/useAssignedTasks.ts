"use client";
import { useTauriQuery } from "@/src/interface/hooks/catalog/tauri";
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
    const { data, isPending } = useTauriQuery<AssignedTaskNotification>(
        TAREFAS_ATRIBUIDAS_NOTIFICACAO.sql,
        userId ? [userId] : [],
        { enabled: Boolean(userId) },
    );

    return {
        tasks: userId ? (data ?? []) : [],
        loading: userId ? isPending : false,
    };
}
