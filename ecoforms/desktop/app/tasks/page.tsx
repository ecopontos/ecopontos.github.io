'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TasksTableView } from '@/components/tasks/TasksTableView';
import { TaskMetricsContent } from '@/components/tasks/TaskMetricsContent';
import { useKanbanData, useKanbanMutations } from '@/src/interface/hooks/catalog/kanban';
import type { UnifiedTaskView } from '@/types';

export default function TasksPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') ?? 'tarefas';

    const { tasks, solicitacoes, setTasks, isLoading, refetchTasks, refetchSolicitacoes, refetchProjects } = useKanbanData(true, null);
    const { moveTask, archiveTask, deleteTask } = useKanbanMutations(
        tasks, solicitacoes, setTasks, null, refetchTasks, refetchSolicitacoes, refetchProjects,
    );

    const handleTabChange = (value: string) => {
        router.replace(`/tasks?tab=${value}`);
    };

    const handleTaskClick = (task: UnifiedTaskView) => {
        router.push(`/tasks/${task.id}`);
    };

    const handleStatusChange = async (taskId: string, newStatus: 'a_fazer' | 'em_progresso' | 'concluido') => {
        await moveTask(taskId, newStatus, 0);
    };

    const handleArchive = async (taskId: string) => {
        await archiveTask(taskId, true);
    };

    const handleDelete = async (taskId: string) => {
        if (confirm('Deseja excluir esta tarefa permanentemente?')) {
            await deleteTask(taskId);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Tarefas</h1>
            </div>

            <Tabs value={tab} onValueChange={handleTabChange}>
                <TabsList>
                    <TabsTrigger value="tarefas">Lista</TabsTrigger>
                    <TabsTrigger value="metricas">Métricas</TabsTrigger>
                </TabsList>

                <TabsContent value="tarefas" className="mt-4">
                    {isLoading ? (
                        <p className="text-muted-foreground py-8">Carregando tarefas...</p>
                    ) : (
                        <TasksTableView
                            tasks={tasks}
                            onTaskClick={handleTaskClick}
                            onStatusChange={handleStatusChange}
                            onArchive={handleArchive}
                            onDelete={handleDelete}
                        />
                    )}
                </TabsContent>

                <TabsContent value="metricas" className="mt-4">
                    <TaskMetricsContent />
                </TabsContent>
            </Tabs>
        </div>
    );
}
