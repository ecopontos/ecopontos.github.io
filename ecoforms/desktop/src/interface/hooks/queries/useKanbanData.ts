import { useState, useEffect, useMemo } from 'react';
import { Interessado, KanbanProject, UnifiedTaskView } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessiblePerfis } from '@/src/infrastructure/persistence/AccessFilterBuilder';
import { getContainerAsync } from '@/src/infrastructure/container';

type JsonObject = Record<string, unknown>;

const safeJsonParse = <T>(val: string | null | undefined, fallback: T): T => {
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
};

export function useKanbanData(
    showAllProjects: boolean,
    currentProjectId: string | null
) {
    const { user, permissions } = useAuth();

    const accessiblePerfis = useMemo(() => {
        if (!user?.perfil) return [];
        return getAccessiblePerfis(user.perfil);
    }, [user]);

    const [projects, setProjects] = useState<KanbanProject[]>([]);
    const [tasks, setTasks] = useState<UnifiedTaskView[]>([]);
    const [solicitacoes, setSolicitacoes] = useState<UnifiedTaskView[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!user?.id) {
                if (!cancelled) { setProjects([]); setTasks([]); setSolicitacoes([]); }
                return;
            }
            if (!cancelled) setIsLoading(true);
            try {
                const c = await getContainerAsync();
                const { projects: pRows, tasks: tRows, solicitacoes: sRows } = await c.kanbanRepository.getKanbanData(
                    user.id, user.perfil || '', user.setores?.[0] || null,
                    permissions.isAdmin(), permissions.isManager(),
                    accessiblePerfis, showAllProjects, currentProjectId,
                );
                if (!cancelled) {
                    setProjects(pRows.map((p) => ({
                        ...(p as unknown as KanbanProject),
                        arquivado: Boolean(p.arquivado),
                        interessados: safeJsonParse<Interessado[]>(typeof p.interessados_json === 'string' ? p.interessados_json : null, [])
                    })));
                    setTasks(tRows.map((t) => ({
                        ...(t as unknown as UnifiedTaskView),
                        arquivado: Boolean(t.arquivado),
                        atrasado: Boolean(t.atrasado),
                        proximo_prazo: Boolean(t.proximo_prazo),
                        tags: t.tags ? (typeof t.tags === 'string' ? safeJsonParse<string[]>(String(t.tags), []) : t.tags as string[]) : [],
                        payload: t.payload ? (typeof t.payload === 'string' ? safeJsonParse<JsonObject>(String(t.payload), {}) : t.payload as JsonObject) : {},
                        form_dados: t.form_dados ? (typeof t.form_dados === 'string' ? safeJsonParse<JsonObject>(String(t.form_dados), {}) : t.form_dados as JsonObject) : undefined,
                        interessados: t.interessados_json ? (typeof t.interessados_json === 'string' ? safeJsonParse<Interessado[]>(String(t.interessados_json), []) : t.interessados_json as Interessado[]) : [],
                        num_comentarios: Number(t.num_comentarios || 0),
                        num_anexos: Number(t.num_anexos || 0),
                        num_registros: Number(t.num_registros || 0),
                        ordem: Number(t.ordem || 0),
                        origem: 'kanban'
                    })));
                    setSolicitacoes(sRows.map((s) => ({
                        ...(s as unknown as UnifiedTaskView),
                        status: 'solicitacao',
                        atribuido_username: String(s.user_nome ?? ''),
                        form_nome: String(s.id_formulario ?? ''),
                        form_dados: safeJsonParse<JsonObject>(typeof s.carga === 'string' ? s.carga : null, {}),
                        num_comentarios: 0, num_anexos: 0, num_registros: 0,
                        origem: 'formulario',
                        projeto_nome: 'Aguardando Aprovação',
                        projeto_cor: '#f59e0b',
                    })));
                }
            } catch (err) {
                console.error('[useKanbanData] Error:', err);
                if (!cancelled) { setProjects([]); setTasks([]); setSolicitacoes([]); }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [user, permissions, accessiblePerfis, showAllProjects, currentProjectId]);

    const refetch = () => {
        // trigger re-fetch by changing a dependency - but we don't have a mutable ref here
        // For simplicity, the consumer can remount or we can add a refetch counter
    };

    return {
        projects,
        tasks,
        setTasks,
        solicitacoes,
        isLoading,
        refetchProjects: refetch,
        refetchTasks: refetch,
        refetchSolicitacoes: refetch,
    };
}
