"use client";

import { useState, useMemo } from "react";
import { Plus, FolderKanban, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { canManageByRole } from "@/src/interface/hooks/catalog/auth";
import { useProjects, useProjectMutations, ProjectWithMetrics } from "@/src/interface/hooks/catalog/kanban";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectDialog, ProjectDialogData } from "@/components/projects/ProjectDialog";
import { ProjetoStatus } from "@/types";

type SortKey = 'criacao' | 'nome' | 'data_fim' | 'progresso';

function ProjectsContent() {
    const { user } = useAuth();
    const { projects, loading, refetch } = useProjects();
    const { createProject, updateProject, archiveProject } = useProjectMutations();
    const canManage = user?.perfil ? canManageByRole(user.perfil) : false;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
    const [editingProject, setEditingProject] = useState<ProjectWithMetrics | undefined>(undefined);

    // Filtros
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<ProjetoStatus | 'todos'>('todos');
    const [sortKey, setSortKey] = useState<SortKey>('criacao');

    const handleNew = () => {
        setEditingProject(undefined);
        setDialogMode('create');
        setDialogOpen(true);
    };

    const handleEdit = (project: ProjectWithMetrics) => {
        setEditingProject(project);
        setDialogMode('edit');
        setDialogOpen(true);
    };

    const handleArchive = async (project: ProjectWithMetrics) => {
        if (!confirm(`Arquivar o projeto "${project.nome}"? As tarefas vinculadas serão mantidas.`)) return;
        await archiveProject(project.id, user?.id ?? 'sistema');
        await refetch();
    };

    const handleSave = async (data: ProjectDialogData) => {
        if (dialogMode === 'create') {
            await createProject(data.nome, data.descricao, data.cor, data.interessados, {
                status: data.status,
                data_inicio: data.data_inicio || null,
                data_fim: data.data_fim || null,
                responsavel_id: data.responsavel_id || null,
            });
        } else if (editingProject) {
            await updateProject(editingProject.id, {
                nome: data.nome,
                descricao: data.descricao,
                cor: data.cor,
                status: data.status,
                data_inicio: data.data_inicio || null,
                data_fim: data.data_fim || null,
                responsavel_id: data.responsavel_id || null,
                interessados: data.interessados,
            });
        }
        await refetch();
    };

    const filteredProjects = useMemo(() => {
        let list = [...projects];

        if (filterStatus !== 'todos') {
            list = list.filter(p => (p.status ?? 'ativo') === filterStatus);
        }

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(p =>
                p.nome.toLowerCase().includes(q) ||
                (p.descricao ?? '').toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            switch (sortKey) {
                case 'nome':
                    return a.nome.localeCompare(b.nome, 'pt-BR');
                case 'data_fim': {
                    if (!a.data_fim && !b.data_fim) return 0;
                    if (!a.data_fim) return 1;
                    if (!b.data_fim) return -1;
                    return a.data_fim.localeCompare(b.data_fim);
                }
                case 'progresso': {
                    const pa = a.total_tarefas > 0 ? a.cnt_concluido / a.total_tarefas : 0;
                    const pb = b.total_tarefas > 0 ? b.cnt_concluido / b.total_tarefas : 0;
                    return pb - pa;
                }
                default:
                    return b.created_at.localeCompare(a.created_at);
            }
        });

        return list;
    }, [projects, filterStatus, search, sortKey]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                Carregando projetos...
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-white">
                <div className="flex items-center gap-3">
                    <FolderKanban className="h-6 w-6 text-muted-foreground" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Projetos</h1>
                        <p className="text-sm text-muted-foreground">
                            {filteredProjects.length} de {projects.length} projeto{projects.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                {canManage && (
                    <Button onClick={handleNew}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        Novo Projeto
                    </Button>
                )}
            </div>

            {/* Toolbar de filtros */}
            <div className="flex items-center gap-3 px-6 py-3 border-b bg-white flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-8 h-8 text-sm"
                        placeholder="Buscar projetos..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as ProjetoStatus | 'todos')}>
                    <SelectTrigger className="h-8 text-sm w-36">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="pausado">Pausado</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                    <SelectTrigger className="h-8 text-sm w-44">
                        <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="criacao">Mais recentes</SelectItem>
                        <SelectItem value="nome">Nome A-Z</SelectItem>
                        <SelectItem value="data_fim">Data fim</SelectItem>
                        <SelectItem value="progresso">Progresso</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
                {filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                        <FolderKanban className="h-12 w-12 opacity-20" />
                        {projects.length === 0 ? (
                            <>
                                <p>Nenhum projeto ativo.</p>
                                {canManage && (
                                    <Button variant="outline" onClick={handleNew}>
                                        <Plus className="h-4 w-4 mr-1.5" />
                                        Criar primeiro projeto
                                    </Button>
                                )}
                            </>
                        ) : (
                            <p>Nenhum projeto encontrado com os filtros atuais.</p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProjects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                canManage={canManage}
                                onEdit={handleEdit}
                                onArchive={handleArchive}
                            />
                        ))}
                    </div>
                )}
            </div>

            <ProjectDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                mode={dialogMode}
                project={editingProject}
                onSave={handleSave}
            />
        </div>
    );
}

export default function ProjectsPage() {
    return (
        <ErrorBoundary moduleName="Projetos">
            <ProjectsContent />
        </ErrorBoundary>
    );
}
