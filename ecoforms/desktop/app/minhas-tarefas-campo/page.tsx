"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, CheckCircle2, XCircle, AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getContainerAsync } from "@/src/interface/hooks/utils/useContainer";
import { uuidv7 } from "ecoforms-core";
import { toast } from "sonner";
import type { TarefaCampoRow } from "@/src/domain/kanban/KanbanRepository";

type TarefaCampo = TarefaCampoRow;

interface GPSCoords {
    lat: number;
    lng: number;
}

// ── helpers ──────────────────────────────────────────────────────

function extractCoordsFromCarga(cargaRaw: string | null): GPSCoords | null {
    if (!cargaRaw) return null;
    try {
        const obj = JSON.parse(cargaRaw) as Record<string, unknown>;
        // Procura recursivamente qualquer campo com { lat, lng } ou { latitude, longitude }
        for (const val of Object.values(obj)) {
            if (val && typeof val === "object") {
                const v = val as Record<string, unknown>;
                const lat = Number(v.lat ?? v.latitude);
                const lng = Number(v.lng ?? v.longitude);
                if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                    return { lat, lng };
                }
            }
        }
    } catch { /* carga malformed */ }
    return null;
}

function formatPrazo(iso: string | null): string {
    if (!iso) return "";
    const [y, m, d] = iso.slice(0, 10).split("-");
    const time = iso.length > 10 ? iso.slice(11, 16) : "";
    return `${d}/${m}/${y}${time ? " " + time : ""}`;
}

// ── Componente de item ────────────────────────────────────────────

interface TarefaItemProps {
    tarefa: TarefaCampo;
    onRealizado: (id: string) => void;
    onNaoRealizado: (id: string) => void;
    onIntercorrencia: (tarefa: TarefaCampo) => void;
    loading: boolean;
}

function TarefaItem({ tarefa, onRealizado, onNaoRealizado, onIntercorrencia, loading }: TarefaItemProps) {
    const coords = extractCoordsFromCarga(tarefa.carga);
    const mapsUrl = coords
        ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
        : null;

    let cargaObj: Record<string, unknown> = {};
    try { if (tarefa.carga) cargaObj = JSON.parse(tarefa.carga) as Record<string, unknown>; } catch { /* ok */ }
    const clienteNome = (cargaObj.cliente_nome ?? cargaObj.nome ?? "") as string;
    const bairro = (cargaObj.bairro ?? "") as string;

    return (
        <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="font-medium leading-tight">{tarefa.titulo}</p>
                    {clienteNome && (
                        <p className="text-sm text-muted-foreground">{clienteNome}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        {bairro && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {bairro}
                            </span>
                        )}
                        {tarefa.prazo && (
                            <span className="text-xs text-muted-foreground">
                                {formatPrazo(tarefa.prazo)}
                            </span>
                        )}
                        {mapsUrl && (
                            <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                                <MapPin className="h-3 w-3" />
                                Abrir no mapa
                                <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                        )}
                    </div>
                </div>
                <Badge
                    variant={tarefa.status === "em_progresso" ? "default" : "outline"}
                    className="text-xs shrink-0"
                >
                    {tarefa.status.replace("_", " ")}
                </Badge>
            </div>

            <div className="flex gap-2 flex-wrap">
                <Button
                    size="sm"
                    variant="default"
                    className="flex-1 min-w-[100px]"
                    disabled={loading}
                    onClick={() => onRealizado(tarefa.id)}
                >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Realizado
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 min-w-[100px]"
                    disabled={loading}
                    onClick={() => onIntercorrencia(tarefa)}
                >
                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                    Intercorrência
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 min-w-[100px] text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={loading}
                    onClick={() => onNaoRealizado(tarefa.id)}
                >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Não realizado
                </Button>
            </div>
        </div>
    );
}

// ── Página ────────────────────────────────────────────────────────

export default function MinhasTarefasCampoPage() {
    const { user } = useAuth();
    const [tarefas, setTarefas] = useState<TarefaCampo[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [intercorrenciaTarefa, setIntercorrenciaTarefa] = useState<TarefaCampo | null>(null);
    const [intercorrenciaNota, setIntercorrenciaNota] = useState("");

    const load = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.kanbanRepository.findBookingTasksForUser(user.id);
            setTarefas(rows);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    const updateStatus = useCallback(async (tarefaId: string, novoStatus: string) => {
        setActionLoading(true);
        try {
            const c = await getContainerAsync();
            await c.kanbanRepository.updateTask(tarefaId, { status: novoStatus });
            await c.kanbanRepository.insertTaskEvent({
                id: uuidv7(),
                tarefaId,
                tipo: "status",
                descricao: `Status: ${novoStatus} (campo)`,
                usuarioId: user?.id ?? null,
            });
            setTarefas(prev => prev.filter(t => t.id !== tarefaId));
            toast.success(novoStatus === "concluido" ? "Tarefa concluída!" : "Tarefa cancelada.");
        } catch (e) {
            toast.error("Erro ao atualizar tarefa.");
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    }, [user]);

    const handleIntercorrenciaSubmit = useCallback(async () => {
        if (!intercorrenciaTarefa) return;
        setActionLoading(true);
        try {
            const c = await getContainerAsync();
            await c.kanbanRepository.insertTaskEvent({
                id: uuidv7(),
                tarefaId: intercorrenciaTarefa.id,
                tipo: "intercorrencia",
                descricao: intercorrenciaNota.trim() || "Intercorrência registrada",
                usuarioId: user?.id ?? null,
            });
            // Mantém a tarefa ativa mas sinaliza via evento
            toast.success("Intercorrência registrada.");
            setIntercorrenciaTarefa(null);
            setIntercorrenciaNota("");
        } catch (e) {
            toast.error("Erro ao registrar intercorrência.");
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    }, [intercorrenciaTarefa, intercorrenciaNota, user]);

    const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Minhas tarefas de campo</h1>
                    <p className="text-sm text-muted-foreground capitalize">{hoje}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {!loading && tarefas.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">Nenhuma tarefa de campo para hoje.</p>
                    <p className="text-sm">Volte mais tarde ou verifique o Kanban.</p>
                </div>
            )}

            {!loading && tarefas.length > 0 && (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        {tarefas.length} tarefa{tarefas.length !== 1 ? "s" : ""} pendente{tarefas.length !== 1 ? "s" : ""}
                    </p>
                    {tarefas.map(t => (
                        <TarefaItem
                            key={t.id}
                            tarefa={t}
                            onRealizado={id => updateStatus(id, "concluido")}
                            onNaoRealizado={id => updateStatus(id, "cancelado")}
                            onIntercorrencia={tarefa => { setIntercorrenciaTarefa(tarefa); setIntercorrenciaNota(""); }}
                            loading={actionLoading}
                        />
                    ))}
                </div>
            )}

            {/* Dialog de intercorrência */}
            <Dialog
                open={!!intercorrenciaTarefa}
                onOpenChange={v => { if (!v) { setIntercorrenciaTarefa(null); setIntercorrenciaNota(""); } }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Registrar intercorrência
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">
                            Tarefa: <strong>{intercorrenciaTarefa?.titulo}</strong>
                        </p>
                        <div className="space-y-1.5">
                            <Label>Descrição da intercorrência</Label>
                            <Textarea
                                placeholder="Descreva o que ocorreu..."
                                value={intercorrenciaNota}
                                onChange={e => setIntercorrenciaNota(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => { setIntercorrenciaTarefa(null); setIntercorrenciaNota(""); }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleIntercorrenciaSubmit}
                            disabled={actionLoading || !intercorrenciaNota.trim()}
                        >
                            {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Registrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
