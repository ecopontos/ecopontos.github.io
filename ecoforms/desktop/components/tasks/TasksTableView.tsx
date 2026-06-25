"use client";

import { useState, useMemo } from "react";
import { TaskDateConfig, UnifiedTaskView } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    MoreHorizontal,
    Calendar,
    CalendarRange,
    User,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Trash2,
    Archive,
    Repeat,
    Crown,
    Lock,
    Pencil,
    Users2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Send,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StatusFilter = 'all' | 'a_fazer' | 'em_progresso' | 'concluido';
type SortField = 'prazo' | 'prioridade' | null;
type SortDir = 'asc' | 'desc';

const PRIORIDADE_ORDEM: Record<string, number> = { alta: 3, media: 2, baixa: 1 };

// ADR-044 gap 10: função pura movida para o escopo do módulo (não recriada a cada render)
function parseRecorrencia(value: UnifiedTaskView["recorrencia"]): TaskDateConfig["recorrencia"] | undefined {
    if (!value) {
        return undefined;
    }

    try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return undefined;
        }

        const record = parsed as Record<string, unknown>;
        const frequencia = record.frequencia;
        const intervalo = record.intervalo;
        const diasSemana = record.dias_semana;
        const fimRecorrencia = record.fim_recorrencia;

        if (
            frequencia !== "diaria" &&
            frequencia !== "semanal" &&
            frequencia !== "mensal" &&
            frequencia !== "anual"
        ) {
            return undefined;
        }

        return {
            frequencia,
            intervalo: typeof intervalo === "number" ? intervalo : 1,
            dias_semana: Array.isArray(diasSemana)
                ? diasSemana.filter((day): day is number => typeof day === "number")
                : undefined,
            fim_recorrencia: typeof fimRecorrencia === "string" ? fimRecorrencia : undefined,
        };
    } catch {
        return undefined;
    }
}

interface TasksTableViewProps {
    tasks: UnifiedTaskView[];
    onTaskClick?: (task: UnifiedTaskView) => void;
    onStatusChange?: (taskId: string, newStatus: 'a_fazer' | 'em_progresso' | 'concluido') => void;
    onArchive?: (taskId: string) => void;
    onDelete?: (taskId: string) => void;
}

