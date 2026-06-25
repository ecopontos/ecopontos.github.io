import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { stableStringify, uuidv7 } from 'ecoforms-core';
import { KanbanTask, UnifiedTaskView, Interessado } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncStatus } from '@/contexts/SyncContext';
import { useTaskUseCases } from '../domain/useTaskUseCases';
import { supabase } from '@/src/infrastructure/persistence/supabase/supabaseClient';
import { getContainer } from '@/src/infrastructure/container';
import { toast } from 'sonner';
import type { TaskStatus } from '@/src/domain/task/TaskStatus';
import { assertValidTransition } from '@/src/domain/task/TaskStatus';

const ACTIVE_RUNTIME_STATUSES = new Set<KanbanTask['status']>(['a_fazer', 'em_progresso']);

type TaskMutationInput = Omit<Partial<KanbanTask>, 'atribuido_para' | 'form_registry_id' | 'projeto_id'> & {
    atribuido_para?: string | null;
    form_registry_id?: string | null;
    projeto_id?: string | null;
    interessados?: Interessado[];
};

export function useKanbanMutations(
    tasks: UnifiedTaskView[],
    solicitacoes: UnifiedTaskView[],
    setTasks: React.Dispatch<React.SetStateAction<UnifiedTaskView[]>>,
    currentProjectId: string | null,
    refetchTasks: () => void,
    refetchSolicitacoes: () => void,
    refetchProjects?: () => void
) {
    const { user, permissions } = useAuth();
    const { syncNow } = useSyncStatus();
    const queryClient = useQueryClient();
    const taskUseCases = useTaskUseCases();
    const kanban = getContainer().kanbanRepository;

    const taskSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const syncCancelledRef = useRef(false);

    const invalidateKanbanQueries = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: ['tauri-query'] });
    }, [queryClient]);

    const scheduleTaskSync = useCallback((delayMs: number = 1500) => {
        if (taskSyncTimeoutRef.current) clearTimeout(taskSyncTimeoutRef.current);
        taskSyncTimeoutRef.current = setTimeout(() => {
            const attemptSync = async (retries = 3) => {
                if (syncCancelledRef.current) return;
                try {
                    await syncNow();
                } catch (_err) {
                    if (retries > 1 && !syncCancelledRef.current) {
                        taskSyncTimeoutRef.current = setTimeout(() => attemptSync(retries - 1), 3000);
                    }
                }
            };
            attemptSync();
        }, delayMs);
    }, [syncNow]);

    const validateRuntimeTask = useCallback(async (incoming: TaskMutationInput, current?: Partial<KanbanTask>) => {
        const merged = { ...current, ...incoming } as Partial<KanbanTask>;
        const isAssigned = Boolean(merged.atribuido_para);
        const isActive = ACTIVE_RUNTIME_STATUSES.has(merged.status || 'a_fazer');
        const hasForm = Boolean(merged.form_registry_id);

        if (isAssigned && isActive && !hasForm) {
            throw new Error('Tarefas atribuídas para operador em andamento precisam de formulário vinculado para aparecer no runtime mobile.');
        }

        if (isAssigned && merged.atribuido_para) {
            const active = await kanban.isUserActive(merged.atribuido_para);
            if (!active) {
                throw new Error('O usuário atribuído está inativo e não pode receber tarefas no runtime.');
            }
        }

        if (hasForm && merged.form_registry_id) {
            const active = await kanban.isFormActive(merged.form_registry_id);
            if (!active) {
                throw new Error('O formulário vinculado está inativo e não pode ser usado em tarefas do runtime.');
            }
        }
    }, [kanban]);

    const buildSnapHash = useCallback((value: unknown): string => {
        const raw = stableStringify(value);
        let hash = 2166136261;
        for (let i = 0; i < raw.length; i++) {
            hash ^= raw.charCodeAt(i);
            hash = (hash * 16777619) >>> 0;
        }
        return hash.toString(16);
    }, []);

    const insertTaskEvent = useCallback(async (
        tarefaId: string,
        tipo: string,
        descricao: string | null,
        metadata?: Record<string, unknown> | null,
    ) => {
        try {
            await kanban.insertTaskEvent({
                id: uuidv7(),
                tarefaId,
                tipo,
                descricao: descricao ?? null,
                usuarioId: user?.id ?? null,
                metadata: metadata ?? null,
            });
        } catch (e) {
            console.warn('[insertTaskEvent] falhou:', e);
        }
    }, [kanban, user]);

    const ensureGeneralProject = useCallback(async (): Promise<string> => {
        if (!user) throw new Error("Conexão com banco ou usuário não disponível para operação.");
        return kanban.ensureGeneralProject(user.id);
    }, [kanban, user]);

    const moveTask = async (taskId: string, newStatus: 'a_fazer' | 'em_progresso' | 'concluido', newOrder: number) => {
        if (!user) throw new Error('Usuário não autenticado.');
        const currentTask = tasks.find(t => t.id === taskId);
        const isOwner = currentTask?.criado_por === user.id || currentTask?.atribuido_para === user.id;
        const isPrivileged = permissions.hasPermission('tasks.reassign');
        if (!isOwner && !isPrivileged) {
            throw new Error('Sem permissão para mover esta tarefa.');
        }
        await validateRuntimeTask({ status: newStatus }, currentTask);
        const oldStatus = currentTask?.status;
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, ordem: newOrder } : t));
        try {
            if (newStatus === 'concluido') {
                await taskUseCases.complete.execute({ id: taskId });
            } else {
                await taskUseCases.move.execute({ id: taskId, to: newStatus as TaskStatus, ordem: newOrder });
            }
            await invalidateKanbanQueries();
            await insertTaskEvent(taskId, 'status', `Status alterado`, { de: oldStatus, para: newStatus });
            scheduleTaskSync(1500);
        } catch (error) {
            console.error('Error moving task:', error);
            refetchTasks();
        }
    };

    const createTask = async (task: Partial<KanbanTask> & { payload?: Record<string, unknown>; location?: string }) => {
        if (!user) return;
        await validateRuntimeTask(task);
        const snapFrozenAt = new Date().toISOString();
        let finalProjectId = task.projeto_id || currentProjectId || null;
        if (!finalProjectId) finalProjectId = await ensureGeneralProject();

        type TaskWithExtras = Partial<KanbanTask> & {
            setor_id?: string | null;
            prazo_fim?: string | null;
            tipo_prazo?: string;
            recorrencia?: string | null;
            payload?: Record<string, unknown>;
            location?: string | null;
        };
        const taskExtras = task as TaskWithExtras;

        let setorId = taskExtras.setor_id || null;
        if (!setorId && task.atribuido_para) {
            try {
                const sectors = await kanban.getUserSectors(task.atribuido_para);
                setorId = sectors[0] ?? null;
            } catch (e) { console.warn('[createTask] getUserSectors falhou:', e); }
        }

        const newTaskId = uuidv7();
        const snapBasis = {
            task_id: newTaskId,
            form_id: task.form_registry_id || null,
            payload: task.payload || null,
            metadata: {
                operator_id: task.atribuido_para || null,
                department_id: setorId,
                cycle: task.cycle_id || null,
                created_at: snapFrozenAt,
                container_task_id: task.container_task_id || null,
                parent_task_id: task.parent_task_id || null,
                depends_on_task_id: task.depends_on_task_id || null,
            }
        };
        const snapHash = buildSnapHash(snapBasis);

        await kanban.createTask({
            id: newTaskId,
            projetoId: finalProjectId,
            titulo: task.titulo || 'Nova Tarefa',
            descricao: task.descricao || '',
            status: task.status || 'a_fazer',
            prioridade: task.prioridade || 'media',
            atribuidoPara: task.atribuido_para || null,
            setorId,
            criadoPor: user.id,
            prazo: task.prazo || null,
            prazoFim: taskExtras.prazo_fim || null,
            tipoPrazo: taskExtras.tipo_prazo || 'unico',
            recorrencia: taskExtras.recorrencia || null,
            ordem: task.ordem || 0,
            tags: JSON.stringify(task.tags || []),
            arquivado: 0,
            formRegistryId: task.form_registry_id || null,
            tblSuiteId: task.suite_id ? String(task.suite_id) : null,
            parentTaskId: task.parent_task_id || null,
            containerTaskId: task.container_task_id || null,
            cycleId: task.cycle_id || null,
            dependsOnTaskId: task.depends_on_task_id || null,
            snapVersion: '1.0',
            snapHash,
            snapFrozenAt,
            location: taskExtras.location || null,
            payload: task.payload ? JSON.stringify(task.payload) : null,
        }, task.interessados);

        await invalidateKanbanQueries();
        await insertTaskEvent(newTaskId, 'criacao', `Tarefa criada: ${task.titulo || 'Nova Tarefa'}`);
        scheduleTaskSync(1500);
        return { id: newTaskId };
    };

    const updateTask = async (taskId: string, updates: Partial<KanbanTask>) => {
        const currentTask = tasks.find(t => t.id === taskId);
        if (updates.status && currentTask?.status && updates.status !== currentTask.status) {
            assertValidTransition(currentTask.status as TaskStatus, updates.status as TaskStatus);
        }
        await validateRuntimeTask(updates, currentTask);
        const isSnapFrozen = Boolean(currentTask?.snap_frozen_at);

        type UpdatesWithExtras = Partial<KanbanTask> & {
            payload?: unknown;
            prazo_fim?: string | null;
            tipo_prazo?: string;
            recorrencia?: string | null;
            location?: string | null;
            setor_id?: string | null;
        };
        const updatesExtras = updates as UpdatesWithExtras;

        if (isSnapFrozen && (
            updatesExtras.payload !== undefined ||
            updates.form_registry_id !== undefined ||
            updates.parent_task_id !== undefined ||
            updates.container_task_id !== undefined ||
            updates.cycle_id !== undefined ||
            updates.depends_on_task_id !== undefined
        )) {
            throw new Error('Payload imutavel: a tarefa está congelada (snap_frozen_at definido). Use unfreezeTask primeiro.');
        }

        let setorId: string | null | undefined = updatesExtras.setor_id;
        if (updates.atribuido_para !== undefined && updates.atribuido_para && setorId === undefined) {
            try {
                const sectors = await kanban.getUserSectors(updates.atribuido_para);
                setorId = sectors[0] ?? null;
            } catch (e) { console.warn('[updateTask] getUserSectors falhou:', e); }
        }

        const input: import('@/src/domain/kanban/KanbanRepository').UpdateKanbanTaskInput = {
            titulo: updates.titulo,
            descricao: updates.descricao,
            status: updates.status,
            prioridade: updates.prioridade,
            prazo: updates.prazo ?? null,
            prazoFim: updatesExtras.prazo_fim ?? null,
            tipoPrazo: updatesExtras.tipo_prazo,
            recorrencia: updatesExtras.recorrencia ?? null,
            atribuidoPara: updates.atribuido_para ?? null,
            setorId: setorId ?? null,
            projetoId: updates.projeto_id,
            ordem: updates.ordem,
            tags: updates.tags !== undefined ? JSON.stringify(updates.tags) : undefined,
            formRegistryId: updates.form_registry_id,
            tblSuiteId: updates.suite_id ? String(updates.suite_id) : null,
            location: updatesExtras.location ?? null,
            payload: updatesExtras.payload !== undefined ? (typeof updatesExtras.payload === 'string' ? updatesExtras.payload : JSON.stringify(updatesExtras.payload)) : undefined,
            parentTaskId: updates.parent_task_id,
            containerTaskId: updates.container_task_id,
            cycleId: updates.cycle_id,
            dependsOnTaskId: updates.depends_on_task_id,
        };

        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));

        try {
            await kanban.updateTask(taskId, input, updates.interessados);
            await invalidateKanbanQueries();
            if (updates.atribuido_para !== undefined) {
                await insertTaskEvent(taskId, 'atribuicao', 'Responsável alterado', { para: updates.atribuido_para });
            } else {
                const changedFields: string[] = [];
                if (updates.titulo !== undefined) changedFields.push('titulo');
                if (updates.descricao !== undefined) changedFields.push('descricao');
                if (updates.status !== undefined) changedFields.push('status');
                if (updates.prioridade !== undefined) changedFields.push('prioridade');
                if (updates.prazo !== undefined) changedFields.push('prazo');
                if (changedFields.length > 0) {
                    await insertTaskEvent(taskId, 'edicao', 'Tarefa editada', { campos: changedFields });
                }
            }
            scheduleTaskSync(1500);
        } catch (error) {
            console.error('Error updating task:', error);
            refetchTasks();
            throw error;
        }
    };

    const unfreezeTask = async (taskId: string) => {
        try {
            const currentTask = tasks.find(t => t.id === taskId);
            const userId = currentTask?.atribuido_para;
            let patchFields: { titulo?: string; descricao?: string; prioridade?: string; payload?: string | null } | undefined;

            if (userId && supabase) {
                try {
                    const { data: patchFiles } = await supabase.storage
                        .from('sync-bucket')
                        .list(`users/${userId}/inbox/${taskId}/patches/`);

                    if (patchFiles && patchFiles.length > 0) {
                        const sorted = [...patchFiles].sort((a, b) => a.name.localeCompare(b.name));
                        const consolidatedPatch: Record<string, unknown> = {};

                        for (const file of sorted) {
                            const { data: blob } = await supabase.storage
                                .from('sync-bucket')
                                .download(`users/${userId}/inbox/${taskId}/patches/${file.name}`);
                            if (blob) {
                                const text = await blob.text();
                                const patch = JSON.parse(text) as Record<string, unknown>;
                                Object.assign(consolidatedPatch, patch);
                            }
                        }

                        delete consolidatedPatch._patched_at;
                        delete consolidatedPatch._patched_by;

                        patchFields = {
                            titulo: consolidatedPatch.titulo !== undefined ? String(consolidatedPatch.titulo) : undefined,
                            descricao: consolidatedPatch.descricao !== undefined ? String(consolidatedPatch.descricao) : undefined,
                            prioridade: consolidatedPatch.prioridade !== undefined ? String(consolidatedPatch.prioridade) : undefined,
                            payload: consolidatedPatch.payload !== undefined
                                ? (typeof consolidatedPatch.payload === 'string' ? consolidatedPatch.payload : JSON.stringify(consolidatedPatch.payload))
                                : undefined,
                        };

                        await insertTaskEvent(taskId, 'patch_consolidado', `${sorted.length} patch(es) consolidados antes do unfreeze`, { count: sorted.length });
                        toast.info(`${sorted.length} correção(ões) consolidada(s) antes de liberar a tarefa.`);
                    }
                } catch (patchError) {
                    console.warn('⚠️ Falha ao consolidar patches antes do unfreeze:', patchError);
                }
            }

            await kanban.unfreezeTask(taskId, patchFields);
            await invalidateKanbanQueries();
            scheduleTaskSync();
            toast.success("Tarefa liberada para edição.", { description: "O bloqueio de snapshot foi removido e as correções foram aplicadas." });
        } catch (error) {
            toast.error("Falha ao liberar tarefa para edição.");
            throw error;
        }
    };

    const patchTask = async (taskId: string, updates: Partial<KanbanTask>) => {
        const currentTask = tasks.find(t => t.id === taskId);
        if (!currentTask) throw new Error("Tarefa não encontrada.");
        if (updates.form_registry_id !== undefined && updates.form_registry_id !== currentTask.form_registry_id) throw new Error("Não é possível alterar o formulário via patch.");
        const userId = currentTask.atribuido_para;
        if (!userId) throw new Error("Tarefa não atribuída a um operador para receber patch.");
        const timestamp = Date.now();
        const patchPath = `users/${userId}/inbox/${taskId}/patches/${timestamp}.json`;
        const patchData = { ...updates, _patched_at: new Date().toISOString(), _patched_by: user?.id };
        try {
            const { error: uploadError } = await supabase.storage.from('sync-bucket').upload(patchPath, JSON.stringify(patchData), { contentType: 'application/json', upsert: true });
            if (uploadError) throw uploadError;
            type PatchUpdatesExtras = Partial<KanbanTask> & { payload?: unknown };
            const patchUpdates = updates as PatchUpdatesExtras;
            await kanban.patchTask(taskId, {
                titulo: updates.titulo,
                descricao: updates.descricao,
                prioridade: updates.prioridade,
                payload: patchUpdates.payload !== undefined ? (typeof patchUpdates.payload === 'string' ? patchUpdates.payload : JSON.stringify(patchUpdates.payload)) : undefined,
            });
            await invalidateKanbanQueries();
            toast.success("Correção enviada via patch!");
            await insertTaskEvent(taskId, 'patch', 'Patch enviado via JSON', { patchPath });
            scheduleTaskSync(500);
        } catch (error) {
            toast.error("Falha ao enviar correção para o dispositivo.");
            throw error;
        }
    };

    const getTaskPatches = async (taskId: string) => {
        const currentTask = tasks.find(t => t.id === taskId);
        const userId = currentTask?.atribuido_para;
        if (!userId) return [];
        try {
            const { data, error } = await supabase.storage.from('sync-bucket').list(`users/${userId}/inbox/${taskId}/patches/`);
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[getTaskPatches] falhou:', e); return []; }
    };

    const deleteTask = async (taskId: string) => {
        try {
            await taskUseCases.delete.execute(taskId);
            await insertTaskEvent(taskId, 'exclusao', 'Tarefa excluída (soft-delete)', { deletado_por: user?.id ?? null });
            await invalidateKanbanQueries();
            scheduleTaskSync();
        } catch (error) { throw error; }
    };

    const cancelTask = async (taskId: string, motivo: string) => {
        try {
            await taskUseCases.move.execute({ id: taskId, to: 'cancelado' });
            await insertTaskEvent(taskId, 'cancelamento', `Tarefa cancelada: ${motivo}`, { motivo, cancelado_por: user?.id ?? null });
            await invalidateKanbanQueries();
            scheduleTaskSync(1500);
            toast.info("Tarefa cancelada.", { description: motivo });
        } catch (error) {
            console.error('Error canceling task:', error);
            refetchTasks();
            throw error;
        }
    };

    const archiveTask = async (taskId: string, archived: boolean = true) => {
        try {
            if (archived) {
                await taskUseCases.archive.execute(taskId);
            } else {
                await kanban.unarchiveTask(taskId);
            }
            await insertTaskEvent(taskId, 'arquivamento', archived ? 'Tarefa arquivada' : 'Tarefa restaurada', { arquivado: archived });
            scheduleTaskSync();
        } catch (error) { throw error; }
    };

    const approveSolicitacao = async (solicitationId: string, overrides?: Partial<KanbanTask>, updatedFormDados?: unknown) => {
        if (!user) return;
        const solicitation = solicitacoes.find(s => s.id === solicitationId);
        if (!solicitation) throw new Error("Solicitação não encontrada no estado local.");

        try {
            let finalProjectId = overrides?.projeto_id || solicitation.projeto_id || currentProjectId || null;
            if (!finalProjectId) finalProjectId = await ensureGeneralProject();

            const overridesExtras = (overrides || {}) as (Partial<KanbanTask> & { status?: TaskStatus });
            const finalFormDados = updatedFormDados || solicitation.form_dados;

            let carga: string | null = null;
            if (finalFormDados) {
                try { carga = JSON.stringify(finalFormDados); } catch { carga = '{}'; }
            }

            await kanban.approveSolicitacao({
                taskId: solicitationId,
                projetoId: finalProjectId,
                titulo: overrides?.titulo || solicitation.titulo,
                descricao: overrides?.descricao || solicitation.descricao || null,
                status: overridesExtras.status || 'a_fazer',
                prioridade: overrides?.prioridade || solicitation.prioridade || 'media',
                atribuidoPara: overrides?.atribuido_para || null,
                aprovadoPor: user.id,
                prazo: overrides?.prazo || null,
                formRegistryId: overrides?.form_registry_id || solicitation.form_nome || null,
                carga,
            });

            toast.success("Solicitação aprovada!");
            refetchTasks();
            refetchSolicitacoes();
            scheduleTaskSync();
        } catch (error) {
            toast.error("Falha ao aprovar solicitação.");
            throw error;
        }
    };

    const rejectSolicitacao = async (solicitationId: string, motivo: string) => {
        if (!user) return;
        try {
            await kanban.rejectSolicitacao(solicitationId, motivo);
            toast.info("Solicitação rejeitada.");
            refetchSolicitacoes();
            scheduleTaskSync();
        } catch (error) {
            toast.error("Falha ao rejeitar solicitação.");
            throw error;
        }
    };

    const createProject = async (name: string, description?: string, color: string = '#3B82F6', interessados?: Interessado[]) => {
        if (!user) return;
        const newProjectId = uuidv7();
        try {
            await kanban.createProject(newProjectId, name, description || '', color, user.id);
            if (interessados && interessados.length > 0) {
                await kanban.addProjectInteressados(newProjectId, interessados);
            }
            await invalidateKanbanQueries();
            refetchProjects?.();
            return { id: newProjectId, nome: name, descricao: description || '', cor: color, criado_por: user.id, arquivado: false };
        } catch (error) { throw error; }
    };

    const updateProject = async (projectId: string, patch: { nome?: string; descricao?: string; cor?: string; interessados?: Interessado[] }) => {
        await kanban.updateProject(projectId, patch.nome, patch.descricao, patch.cor);
        if (patch.interessados !== undefined) {
            await kanban.clearProjectInteressados(projectId);
            if (patch.interessados.length > 0) {
                await kanban.addProjectInteressados(projectId, patch.interessados);
            }
        }
        await invalidateKanbanQueries();
        refetchProjects?.();
    };

    return {
        moveTask, createTask, updateTask, unfreezeTask, patchTask, getTaskPatches, deleteTask, archiveTask, cancelTask,
        approveSolicitacao, rejectSolicitacao, createProject, updateProject,
        scheduleTaskSync, syncCancelledRef, taskSyncTimeoutRef,
    };
}
