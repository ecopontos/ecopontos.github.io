"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanTaskCard } from "./KanbanTaskCard";
import { useKanban, useTaskOptions } from "@/src/interface/hooks/catalog/kanban";
import { UnifiedTaskView, KanbanTask, KanbanProject, Interessado } from "@/types";

import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TasksTableView } from "@/components/tasks/TasksTableView";
import { KanbanViewToolbar } from "./KanbanViewToolbar";
import { ProjectDialog } from "@/components/projects/ProjectDialog";

import { NewTaskModal } from "./NewTaskModal";
import { EditTaskModal } from "./EditTaskModal";
import { TaskEntriesModal } from "./TaskEntriesModal";
import { SolicitacaoReviewModal } from "./SolicitacaoReviewModal";
import { useAuth } from "@/contexts/AuthContext";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function KanbanBoard() {
    const {
        projects,
        tasks,
        currentProjectId,
        setCurrentProjectId,
        showAllProjects,
        setShowAllProjects,
        viewMode,
        setViewMode,
        createProject,
        updateProject,
        createTask,
        moveTask,
        updateTask,
        unfreezeTask,
        patchTask,
        getTaskPatches,
        deleteTask,
        archiveTask,
        cancelTask,
        getTasksByStatus,
        approveSolicitacao,
        rejectSolicitacao,
        loading,
        refetchTasks,
        refetchSolicitacoes,
    } = useKanban();

    const [activeId, setActiveId] = useState<string | null>(null);
    const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
    const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<UnifiedTaskView | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [isTaskEntriesOpen, setIsTaskEntriesOpen] = useState(false);
    const [isSolicitacaoReviewOpen, setIsSolicitacaoReviewOpen] = useState(false);
    const [solicitationTargetStatus, setSolicitationTargetStatus] = useState<string | undefined>(undefined);
    const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
    const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create');
    const [editingProject, setEditingProject] = useState<KanbanProject | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [newTaskDefaultStatus, setNewTaskDefaultStatus] = useState<'a_fazer' | 'em_progresso' | 'concluido'>('a_fazer');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const prevTaskStatuses = useRef<Record<string, string>>({});
    const { user, permissions } = useAuth();
    const isTechnicalAdmin = permissions.isAdmin() || permissions.isManager();

    // Initialise project filter from URL param ?projeto=<id>
    const searchParams = useSearchParams();
    useEffect(() => {
        const projetoParam = searchParams.get('projeto');
        if (projetoParam) {
            setShowAllProjects(false);
            setCurrentProjectId(projetoParam);
        }
    }, [searchParams, setCurrentProjectId, setShowAllProjects]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const columns = (() => {
        if (showArchived) return [{ id: 'arquivadas' as const, title: 'Arquivadas', color: 'bg-gray-500' }];
        
        const cols: Array<{
            id: 'a_fazer' | 'em_progresso' | 'concluido' | 'solicitacao';
            title: string;
            color: string;
        }> = [
            { id: 'a_fazer', title: 'A Fazer', color: 'bg-slate-500' },
            { id: 'em_progresso', title: 'Em Progresso', color: 'bg-blue-500' },
            { id: 'concluido', title: 'Concluído', color: 'bg-green-500' },
        ];

        // Adicionar coluna de solicitações se for admin/gerente e o filtro permitir
        if (isTechnicalAdmin && (showAllProjects || currentProjectId === null)) {
            cols.unshift({ id: 'solicitacao', title: 'Solicitações de Tarefas', color: 'bg-amber-500' });
        }

        return cols;
    })();

    // A função getTasksByStatus agora vem diretamente do hook useKanban
    // e já lida com o status 'solicitacao' e filtragem de arquivadas.

    const filteredTasks = useMemo(() => {
        const base = showArchived ? tasks.filter(t => t.arquivado) : tasks.filter(t => !t.arquivado);
        if (!searchTerm.trim()) return base;
        const term = searchTerm.toLowerCase();
        return base.filter(t => 
            t.titulo?.toLowerCase().includes(term) || 
            t.descricao?.toLowerCase().includes(term)
        );
    }, [tasks, searchTerm, showArchived]);

    const getFilteredTasksByStatus = useCallback((status: any) => {
        const term = searchTerm.toLowerCase().trim();
        if (status === 'solicitacao') {
            const sols = getTasksByStatus('solicitacao') as UnifiedTaskView[];
            if (!term) return sols;
            return sols.filter((t: UnifiedTaskView) => 
                t.titulo?.toLowerCase().includes(term) || 
                t.descricao?.toLowerCase().includes(term)
            );
        }
        return filteredTasks.filter((t: UnifiedTaskView) => t.status === status);
    }, [filteredTasks, getTasksByStatus, searchTerm]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const lastDragEndRef = useRef<number>(0);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const now = Date.now();
        if (now - lastDragEndRef.current < 300) {
            return; // GAP-012: debounce — ignora arrastes muito rápidos
        }
        lastDragEndRef.current = now;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeTask = tasks.find(t => t.id === activeId) || (getTasksByStatus('solicitacao') as UnifiedTaskView[]).find(t => t.id === activeId);
        if (!activeTask) return;

        let newStatus = activeTask.status;

        if (columns.some(c => c.id === overId)) {
            newStatus = overId as any;
        } else {
            const overTask = tasks.find(t => t.id === overId);
            if (overTask) {
                newStatus = overTask.status;
            }
        }

        if (activeTask.status !== newStatus) {
            if (activeTask.status === 'solicitacao') {
                // Se arrastou de solicitação para qualquer outro lugar, dispara aprovação
                handleApproveSolicitacao(activeTask, newStatus);
            } else {
                moveTask(activeId, newStatus as any, activeTask.ordem);
            }
        }
    };

    const handleCreateProject = () => {
        setEditingProject(undefined);
        setProjectDialogMode('create');
        setIsProjectDialogOpen(true);
    };

    const handleEditCurrentProject = () => {
        const project = projects.find(p => p.id === currentProjectId);
        if (!project) return;
        setEditingProject(project);
        setProjectDialogMode('edit');
        setIsProjectDialogOpen(true);
    };

    const handleSaveProject = async (data: { nome: string; descricao: string; cor: string; interessados: Interessado[] }) => {
        if (projectDialogMode === 'create') {
            await createProject(data.nome, data.descricao, data.cor, data.interessados);
        } else if (editingProject) {
            await updateProject(editingProject.id, {
                nome: data.nome,
                descricao: data.descricao,
                cor: data.cor,
                interessados: data.interessados,
            });
        }
    };

    const handleEditTask = (task: UnifiedTaskView) => {
        setSelectedTask(task);
        setIsEditTaskOpen(true);
    };

    const handleViewRecords = (task: UnifiedTaskView) => {
        setSelectedTask(task);
        setIsTaskEntriesOpen(true);
    };

    const handleApproveSolicitacao = (task: UnifiedTaskView, targetStatus?: string) => {
        setSelectedTask(task);
        setSolicitationTargetStatus(targetStatus);
        setIsSolicitacaoReviewOpen(true);
    };
    

    // Monitoramento de progresso automático para Toasts
    useEffect(() => {
        if (!tasks || tasks.length === 0) return;

        tasks.forEach(task => {
            const prevStatus = prevTaskStatuses.current[task.id];
            
            // Se mudou de 'a_fazer' para 'em_progresso' sem ação manual local
            if (prevStatus === 'a_fazer' && task.status === 'em_progresso') {
                toast.info(`🚀 Tarefa iniciada: "${task.titulo}"`, {
                    description: `O operador ${task.atribuido_username || 'atribuído'} começou a trabalhar nesta tarefa.`
                });
            }
            
            // Atualiza o cache do status
            prevTaskStatuses.current[task.id] = task.status;
        });
    }, [tasks]);

    const handleProjectChange = (value: string) => {
        if (value === 'all') {
            setShowAllProjects(true);
            setCurrentProjectId(null);
        } else if (value === 'none') {
            setShowAllProjects(false);
            setCurrentProjectId(null);
        } else {
            setShowAllProjects(false);
            setCurrentProjectId(value);
        }
    };

    const handleStatusChange = async (taskId: string, newStatus: 'a_fazer' | 'em_progresso' | 'concluido') => {
        await moveTask(taskId, newStatus, 0);
    };

    const handleAddTaskToColumn = (status: string) => {
        if (status === 'solicitacao' || status === 'arquivadas') return;
        setSelectedTask(null);
        setNewTaskDefaultStatus(status as 'a_fazer' | 'em_progresso' | 'concluido');
        setIsNewTaskOpen(true);
    };

    const handleArchive = async (taskId: string) => {
        await archiveTask(taskId, true);
    };

    // window.confirm() não funciona de forma confiável em webview Tauri — usa AlertDialog.
    const handleDelete = (taskId: string) => {
        setDeleteTargetId(taskId);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        const id = deleteTargetId;
        setDeleteTargetId(null);
        await deleteTask(id);
    };

    if (loading && projects.length === 0 && tasks.length === 0) {
        return <div className="p-8 text-center text-gray-500">Carregando tarefas...</div>;
    }

    const getCurrentProjectValue = () => {
        if (showAllProjects) return 'all';
        if (currentProjectId === null) return 'none';
        return currentProjectId;
    };

    const taskCounts = showArchived ? undefined : {
        aFazer: tasks.filter(t => t.status === 'a_fazer' && !t.arquivado).length,
        emProgresso: tasks.filter(t => t.status === 'em_progresso' && !t.arquivado).length,
        concluido: tasks.filter(t => t.status === 'concluido' && !t.arquivado).length,
        solicitacao: (getTasksByStatus('solicitacao') as UnifiedTaskView[]).filter((t: UnifiedTaskView) => !t.arquivado).length,
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            <KanbanViewToolbar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                projects={projects}
                currentProjectValue={getCurrentProjectValue()}
                onProjectChange={handleProjectChange}
                showArchived={showArchived}
                onToggleArchived={() => setShowArchived(!showArchived)}
                onEditProject={handleEditCurrentProject}
                onNewTask={() => setIsNewTaskOpen(true)}
                canEditProject={!!currentProjectId}
                taskCounts={taskCounts}
            />

            {/* Content Area */}
            {viewMode === 'table' ? (
                <div className="flex-1 overflow-auto p-6 bg-slate-50">
                    <Card className="h-full">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Todas as Tarefas</CardTitle>
                                    <CardDescription>
                                        {filteredTasks.length} tarefa(s) encontrada(s)
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <TasksTableView
                                tasks={isTechnicalAdmin ? [
                                    ...filteredTasks, 
                                    ...(getTasksByStatus('solicitacao') as UnifiedTaskView[]).filter((t: any) => 
                                        !searchTerm.trim() || 
                                        t.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                        t.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                ] : filteredTasks}
                                onTaskClick={handleEditTask}
                                onStatusChange={handleStatusChange}
                                onArchive={handleArchive}
                                onDelete={handleDelete}
                            />
                        </CardContent>
                    </Card>
                </div>
            ) : (
                /* Kanban Board Area */
                <div className="flex-1 overflow-x-auto p-6 bg-slate-50">
                    {filteredTasks.length === 0 && searchTerm && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Search className="w-12 h-12 mb-4 opacity-20" />
                            <p>Nenhuma tarefa encontrada para &quot;{searchTerm}&quot;</p>
                            <Button variant="link" onClick={() => setSearchTerm('')}>Limpar busca</Button>
                        </div>
                    )}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex gap-6 h-full min-w-max">
                            {columns.map(col => (
                                <KanbanColumn
                                    key={col.id}
                                    id={col.id}
                                    title={col.title}
                                    color={col.color}
                                    tasks={getFilteredTasksByStatus(col.id)}
                                    onTaskClick={col.id === 'solicitacao' ? handleApproveSolicitacao : handleEditTask}
                                    onTaskEdit={col.id === 'solicitacao' ? handleApproveSolicitacao : handleEditTask}
                                    onViewRecords={handleViewRecords}
                                    onArchive={(task) => handleArchive(task.id)}
                                    onDelete={(task) => handleDelete(task.id)}
                                    onAddTask={handleAddTaskToColumn}
                                />
                            ))}
                        </div>

                        <DragOverlay>
                            {activeId ? (() => {
                                const allTasks = [...tasks, ...(getTasksByStatus('solicitacao') as UnifiedTaskView[])];
                                const activeTask = allTasks.find(t => t.id === activeId);
                                if (!activeTask) return null;
                                return (
                                    <div className="opacity-80 rotate-2 cursor-grabbing">
                                        <KanbanTaskCard task={activeTask} />
                                    </div>
                                );
                            })() : null}
                        </DragOverlay>
                    </DndContext>
                </div>
            )}

            <NewTaskModal
                open={isNewTaskOpen}
                onOpenChange={setIsNewTaskOpen}
                onCreate={createTask}
                projects={projects}
                defaultProjectId={currentProjectId || undefined}
                currentProject={projects.find(p => p.id === currentProjectId)}
                defaultStatus={newTaskDefaultStatus}
            />

            <EditTaskModal
                task={selectedTask}
                open={isEditTaskOpen}
                onOpenChange={setIsEditTaskOpen}
                projects={projects}
                onUnfreeze={async () => {
                    if (selectedTask) {
                        await unfreezeTask(selectedTask.id);
                    }
                }}
                onTaskUpdated={async (updates) => {
                    if (selectedTask) {
                        await updateTask(selectedTask.id, updates);
                        setSelectedTask(null);
                    }
                }}
                onPatchTask={patchTask}
                getTaskPatches={getTaskPatches}
                onArchiveTask={async (taskId, archived) => {
                    try {
                        await archiveTask(taskId, archived);
                        setSelectedTask(null);
                    } catch (error) {
                        console.error('Erro ao arquivar tarefa:', error);
                    }
                }}
                onCancelTask={async (taskId, motivo) => {
                    try {
                        await cancelTask(taskId, motivo);
                        setSelectedTask(null);
                        setIsEditTaskOpen(false);
                    } catch (error) {
                        console.error('Erro ao cancelar tarefa:', error);
                    }
                }}
            />

            <TaskEntriesModal
                open={isTaskEntriesOpen}
                onOpenChange={setIsTaskEntriesOpen}
                taskId={selectedTask?.id || ''}
                taskTitle={selectedTask?.titulo || ''}
            />

            {isSolicitacaoReviewOpen && selectedTask && (
                <SolicitacaoReviewModal
                    open={isSolicitacaoReviewOpen}
                    onOpenChange={setIsSolicitacaoReviewOpen}
                    solicitation={selectedTask}
                    targetStatus={solicitationTargetStatus}
                    onApprove={async (overrides, updatedFormDados) => {
                        await approveSolicitacao(selectedTask.id, overrides, updatedFormDados);
                        setIsSolicitacaoReviewOpen(false);
                        setSelectedTask(null);
                    }}
                    onReject={async (motivo) => {
                        await rejectSolicitacao(selectedTask.id, motivo);
                        setIsSolicitacaoReviewOpen(false);
                        setSelectedTask(null);
                    }}
                />
            )}

            <ProjectDialog
                open={isProjectDialogOpen}
                onOpenChange={setIsProjectDialogOpen}
                mode={projectDialogMode}
                project={editingProject}
                onSave={handleSaveProject}
            />

            <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir tarefa</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação é permanente e não pode ser desfeita. Deseja excluir esta tarefa?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
