"use client";

import React, { useState, useRef, useEffect } from "react";
import { TaskHistoryEvent, TaskHistoryEventTipo } from "@/types";
import { useTaskComments } from "@/src/interface/hooks/catalog/kanban";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    PlusCircle,
    Pencil,
    ArrowRightCircle,
    User,
    MessageSquare,
    Paperclip,
    ClipboardList,
    GitBranch,
    Archive,
    History,
    Loader2,
    Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── icon + colour map ───────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
    TaskHistoryEventTipo,
    { icon: React.ReactNode; badgeClass: string; dotClass: string; label: string }
> = {
    criacao: {
        icon: <PlusCircle className="w-3.5 h-3.5" />,
        badgeClass: "bg-green-100 text-green-700 border-green-200",
        dotClass: "bg-green-500",
        label: "Criação",
    },
    edicao: {
        icon: <Pencil className="w-3.5 h-3.5" />,
        badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
        dotClass: "bg-blue-500",
        label: "Edição",
    },
    status: {
        icon: <ArrowRightCircle className="w-3.5 h-3.5" />,
        badgeClass: "bg-violet-100 text-violet-700 border-violet-200",
        dotClass: "bg-violet-500",
        label: "Status",
    },
    atribuicao: {
        icon: <User className="w-3.5 h-3.5" />,
        badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
        dotClass: "bg-amber-500",
        label: "Atribuição",
    },
    comentario: {
        icon: <MessageSquare className="w-3.5 h-3.5" />,
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
        dotClass: "bg-slate-500",
        label: "Comentário",
    },
    anexo: {
        icon: <Paperclip className="w-3.5 h-3.5" />,
        badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
        dotClass: "bg-orange-500",
        label: "Anexo",
    },
    formulario: {
        icon: <ClipboardList className="w-3.5 h-3.5" />,
        badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
        label: "Formulário",
    },
    patch: {
        icon: <GitBranch className="w-3.5 h-3.5" />,
        badgeClass: "bg-cyan-100 text-cyan-700 border-cyan-200",
        dotClass: "bg-cyan-500",
        label: "Patch",
    },
    arquivamento: {
        icon: <Archive className="w-3.5 h-3.5" />,
        badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
        dotClass: "bg-gray-400",
        label: "Arquivamento",
    },
};

function getConfig(tipo: string) {
    return (
        EVENT_CONFIG[tipo as TaskHistoryEventTipo] ?? {
            icon: <History className="w-3.5 h-3.5" />,
            badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
            dotClass: "bg-slate-400",
            label: tipo,
        }
    );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function renderMetadata(metadata: Record<string, any> | null, tipo: string): React.ReactNode {
    if (!metadata) return null;

    if (tipo === "status" && metadata.de && metadata.para) {
        return (
            <span className="text-xs text-slate-500">
                <span className="font-medium">{metadata.de}</span>
                <ArrowRightCircle className="inline w-3 h-3 mx-1 text-slate-400" />
                <span className="font-semibold text-slate-700">{metadata.para}</span>
            </span>
        );
    }

    if (tipo === "atribuicao" && metadata.para) {
        return (
            <span className="text-xs text-slate-500">
                Atribuído para <span className="font-semibold">{metadata.para}</span>
            </span>
        );
    }

    if (tipo === "edicao" && metadata.campos) {
        const campos: string[] = Array.isArray(metadata.campos)
            ? metadata.campos
            : [String(metadata.campos)];
        return (
            <span className="text-xs text-slate-500">
                Campos: {campos.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] py-0 mr-0.5">{c}</Badge>
                ))}
            </span>
        );
    }

    return null;
}

// ─── component ───────────────────────────────────────────────────────────────

interface TaskHistoryTabProps {
    taskId: string;
    events: TaskHistoryEvent[];
    loading: boolean;
    onCommentAdded: () => void;
}

export function TaskHistoryTab({
    taskId,
    events,
    loading,
    onCommentAdded,
}: TaskHistoryTabProps) {
    const { addComment, loading: submitting } = useTaskComments();
    const [text, setText] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // auto-focus textarea when tab becomes visible
    useEffect(() => {
        if (!loading && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [loading]);

    const handleSubmit = async () => {
        if (!text.trim() || submitting) return;
        try {
            await addComment(taskId, text.trim());
            setText("");
            onCommentAdded();
        } catch {
            // error is surfaced from hook — could add toast here if needed
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        }
    };

    // ─── loading skeleton ──────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex-1 flex flex-col gap-3 px-4 pt-3 pb-4 animate-pulse">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-3 items-start">
                        <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-slate-200 rounded w-1/3" />
                            <div className="h-3 bg-slate-100 rounded w-2/3" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Timeline */}
            <ScrollArea className="flex-1 px-4 pt-3">
                {events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                        <History className="w-8 h-8 text-slate-300" />
                        <p className="text-sm text-slate-500 font-medium">
                            Nenhum evento registrado ainda.
                        </p>
                        <p className="text-xs text-slate-400">
                            Ações como criação, mudanças de status e comentários aparecerão aqui.
                        </p>
                    </div>
                ) : (
                    <ol className="relative border-l border-slate-100 ml-3 space-y-0">
                        {events.map((event, idx) => {
                            const cfg = getConfig(event.tipo);
                            const isLast = idx === events.length - 1;
                            return (
                                <li
                                    key={event.id}
                                    className={`relative pl-5 pb-4 ${isLast ? "" : ""}`}
                                >
                                    {/* dot */}
                                    <span
                                        className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full flex items-center justify-center ${cfg.dotClass} text-white shadow-sm`}
                                        aria-hidden
                                    >
                                        {React.cloneElement(cfg.icon as React.ReactElement<{ className?: string }>, {
                                            className: "w-2.5 h-2.5",
                                        })}
                                    </span>

                                    <div className="flex flex-wrap items-start gap-1.5">
                                        {/* badge */}
                                        <Badge
                                            variant="outline"
                                            className={`gap-1 text-[10px] py-0 leading-4 ${cfg.badgeClass}`}
                                        >
                                            {cfg.icon}
                                            {cfg.label}
                                        </Badge>

                                        {/* timestamp */}
                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                            {formatDate(event.created_at)}
                                        </span>

                                        {/* user */}
                                        {event.usuario_nome && (
                                            <span className="text-[10px] text-slate-400 mt-0.5">
                                                · {event.usuario_nome}
                                            </span>
                                        )}
                                    </div>

                                    {/* description */}
                                    {event.descricao && (
                                        <p className="mt-0.5 text-xs text-slate-700 break-words">
                                            {event.descricao}
                                        </p>
                                    )}

                                    {/* metadata detail */}
                                    {event.metadata && (
                                        <div className="mt-0.5">
                                            {renderMetadata(event.metadata, event.tipo)}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                )}
            </ScrollArea>

            {/* Comment input */}
            <div className="border-t px-4 py-3 shrink-0">
                <p className="text-[10px] text-slate-400 mb-1.5">
                    Comentário · <kbd className="font-mono">Ctrl+Enter</kbd> para enviar
                </p>
                <div className="flex gap-2 items-end">
                    <Textarea
                        ref={textareaRef}
                        placeholder="Adicionar comentário..."
                        className="resize-none text-sm min-h-[60px] max-h-[120px]"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitting}
                    />
                    <Button
                        size="sm"
                        className="h-8 gap-1 shrink-0"
                        onClick={handleSubmit}
                        disabled={!text.trim() || submitting}
                    >
                        {submitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Send className="w-3.5 h-3.5" />
                        )}
                        Comentar
                    </Button>
                </div>
            </div>
        </div>
    );
}
