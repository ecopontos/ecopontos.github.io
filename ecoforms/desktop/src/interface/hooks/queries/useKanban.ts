import { useCallback, useEffect } from 'react';
import { useTauriQuery } from '@/src/interface/hooks/tauri/useTauriQuery';
import { useKanbanViewState } from './useKanbanViewState';
import { useKanbanData } from './useKanbanData';
import { useKanbanMutations } from '../mutations/useKanbanMutations';
import {
  KANBAN_LOOKUP_USUARIOS,
  KANBAN_LOOKUP_FORMS,
  KANBAN_LOOKUP_PROJETOS,
} from '@/src/application/persistence/sqlite/queries/kanban';

export type { ViewMode } from './useKanbanViewState';

export function useKanban() {
    const viewState = useKanbanViewState();
    const { currentProjectId, showAllProjects } = viewState;

    const data = useKanbanData(showAllProjects, currentProjectId);
    const { tasks, solicitacoes, setTasks, refetchTasks, refetchSolicitacoes } = data;

    const mutations = useKanbanMutations(
        tasks,
        solicitacoes,
        setTasks,
        currentProjectId,
        refetchTasks,
        refetchSolicitacoes,
        data.refetchProjects,
    );

    // Cancel pending syncs on unmount
    useEffect(() => {
        const { syncCancelledRef, taskSyncTimeoutRef } = mutations;
        syncCancelledRef.current = false;
        return () => {
            syncCancelledRef.current = true;
            if (taskSyncTimeoutRef.current) {
                clearTimeout(taskSyncTimeoutRef.current);
                taskSyncTimeoutRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getTasksByStatus = useCallback((status: 'solicitacao' | 'a_fazer' | 'em_progresso' | 'concluido' | 'arquivadas') => {
        if (status === 'solicitacao') return solicitacoes;
        if (status === 'arquivadas') return tasks.filter(t => t.arquivado).sort((a, b) => a.ordem - b.ordem);
        return tasks.filter(t => t.status === status).sort((a, b) => a.ordem - b.ordem);
    }, [tasks, solicitacoes]);

    return {
        // Data
        projects: data.projects,
        tasks,
        loading: data.isLoading,

        // Project selection
        currentProjectId: viewState.currentProjectId,
        setCurrentProjectId: viewState.setCurrentProjectId,
        showAllProjects: viewState.showAllProjects,
        setShowAllProjects: viewState.setShowAllProjects,

        // View mode
        viewMode: viewState.viewMode,
        setViewMode: viewState.setViewMode,

        // Task operations
        moveTask: mutations.moveTask,
        createTask: mutations.createTask,
        updateTask: mutations.updateTask,
        unfreezeTask: mutations.unfreezeTask,
        patchTask: mutations.patchTask,
        getTaskPatches: mutations.getTaskPatches,
        deleteTask: mutations.deleteTask,
        archiveTask: mutations.archiveTask,
        cancelTask: mutations.cancelTask,
        getTasksByStatus,
        approveSolicitacao: mutations.approveSolicitacao,
        rejectSolicitacao: mutations.rejectSolicitacao,

        // Project operations
        createProject: mutations.createProject,
        updateProject: mutations.updateProject,

        // Refresh
        refetchTasks,
        refetchProjects: data.refetchProjects,
        refetchSolicitacoes,
    };
}

// Helper hook for task options (users and forms)
export function useTaskOptions() {
    const { data: users, isPending: loadingUsers } = useTauriQuery<{ value: string; label: string }>(
        KANBAN_LOOKUP_USUARIOS.sql
    );
    const { data: forms, isPending: loadingForms } = useTauriQuery<{ value: string; label: string }>(
        KANBAN_LOOKUP_FORMS.sql
    );
    const { data: projects, isPending: loadingProjects } = useTauriQuery<{ value: string; label: string }>(
        KANBAN_LOOKUP_PROJETOS.sql
    );

    return {
        users: users || [],
        forms: forms || [],
        projects: projects || [],
        loading: loadingUsers || loadingForms || loadingProjects
    };
}
