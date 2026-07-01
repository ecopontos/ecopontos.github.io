/* eslint-disable react-hooks/preserve-manual-memoization */
import { useMemo } from 'react';
import { useAuth } from '@/src/interface/hooks/catalog/auth';
import { useTauriQuery } from '../tauri/useTauriQuery';
import { KanbanTask, KanbanProject, ProjetoStatus, Interessado } from '@/types';
import {
  PROJETO_DETAIL,
  PROJETO_TAREFAS,
  PROJETO_EVENTOS,
} from '@/src/application/persistence/sqlite/queries/projetos';

import { ProjectWithMetrics } from './useProjects';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const safeJsonParse = <T>(val: string | null | undefined, fallback: T): T => {
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
};

export interface ProjectEvent {
    id: string;
    tarefa_id: string;
    tarefa_titulo?: string;
    tipo: string;
    descricao?: string;
    usuario_id?: string;
    usuario_nome?: string;
    metadata?: string;
    created_at: string;
}

export interface ProjectDetailData extends ProjectWithMetrics {
    tarefas: KanbanTask[];
    eventos: ProjectEvent[];
}

export function useProjectDetail(projectId: string | null) {
    const { user } = useAuth();

    const projectQuery = useMemo(() => {
        if (!projectId || !UUID_REGEX.test(projectId) || !user?.id) {
            return { sql: 'SELECT 1 WHERE 1=0', params: [] as (string | number | null)[] };
        }
        return {
            sql: PROJETO_DETAIL.sql,
            params: [user.id, user.id, projectId] as (string | number | null)[],
        };
    }, [projectId, user?.id]);

    const tasksQuery = useMemo(() => {
        if (!projectId || !UUID_REGEX.test(projectId)) {
            return { sql: 'SELECT 1 WHERE 1=0', params: [] as (string | number | null)[] };
        }
        return {
            sql: PROJETO_TAREFAS.sql,
            params: [projectId] as (string | number | null)[],
        };
    }, [projectId]);

    const eventsQuery = useMemo(() => {
        if (!projectId || !UUID_REGEX.test(projectId)) {
            return { sql: 'SELECT 1 WHERE 1=0', params: [] as (string | number | null)[] };
        }
        return {
            sql: PROJETO_EVENTOS.sql,
            params: [projectId] as (string | number | null)[],
        };
    }, [projectId]);

    const enabled = !!projectId && UUID_REGEX.test(projectId ?? '') && !!user?.id;

    const { data: rawProject, isLoading: loadingProject, refetch: refetchProject } = useTauriQuery<Record<string, unknown>>(projectQuery.sql, projectQuery.params, { enabled });
    const { data: rawTasks, isLoading: loadingTasks, refetch: refetchTasks } = useTauriQuery<Record<string, unknown>>(tasksQuery.sql, tasksQuery.params, { enabled: !!projectId && UUID_REGEX.test(projectId ?? '') });
    const { data: rawEvents, isLoading: loadingEvents, refetch: refetchEvents } = useTauriQuery<Record<string, unknown>>(eventsQuery.sql, eventsQuery.params, { enabled: !!projectId && UUID_REGEX.test(projectId ?? '') });

    const project: ProjectDetailData | null = useMemo(() => {
        if (!rawProject || rawProject.length === 0) return null;
        const row = rawProject[0];
        const base: ProjectWithMetrics = {
            ...(row as unknown as KanbanProject),
            arquivado: Boolean(row.arquivado),
            status: (row.status as ProjetoStatus) ?? 'ativo',
            data_inicio: (row.data_inicio as string | null) ?? null,
            data_fim: (row.data_fim as string | null) ?? null,
            responsavel_id: (row.responsavel_id as string | null) ?? null,
            responsavel_nome: (row.responsavel_nome as string | null) ?? null,
            interessados: safeJsonParse(row.interessados_json as string | null, []) as Interessado[],
            meu_nivel_acesso: (row.meu_nivel_acesso as KanbanProject['meu_nivel_acesso']) ?? 'leitura',
            cnt_a_fazer: Number(row.cnt_a_fazer ?? 0),
            cnt_em_progresso: Number(row.cnt_em_progresso ?? 0),
            cnt_concluido: Number(row.cnt_concluido ?? 0),
            total_tarefas: Number(row.total_tarefas ?? 0),
            cnt_baixa: Number(row.cnt_baixa ?? 0),
            cnt_media: Number(row.cnt_media ?? 0),
            cnt_alta: Number(row.cnt_alta ?? 0),
        };

        const tarefas: KanbanTask[] = (rawTasks ?? []).map(r => ({
            ...(r as unknown as KanbanTask),
            arquivado: Boolean(r.arquivado),
        }));

        const eventos: ProjectEvent[] = (rawEvents ?? []).map(r => r as unknown as ProjectEvent);

        return { ...base, tarefas, eventos };
    }, [rawProject, rawTasks, rawEvents]);

    const loading = loadingProject || loadingTasks || loadingEvents;

    const refetch = async () => {
        await Promise.all([refetchProject(), refetchTasks(), refetchEvents()]);
    };

    return { project, loading, refetch };
}
