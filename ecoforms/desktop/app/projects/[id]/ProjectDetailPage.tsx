"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, ExternalLink, Pencil, Archive, Users, Calendar,
    CheckCircle2, Circle, Clock, AlertCircle, Flag, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectDetail } from "@/src/interface/hooks/catalog/kanban";
import { useProjectMutations } from "@/src/interface/hooks/catalog/kanban";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { ProjectDialog, ProjectDialogData } from "@/components/projects/ProjectDialog";
import { canManageByRole } from "@/src/interface/hooks/catalog/auth";

function formatDate(iso?: string | null) {
    if (!iso) return null;
    const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_TASK_CONFIG: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    a_fazer:     { icon: <Circle className="h-3.5 w-3.5" />, label: 'A fazer', className: 'text-slate-500' },
    em_progresso:{ icon: <Clock className="h-3.5 w-3.5" />, label: 'Em progresso', className: 'text-blue-500' },
    concluido:   { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Concluído', className: 'text-green-500' },
    cancelado:   { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Cancelado', className: 'text-red-400' },
    solicitacao: { icon: <Circle className="h-3.5 w-3.5" />, label: 'Solicitação', className: 'text-purple-400' },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
    baixa: { label: 'Baixa', className: 'text-slate-500 border-slate-300' },
    media: { label: 'Média', className: 'text-yellow-600 border-yellow-300' },
    alta:  { label: 'Alta',  className: 'text-red-600 border-red-300' },
};

function ProjectDetailContent({ projectId }: { projectId: string }) {
    const router = useRouter();
    const { user } = useAuth();
    const { project, loading, refetch } = useProjectDetail(projectId);
    const { updateProject, archiveProject } = useProjectMutations();
    const canManage = user?.perfil ? canManageByRole(user.perfil) : false;

    const [editOpen, setEditOpen] = useState(false);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                Carregando projeto...
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                <p>Projeto não encontrado.</p>
                <Button variant="outline" onClick={() => router.push('/projects')}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Voltar
                </Button>
            </div>
        );
    }

    const progressPct = project.total_tarefas > 0
        ? Math.round((project.cnt_concluido / project.total_tarefas) * 100)
        : 0;

    const handleArchive = async () => {
        if (!confirm(`Arquivar o projeto "${project.nome}"? As tarefas vinculadas serão mantidas.`)) return;
        await archiveProject(project.id, user?.id ?? 'sistema');
        router.push('/projects');
    };

    const handleSave = async (data: ProjectDialogData) => {
        await updateProject(project.id, {
            nome: data.nome,
            descricao: data.descricao,
            cor: data.cor,
            status: data.status,
            data_inicio: data.data_inicio || null,
            data_fim: data.data_fim || null,
            responsavel_id: data.responsavel_id || null,
            interessados: data.interessados,
        });
        await refetch();
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-auto">
            {/* Header */}
            <div className="p-6 border-b bg-white sticky top-0 z-10">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push('/projects')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <span
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: project.cor }}
                        />
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold text-gray-800 truncate">{project.nome}</h1>
                            {project.descricao && (
                                <p className="text-sm text-muted-foreground mt-0.5">{project.descricao}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <ProjectStatusBadge status={project.status} />
                        {canManage && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                    Editar
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleArchive} className="text-muted-foreground hover:text-destructive">
                                    <Archive className="h-3.5 w-3.5 mr-1.5" />
                                    Arquivar
                                </Button>
                            </>
                        )}
                        <Button size="sm" onClick={() => router.push(`/kanban?projeto=${project.id}`)}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Ver no Kanban
                        </Button>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50">
                {/* Coluna esquerda */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Progresso */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Progresso
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1.5 text-sm">
                                    <span className="text-muted-foreground">Conclusão geral</span>
                                    <span className="font-semibold text-green-600">{progressPct}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 rounded-full transition-all"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-slate-100 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-slate-700">{project.total_tarefas}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                                </div>
                                <div className="bg-slate-100 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-slate-500">{project.cnt_a_fazer}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">A fazer</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-blue-600">{project.cnt_em_progresso}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Em progresso</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-green-600">{project.cnt_concluido}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Concluídas</p>
                                </div>
                            </div>

                            {/* Prioridades */}
                            {project.total_tarefas > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <span className="text-xs text-muted-foreground self-center">Por prioridade:</span>
                                    {project.cnt_alta > 0 && (
                                        <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                                            <Flag className="h-3 w-3 mr-1" />
                                            {project.cnt_alta} alta
                                        </Badge>
                                    )}
                                    {project.cnt_media > 0 && (
                                        <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                                            <Flag className="h-3 w-3 mr-1" />
                                            {project.cnt_media} média
                                        </Badge>
                                    )}
                                    {project.cnt_baixa > 0 && (
                                        <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">
                                            <Flag className="h-3 w-3 mr-1" />
                                            {project.cnt_baixa} baixa
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Tarefas recentes */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                    Tarefas recentes
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={() => router.push(`/kanban?projeto=${project.id}`)}
                                >
                                    Ver todas
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {project.tarefas.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa ativa.</p>
                            ) : (
                                <div className="space-y-2">
                                    {project.tarefas.map(tarefa => {
                                        const sc = STATUS_TASK_CONFIG[tarefa.status] ?? STATUS_TASK_CONFIG.a_fazer;
                                        const pc = PRIORITY_CONFIG[tarefa.prioridade] ?? PRIORITY_CONFIG.media;
                                        return (
                                            <div key={tarefa.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                                                <span className={sc.className}>{sc.icon}</span>
                                                <span className="flex-1 text-sm truncate">{tarefa.titulo}</span>
                                                <Badge variant="outline" className={`text-xs shrink-0 ${pc.className}`}>
                                                    {pc.label}
                                                </Badge>
                                                {tarefa.prazo && (
                                                    <span className="text-xs text-muted-foreground shrink-0">
                                                        {formatDate(tarefa.prazo)}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Atividade recente */}
                    {project.eventos.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-muted-foreground" />
                                    Atividade recente
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {project.eventos.map(ev => (
                                        <div key={ev.id} className="flex items-start gap-2 text-sm">
                                            <span className="text-muted-foreground shrink-0 mt-0.5">
                                                {new Date(ev.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                {ev.usuario_nome && (
                                                    <span className="font-medium">{ev.usuario_nome} </span>
                                                )}
                                                <span className="text-muted-foreground">{ev.descricao ?? ev.tipo}</span>
                                                {ev.tarefa_titulo && (
                                                    <span className="text-xs text-muted-foreground ml-1">
                                                        — {ev.tarefa_titulo}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Coluna direita — info do projeto */}
                <div className="space-y-5">
                    {/* Detalhes */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Detalhes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <ProjectStatusBadge status={project.status} />
                            </div>

                            {project.responsavel_nome && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Responsável</span>
                                    <span className="font-medium">{project.responsavel_nome}</span>
                                </div>
                            )}

                            {project.criado_por_nome && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Criado por</span>
                                    <span>{project.criado_por_nome}</span>
                                </div>
                            )}

                            {project.data_inicio && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" /> Início
                                    </span>
                                    <span>{formatDate(project.data_inicio)}</span>
                                </div>
                            )}

                            {project.data_fim && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" /> Prazo
                                    </span>
                                    <span>{formatDate(project.data_fim)}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Criado em</span>
                                <span>{formatDate(project.created_at)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Membros */}
                    {project.interessados && project.interessados.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    Membros ({project.interessados.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {project.interessados.map((m, idx) => (
                                        <div key={`${m.usuario_id}-${idx}`} className="flex items-center justify-between text-sm">
                                            <span className="truncate">{m.nome ?? m.usuario_id}</span>
                                            <Badge
                                                variant="outline"
                                                className={`text-xs shrink-0 ${m.permissao === 'edicao' ? 'text-blue-600 border-blue-300' : 'text-slate-500 border-slate-300'}`}
                                            >
                                                {m.permissao === 'edicao' ? 'Edição' : 'Leitura'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <ProjectDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                mode="edit"
                project={project}
                onSave={handleSave}
            />
        </div>
    );
}

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    return (
        <ErrorBoundary moduleName="Detalhes do Projeto">
            <ProjectDetailContent projectId={id ?? ''} />
        </ErrorBoundary>
    );
}
