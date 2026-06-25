import { UnifiedTaskView } from "@/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CalendarDays, CalendarRange, Paperclip, MessageSquare, Pencil, QrCode, Repeat, ClipboardList, Users2, ShieldCheck, Lock, Crown, Archive, Trash2, RotateCcw, AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Calcula se uma tarefa está atrasada em tempo real (client-side), sem depender de sync. */
function useTaskDeadlineStatus(task: UnifiedTaskView) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (task.status === 'concluido' || task.status === 'cancelado') {
        return { isOverdue: false, isDueSoon: false };
    }

    const deadlineDate = task.tipo_prazo === 'periodo' ? task.prazo_fim : task.prazo;
    if (!deadlineDate) return { isOverdue: false, isDueSoon: false };

    const deadline = deadlineDate.split('T')[0];
    const isOverdue = deadline < today;
    const isDueSoon = !isOverdue && deadline <= threeDaysLater;

    return { isOverdue, isDueSoon };
}

interface KanbanTaskCardProps {
    task: UnifiedTaskView;
    onClick?: () => void;
    onEdit?: () => void;
    onViewRecords?: () => void;
    onArchive?: () => void;
    onDelete?: () => void;
}

export function KanbanTaskCard({ task, onClick, onEdit, onViewRecords, onArchive, onDelete }: KanbanTaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: task.id, data: { task } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Calcula atraso em tempo real no client, sem depender de sync
    const { isOverdue, isDueSoon } = useTaskDeadlineStatus(task);

    const deadlineBorder = isOverdue
        ? "border-l-4 border-l-red-500"
        : isDueSoon
            ? "border-l-4 border-l-amber-500"
            : "";

    const priorityColor = {
        alta: "bg-red-100 text-red-800 hover:bg-red-200",
        media: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
        baixa: "bg-green-100 text-green-800 hover:bg-green-200",
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
            <Card className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative overflow-hidden ${deadlineBorder}`} onClick={onClick}>
                <CardHeader className="p-3 pb-0 space-y-0">
                    {/* Overdue banner — calculado em tempo real no client */}
                    {isOverdue && (
                        <div className="flex items-center gap-1 mb-1 text-red-600">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Atrasado</span>
                        </div>
                    )}
                    {/* Project badge — shown when task belongs to a named project */}
                    {task.projeto_nome && task.projeto_nome !== 'Projeto Geral' && (
                        <div className="flex items-center gap-1 mb-1">
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: task.projeto_cor || '#888' }}
                            />
                            <span className="text-[10px] text-slate-400 truncate max-w-40">{task.projeto_nome}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-1.5">
                            {task.status === 'solicitacao' ? (
                                <Badge className="text-xs px-1.5 py-0.5 bg-amber-500 text-white hover:bg-amber-600 border-none">
                                    Solicitação
                                </Badge>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Badge variant="secondary" className={`text-xs px-1.5 py-0.5 ${priorityColor[task.prioridade] || ""}`}>
                                        {task.prioridade}
                                    </Badge>
                                    
                                    {/* Access Level Badge */}
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center">
                                                    {task.meu_nivel_acesso === 'dono' && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-50" />}
                                                    {task.meu_nivel_acesso === 'edicao' && <Pencil className="w-3 h-3 text-blue-500" />}
                                                    {task.meu_nivel_acesso === 'leitura' && <Lock className="w-3 h-3 text-slate-400" />}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-[10px]">
                                                    {task.meu_nivel_acesso === 'dono' ? 'Você é o dono desta tarefa' : 
                                                     task.meu_nivel_acesso === 'edicao' ? 'Você pode editar esta tarefa' : 
                                                     'Você tem acesso de apenas leitura'}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            {task.form_nome && (
                                <Badge variant="outline" className={`text-[10px] truncate max-w-[80px] border-slate-200 ${task.status === 'solicitacao' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'}`}>
                                    {task.form_nome}
                                </Badge>
                            )}
                            
                            {task.form_registry_id && (
                                <div className="flex items-center">
                                    {task.num_registros > 0 && (
                                        <Badge 
                                            variant="secondary" 
                                            className="text-[9px] mr-1 px-1 py-0 min-w-[14px] h-[14px] flex items-center justify-center bg-emerald-500 text-white border-none rounded-full"
                                        >
                                            {task.num_registros}
                                        </Badge>
                                    )}
                                </div>
                            )}

                            <TooltipProvider>
                                <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 p-0 cursor-pointer text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top"><p className="text-[10px]">Editar</p></TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 p-0 cursor-pointer text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
                                                    onClick={(e) => { e.stopPropagation(); onViewRecords?.(); }}
                                                >
                                                    <ClipboardList className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top"><p className="text-[10px]">Registros &amp; Histórico</p></TooltipContent>
                                        </Tooltip>

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 p-0 cursor-pointer text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                                                onClick={(e) => { e.stopPropagation(); onArchive?.(); }}
                                            >
                                                {task.arquivado ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top"><p className="text-[10px]">{task.arquivado ? 'Restaurar' : 'Arquivar'}</p></TooltipContent>
                                    </Tooltip>

                                    {task.meu_nivel_acesso === 'dono' && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 p-0 cursor-pointer text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                    onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top"><p className="text-[10px]">Excluir</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                            </TooltipProvider>
                        </div>
                    </div>
                    <CardTitle className="text-sm font-semibold mt-2 leading-tight text-slate-900">
                        {task.titulo}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                    {task.descricao && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 italic">
                            {task.descricao}
                        </p>
                    )}

                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                {task.prazo && (() => {
                                    const tipo = task.payload?.dateConfig?.tipo;
                                    const DateIcon = tipo === 'periodo'
                                        ? CalendarRange
                                        : tipo === 'recorrente'
                                            ? Repeat
                                            : tipo === 'unico'
                                                ? CalendarDays
                                                : Calendar;
                                    const label = tipo === 'periodo'
                                        ? `até ${new Date(task.prazo!).toLocaleDateString()}`
                                        : tipo === 'recorrente'
                                            ? `a partir de ${new Date(task.prazo!).toLocaleDateString()}`
                                            : new Date(task.prazo!).toLocaleDateString();
                                    
                                    const dateColor = isOverdue
                                        ? "text-red-500 font-bold"
                                        : isDueSoon
                                            ? "text-amber-600 font-semibold"
                                            : "text-slate-400";

                                    return (
                                        <div className={`flex items-center gap-1 text-[10px] whitespace-nowrap ${dateColor}`}>
                                            <DateIcon className="w-3 h-3" />
                                            <span>{label}</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {task.atribuido_username && (
                                <div className="flex items-center gap-1 min-w-0">
                                    <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600 uppercase flex-shrink-0">
                                        {task.atribuido_username.substring(0, 2)}
                                    </div>
                                    <span className="text-[10px] text-slate-500 truncate max-w-[60px]">
                                        {task.atribuido_username.split(' ')[0]}
                                    </span>
                                </div>
                            )}
                            {task.criador_username && task.criador_username !== task.atribuido_username && (
                                <div className="flex items-center gap-1 min-w-0" title={`Criado por ${task.criador_username}`}>
                                    <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[8px] font-bold text-blue-600 uppercase shrink-0">
                                        {task.criador_username.substring(0, 2)}
                                    </div>
                                    <span className="text-[10px] text-blue-400 truncate max-w-15">
                                        {task.criador_username.split(' ')[0]}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                            {(task.num_comentarios > 0) && (
                                <div className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{task.num_comentarios}</span>
                                </div>
                            )}
                            {(task.num_anexos > 0) && (
                                <div className="flex items-center gap-1">
                                    <Paperclip className="w-3 h-3" />
                                    <span>{task.num_anexos}</span>
                                </div>
                            )}
                            {(task.interessados && task.interessados.length > 0) && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-slate-500 font-medium">
                                                <Users2 className="w-3 h-3" />
                                                <span>{task.interessados.length}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px]">
                                            Monitorada por {task.interessados.length} pessoa(s)
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {task.status === 'solicitacao' && (
                                <div className="flex items-center gap-1 text-amber-600 font-medium animate-pulse">
                                    <MessageSquare className="w-3 h-3" />
                                    <span>Pendente</span>
                                </div>
                            )}
                            {task.demanda_id && task.demanda_status && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className={`flex items-center gap-1 font-medium ${
                                                task.demanda_status === 'aberta' ? 'text-blue-600' :
                                                task.demanda_status === 'aceita' ? 'text-green-600' :
                                                task.demanda_status === 'em_campo' ? 'text-amber-600' :
                                                task.demanda_status === 'concluida' ? 'text-slate-500' : 'text-slate-400'
                                            }`}>
                                                <Send className="w-3 h-3" />
                                                <span>{task.demanda_setor_nome?.split(' ')[0] || 'Enc.'}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[10px]">
                                            Encaminhado{task.demanda_setor_nome ? ` para ${task.demanda_setor_nome}` : ''} ({task.demanda_status})
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {task.suite_id && task.status !== 'solicitacao' && (
                                <div className="flex items-center gap-1 text-emerald-600 font-medium">
                                    <QrCode className="w-3 h-3" />
                                    <span>Registro</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
