/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getContainerAsync } from '@/src/infrastructure/container';
import { KanbanProject, Interessado, ProjetoStatus } from '@/types';

export interface ProjectWithMetrics extends KanbanProject {
    cnt_a_fazer: number;
    cnt_em_progresso: number;
    cnt_concluido: number;
    total_tarefas: number;
    cnt_baixa: number;
    cnt_media: number;
    cnt_alta: number;
}

export function useProjects() {
    const { user, permissions } = useAuth();
    const [projects, setProjects] = useState<ProjectWithMetrics[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetch = useCallback(async () => {
        if (!user?.id) { setProjects([]); return; }
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            const isAdminOrManager = permissions.isAdmin() || permissions.isManager();
            const result = await container.projects.listWithMetrics.execute(user.id, isAdminOrManager);
            setProjects(result);
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
            setLoading(false);
        }
    }, [user?.id, permissions]);

    useEffect(() => { fetch(); }, [fetch]);

    return { projects, loading, error, refetch: fetch };
}

export interface ProjectPatch {
    nome?: string;
    descricao?: string;
    cor?: string;
    status?: ProjetoStatus;
    data_inicio?: string | null;
    data_fim?: string | null;
    responsavel_id?: string | null;
    interessados?: Interessado[];
}

export function useProjectMutations() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
        setLoading(true);
        setError(null);
        try {
            return await fn();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const createProject = async (
        nome: string,
        descricao: string = '',
        cor: string = '#3B82F6',
        interessados: Interessado[] = [],
        extra: { status?: ProjetoStatus; data_inicio?: string | null; data_fim?: string | null; responsavel_id?: string | null; setor_id?: string | null } = {}
    ): Promise<string> => {
        if (!user) throw new Error('Not ready');
        const container = await getContainerAsync();
        const resolved = { ...extra, setor_id: extra.setor_id ?? user.setores?.[0] ?? null };
        return withLoading(() => container.projects.create.execute(nome, descricao, cor, user.id, interessados, resolved));
    };

    const updateProject = async (projectId: string, patch: ProjectPatch) => {
        const container = await getContainerAsync();
        return withLoading(() => container.projects.update.execute(projectId, patch));
    };

    const archiveProject = async (projectId: string, arquivadoPor: string) => {
        const container = await getContainerAsync();
        return withLoading(() => container.projects.archive.execute(projectId, arquivadoPor));
    };

    const unarchiveProject = async (projectId: string) => {
        const container = await getContainerAsync();
        return withLoading(() => container.projects.unarchive.execute(projectId));
    };

    return { createProject, updateProject, archiveProject, unarchiveProject, loading, error };
}
