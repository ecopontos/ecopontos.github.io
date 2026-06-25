"use client";

import { useState } from "react";
import { MapIcon, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAgendamentoMapData } from "@/src/interface/hooks/queries/useAgendamentoMapData";
import RoteiroMap from "./RoteiroMap";

const STATUS_LABELS: Record<string, string> = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    realizado: "Realizado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
    pendente: "outline",
    confirmado: "default",
    realizado: "secondary",
};

interface Props {
    slotId: string;
    slotTitulo: string;
    open: boolean;
    onClose: () => void;
}

function formatEndereco(p: { endereco: string | null; numero: string | null; bairro: string | null; cidade: string | null }): string {
    return [p.endereco, p.numero, p.bairro, p.cidade].filter(Boolean).join(", ") || "—";
}

export function RoteiroModal({ slotId, slotTitulo, open, onClose }: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const { data: points, loading } = useAgendamentoMapData(open ? slotId : null);

    const semGeo = loading ? 0 : points.length;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-5xl flex flex-col gap-3 p-0" style={{ height: "680px" }}>
                <DialogHeader className="px-6 pt-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <MapIcon className="h-4 w-4" />
                        Roteiro — {slotTitulo}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
                    <div className="flex flex-col gap-1.5 min-h-0 p-4 pt-2 w-[35%] border-r border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Agendamentos com localização{semGeo > 0 ? ` (${semGeo})` : ""}
                        </p>
                        <ScrollArea className="flex-1 rounded-md border">
                            {loading ? (
                                <p className="p-3 text-sm text-muted-foreground">Carregando...</p>
                            ) : points.length === 0 ? (
                                <p className="p-3 text-sm text-muted-foreground">
                                    Nenhum agendamento com localização mapeada.
                                </p>
                            ) : (
                                <div className="p-1 space-y-0.5">
                                    {points.map((p, idx) => (
                                        <button
                                            key={p.id}
                                            className={`grid grid-cols-[2rem_1fr] gap-2 items-start w-full text-left px-2 py-1.5 rounded border transition-colors text-sm ${
                                                selectedId === p.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                                            }`}
                                            onClick={() => setSelectedId(p.id)}
                                        >
                                            <span className="text-xs font-bold text-muted-foreground text-right mt-0.5">{idx + 1}</span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium truncate">{p.clienteNome}</span>
                                                    <Badge variant={STATUS_VARIANTS[p.status] ?? "secondary"} className="text-[10px] px-1 py-0">
                                                        {STATUS_LABELS[p.status] ?? p.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                                    <MapPin className="h-3 w-3 shrink-0" />
                                                    <span className="truncate">{formatEndereco(p)}</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} /> Pendente</span>
                            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#22c55e" }} /> Confirmado</span>
                            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} /> Realizado</span>
                        </div>
                    </div>

                    <div className="flex flex-col w-[65%] min-h-0 p-4 pt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                            Mapa do roteiro
                        </p>
                        <div className="flex-1 rounded-md overflow-hidden border">
                            <RoteiroMap
                                points={points}
                                selectedId={selectedId}
                                onPointClick={setSelectedId}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}