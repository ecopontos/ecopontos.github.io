
"use client";
export const dynamic = "force-dynamic";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Suspense } from "react";

export default function KanbanPage() {
    return (
        <ErrorBoundary moduleName="Kanban">
            <Suspense fallback={<div>Carregando Kanban...</div>}>
                <KanbanBoard />
            </Suspense>
        </ErrorBoundary>
    );
}