export function TasksTableView({
    tasks,
    onTaskClick,
    onStatusChange,
    onArchive,
    onDelete
}: TasksTableViewProps) {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const displayTasks = useMemo(() => {
        let result = statusFilter === 'all'
            ? tasks
            : tasks.filter(t => t.status === statusFilter);

        if (sortField === 'prazo') {
            result = [...result].sort((a, b) => {
                const da = a.prazo ?? '';
                const db = b.prazo ?? '';
                return sortDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
            });
        } else if (sortField === 'prioridade') {
            result = [...result].sort((a, b) => {
                const pa = PRIORIDADE_ORDEM[a.prioridade] ?? 0;
                const pb = PRIORIDADE_ORDEM[b.prioridade] ?? 0;
                return sortDir === 'asc' ? pa - pb : pb - pa;
            });
        }
        return result;
    }, [tasks, statusFilter, sortField, sortDir]);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
        return sortDir === 'asc'
            ? <ArrowUp className="h-3 w-3 ml-1" />
            : <ArrowDown className="h-3 w-3 ml-1" />;
    };

    const STATUS_LABELS: Record<StatusFilter, string> = {
        all: `Todas (${tasks.length})`,
        a_fazer: `A Fazer (${tasks.filter(t => t.status === 'a_fazer').length})`,
        em_progresso: `Em Progresso (${tasks.filter(t => t.status === 'em_progresso').length})`,
        concluido: `Concluído (${tasks.filter(t => t.status === 'concluido').length})`,
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'alta':
                return <Badge variant="destructive">Alta</Badge>;
            case 'media':
                return <Badge className="bg-yellow-500">Média</Badge>;
            case 'baixa':
                return <Badge variant="secondary">Baixa</Badge>;
            default:
                return <Badge variant="outline">{priority}</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'concluido':
                return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
            case 'em_progresso':
                return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Em Progresso</Badge>;
            case 'a_fazer':
                return <Badge variant="outline">A Fazer</Badge>;
            case 'solicitacao':
                return <Badge className="bg-purple-500">Solicitação</Badge>;
            case 'cancelado':
                return <Badge variant="outline" className="text-gray-400 line-through">Cancelado</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const isThisYear = date.getFullYear() === new Date().getFullYear();
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit',
            ...(isThisYear ? {} : { year: '2-digit' }),
        });
    };

    const renderDateCell = (task: UnifiedTaskView) => {
        const tipo = task.tipo_prazo || 'unico';

        if (tipo === 'periodo') {
            const inicio = formatDate(task.prazo);
            const fim = formatDate(task.prazo_fim);
            return (
                <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-1">
                        <CalendarRange className="h-3 w-3 text-muted-foreground" />
                        <span>{inicio}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className={task.atrasado ? 'text-red-500 font-medium' : ''}>{fim}</span>
                    </div>
                </div>
            );
        }

        if (tipo === 'recorrente') {
            const rec = parseRecorrencia(task.recorrencia);
            const freqLabel: Record<string, string> = {
                diaria: 'Diária',
                semanal: 'Semanal',
                mensal: 'Mensal',
                anual: 'Anual',
            };
            return (
                <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-1">
                        <Repeat className="h-3 w-3 text-violet-500" />
                        <span className="text-violet-700">{(rec?.frequencia && freqLabel[rec.frequencia]) || 'Recorrente'}</span>
                    </div>
                    {task.prazo && (
                        <div className="text-muted-foreground pl-4">Desde {formatDate(task.prazo)}</div>
                    )}
                </div>
            );
        }

        // Default: unico
        return (
            <div className="flex items-center gap-1 text-sm">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className={task.atrasado ? 'text-red-500 font-medium' : ''}>
                    {formatDate(task.prazo)}
                </span>
            </div>
        );
    };

    if (tasks.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                Nenhuma tarefa encontrada.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Filtro de status */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {((['all', 'a_fazer', 'em_progresso', 'concluido'] as StatusFilter[])).map(s => (
                    <Button
                        key={s}
                        size="sm"
                        variant={statusFilter === s ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => setStatusFilter(s)}
                    >
                        {STATUS_LABELS[s]}
                    </Button>
                ))}
            </div>

            {displayTasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhuma tarefa com este status.
                </div>
            )}

        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[300px]">Título</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Criador</TableHead>
                    <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('prioridade')}
                    >
                        <span className="flex items-center">Prioridade <SortIcon field="prioridade" /></span>
                    </TableHead>
                    <TableHead>Acesso</TableHead>
                    <TableHead>Monitoramento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Encaminhamento</TableHead>
                    <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort('prazo')}
                    >
                        <span className="flex items-center">Prazo <SortIcon field="prazo" /></span>
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {displayTasks.map((task) => (
                    <TableRow
                        key={task.id}
                        className={`cursor-pointer hover:bg-muted/50 ${task.atrasado ? 'bg-red-50/50' : task.proximo_prazo ? 'bg-amber-50/30' : ''}`}
                        onClick={() => onTaskClick?.(task)}
                    >
                        <TableCell className="font-medium">
                            <div className="flex items-start gap-2">
                                {task.atrasado && (
                                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                )}
                                <div>
                                    <div className="font-medium">{task.titulo}</div>
                                    {task.descricao && (
                                        <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                                            {task.descricao}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: task.projeto_cor || '#888' }}
                                />
                                <span className="text-sm">{task.projeto_nome || 'Projeto Geral'}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {task.atribuido_username || 'N/A'}
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <User className="h-3 w-3" />
                                {task.criador_username || '—'}
                            </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(task.prioridade)}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-1.5">
                                {task.meu_nivel_acesso === 'dono' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><Crown className="w-3 h-3" /> Dono</Badge>}
                                {task.meu_nivel_acesso === 'edicao' && <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><Pencil className="w-3 h-3" /> Edição</Badge>}
                                {task.meu_nivel_acesso === 'leitura' && <Badge className="bg-slate-100 text-slate-600 border-slate-200 gap-1"><Lock className="w-3 h-3" /> Leitura</Badge>}
                            </div>
                        </TableCell>
                        <TableCell>
                            {(task.interessados && task.interessados.length > 0) ? (
                                <div className="flex items-center gap-1 text-slate-500">
                                    <Users2 className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">{task.interessados.length}</span>
                                </div>
                            ) : (
                                <span className="text-slate-300 text-xs">-</span>
                            )}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>
                            {task.demanda_id && task.demanda_status ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="outline" className={`text-[10px] gap-1 ${
                                                task.demanda_status === 'aberta' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                task.demanda_status === 'aceita' ? 'bg-green-50 text-green-700 border-green-200' :
                                                task.demanda_status === 'em_campo' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                task.demanda_status === 'concluida' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                                'bg-slate-50 text-slate-500'
                                            }`}>
                                                <Send className="h-3 w-3" />
                                                {task.demanda_setor_nome || task.demanda_destinatario_id || 'Encaminhado'}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px]">
                                            Demanda {task.demanda_status === 'aberta' ? 'aberta' :
                                                task.demanda_status === 'aceita' ? 'aceita' :
                                                task.demanda_status === 'em_campo' ? 'em campo' :
                                                task.demanda_status === 'concluida' ? 'concluída' : task.demanda_status}
                                            {task.demanda_setor_nome ? ` para ${task.demanda_setor_nome}` : ''}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <span className="text-slate-300 text-xs">—</span>
                            )}
                        </TableCell>
                        <TableCell>
                            {renderDateCell(task)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onStatusChange?.(task.id, 'a_fazer')}>
                                        <Clock className="h-4 w-4 mr-2" /> A Fazer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusChange?.(task.id, 'em_progresso')}>
                                        <Clock className="h-4 w-4 mr-2" /> Em Progresso
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onStatusChange?.(task.id, 'concluido')}>
                                        <CheckCircle2 className="h-4 w-4 mr-2" /> Concluído
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => onArchive?.(task.id)}>
                                        <Archive className="h-4 w-4 mr-2" /> Arquivar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => onDelete?.(task.id)}
                                        className="text-red-500"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
        </div>
    );
}
