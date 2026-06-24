"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Archive, ExternalLink, Users, Calendar, AlertTriangle } from "lucide-react";
import { ProjectWithMetrics } from "@/src/interface/hooks/catalog/kanban";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

interface ProjectCardProps {
    project: ProjectWithMetrics;
    canManage: boolean;
    onEdit: (project: ProjectWithMetrics) => void;
    onArchive: (project: ProjectWithMetrics) => void;
}

function DeadlineBadge({ dataFim }: { dataFim: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fim = new Date(dataFim + 'T00:00:00');
    const diffDays = Math.round((fim.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertTriangle className="h-3 w-3" />
                Atrasado {Math.abs(diffDays)}d
            </span>
        );
    }
    if (diffDays === 0) {
        return (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <Calendar className="h-3 w-3" />
                Vence hoje
            </span>
        );
    }
    if (diffDays <= 7) {
        return (
            <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                <Calendar className="h-3 w-3" />
                Vence em {diffDays}d
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </span>
    );
}

export function ProjectCard({ project, canManage, onEdit, onArchive }: ProjectCardProps) {
    const router = useRouter();

    const handleOpenKanban = () => {
        router.push(`/kanban?projeto=${project.id}`);
    };

    const handleOpenDetails = () => {
        router.push(`/projects/${project.id}`);
    };

    const total = project.total_tarefas;

    return (
        <Card className="flex flex-col hover:shadow-md transition-shadow cursor-pointer" onClick={handleOpenDetails}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                            style={{ backgroundColor: project.cor }}
                        />
                        <h3 className="font-semibold text-base leading-tight truncate">{project.nome}</h3>
                    </div>
                    {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                                title="Editar projeto"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); onArchive(project); }}
                                title="Arquivar projeto"
                            >
                                <Archive className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <ProjectStatusBadge status={project.status} />
                    {project.data_fim && <DeadlineBadge dataFim={project.data_fim} />}
                </div>

                {project.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{project.descricao}</p>
                )}
            </CardHeader>

            <CardContent className="flex flex-col gap-3 flex-1">
                {/* Task counters */}
                <div className="flex flex-wrap gap-1.5">
                    {project.cnt_a_fazer > 0 && (
                        <Badge variant="outline" className="text-slate-600 border-slate-300 text-xs">
                            {project.cnt_a_fazer} a fazer
                        </Badge>
                    )}
                    {project.cnt_em_progresso > 0 && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                            {project.cnt_em_progresso} em progresso
                        </Badge>
                    )}
                    {project.cnt_concluido > 0 && (
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                            {project.cnt_concluido} concluída{project.cnt_concluido !== 1 ? 's' : ''}
                        </Badge>
                    )}
                    {total === 0 && (
                        <span className="text-xs text-muted-foreground">Sem tarefas ativas</span>
                    )}
                </div>

                {/* Progress bar */}
                {total > 0 && (
                    <div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${Math.round((project.cnt_concluido / total) * 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {Math.round((project.cnt_concluido / total) * 100)}% concluído
                        </p>
                    </div>
                )}

                {/* Responsável */}
                {project.responsavel_nome && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="font-medium">Resp.:</span>
                        <span>{project.responsavel_nome}</span>
                    </div>
                )}

                {/* Interessados */}
                {project.interessados && project.interessados.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{project.interessados.length} interessado{project.interessados.length !== 1 ? 's' : ''}</span>
                    </div>
                )}

                <div className="mt-auto pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => { e.stopPropagation(); handleOpenKanban(); }}
                    >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Ver no Kanban
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
