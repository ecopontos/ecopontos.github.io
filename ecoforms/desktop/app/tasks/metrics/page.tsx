'use client';

import { TaskMetricsContent } from '@/components/tasks/TaskMetricsContent';

export default function TaskMetricsPage() {
    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Métricas de Produtividade</h1>
                <p className="text-muted-foreground">Visão geral do desempenho de tarefas</p>
            </div>
            <TaskMetricsContent />
        </div>
    );
}
