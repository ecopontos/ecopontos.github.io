"use client";

import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export const KANBAN_PROJECT_REMOCAO = "caixas-ecoponto";

export default function BoardRemocao() {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-semibold">Tarefas de Remoção</h2>
                <p className="text-sm text-muted-foreground">
                    Cards são criados automaticamente quando caixas atingem 75% de ocupação.
                    Selecione o projeto <strong>{KANBAN_PROJECT_REMOCAO}</strong> no seletor de projetos do quadro Kanban.
                </p>
            </div>
            <KanbanBoard />
        </div>
    );
}
