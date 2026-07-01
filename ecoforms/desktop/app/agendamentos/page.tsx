"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, List, Plus, Loader2, UserCheck, RefreshCw } from "lucide-react";
import { useServiceSlots, useServiceTypes, useBookingTasks, useAgendamentoMutations } from "@/src/interface/hooks/catalog/service";
import { BookingWizardContent } from "@/components/BookingWizardContent";
import { AgendamentoRow } from "@/components/agendamentos/AgendamentoRow";
import type { ServiceSlot } from "@/src/domain/service/ServiceSlot";
import type { ServiceType } from "@/src/domain/service/ServiceType";
import { toast } from "sonner";

type Visao = "lista" | "calendario";

// ── helpers ──────────────────────────────────────────────────────

function parseDate(iso: string): Date {
    return new Date(iso.slice(0, 10) + "T00:00:00");
}

function formatDate(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
}

function urgenciaLabel(dataInicio: string): { label: string; variant: "default" | "destructive" | "outline" | "secondary" } | null {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const data = parseDate(dataInicio);
    const diff = Math.floor((data.getTime() - hoje.getTime()) / 86_400_000);

    if (diff < 0) return null; // passado
    if (diff === 0) return { label: "Hoje", variant: "destructive" };
    if (diff === 1) return { label: "Amanhã", variant: "default" };
    if (diff <= 7) return { label: `Em ${diff} dias`, variant: "outline" };
    return null;
}

function pctVagas(ocupadas: number, total: number | null | undefined): number {
    if (!total) return 0;
    return Math.min(1, ocupadas / total);
}

function corVagas(pct: number): string {
    if (pct >= 1) return "bg-muted-foreground";
    if (pct >= 0.85) return "bg-red-500";
    if (pct >= 0.6) return "bg-yellow-500";
    return "bg-green-500";
}

// ── CapacidadeBar ─────────────────────────────────────────────────

function CapacidadeBar({ slot }: { slot: ServiceSlot }) {
    if (!slot.capacidade) return null;
    const pct = pctVagas(slot.vagasOcupadas, slot.capacidade);
    const livres = slot.capacidade - slot.vagasOcupadas;
    return (
        <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                <div
                    className={`h-full rounded-full transition-all ${corVagas(pct)}`}
                    style={{ width: `${Math.min(100, pct * 100)}%` }}
                />
            </div>
            <span className="text-xs text-muted-foreground">
                {pct >= 1 ? "Lotado" : `${livres} vaga${livres !== 1 ? "s" : ""}`}
            </span>
        </div>
    );
}

// ── SlotCard (lista) ──────────────────────────────────────────────

interface SlotCardProps {
    slot: ServiceSlot;
    type: ServiceType | undefined;
    onClick: () => void;
}

function SlotCard({ slot, type, onClick }: SlotCardProps) {
    const urgencia = urgenciaLabel(slot.dataInicio);
    const lotado = !!slot.capacidade && slot.vagasOcupadas >= slot.capacidade;

    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-lg border p-3 space-y-1.5 transition-colors hover:bg-muted/50 ${lotado ? "opacity-60" : ""}`}
        >
            <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-sm leading-tight">{slot.titulo}</span>
                <div className="flex gap-1 shrink-0">
                    {urgencia && <Badge variant={urgencia.variant} className="text-xs">{urgencia.label}</Badge>}
                    {lotado && <Badge variant="secondary" className="text-xs">Lotado</Badge>}
                </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDate(slot.dataInicio)}
                {slot.dataFim !== slot.dataInicio && ` → ${formatDate(slot.dataFim)}`}
            </div>
            <CapacidadeBar slot={slot} />
        </button>
    );
}

// ── Vista Lista ───────────────────────────────────────────────────

interface VistaListaProps {
    slots: ServiceSlot[];
    typeMap: Map<string, ServiceType>;
    onSlotClick: (slot: ServiceSlot) => void;
}

function VistaLista({ slots, typeMap, onSlotClick }: VistaListaProps) {
    const sorted = useMemo(() => [...slots].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)), [slots]);

    const byType = useMemo(() => {
        const map: Record<string, ServiceSlot[]> = {};
        for (const s of sorted) {
            if (!map[s.serviceTypeId]) map[s.serviceTypeId] = [];
            map[s.serviceTypeId].push(s);
        }
        return map;
    }, [sorted]);

    if (sorted.length === 0) {
        return <p className="text-muted-foreground text-center py-12">Nenhum slot publicado no momento.</p>;
    }

    return (
        <div className="space-y-6">
            {Object.entries(byType).map(([typeId, typeSlots]) => {
                const type = typeMap.get(typeId);
                return (
                    <div key={typeId} className="space-y-2">
                        <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                            <span>{type?.icone ?? "🔧"}</span>
                            {type?.nome ?? "Tipo desconhecido"}
                        </h2>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {typeSlots.map(slot => (
                                <SlotCard key={slot.id} slot={slot} type={type} onClick={() => onSlotClick(slot)} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Vista Calendário ──────────────────────────────────────────────

interface VistaCalendarioProps {
    slots: ServiceSlot[];
    typeMap: Map<string, ServiceType>;
    onSlotClick: (slot: ServiceSlot) => void;
}

function VistaCalendario({ slots, typeMap, onSlotClick }: VistaCalendarioProps) {
    const hoje = new Date();
    const [ano, setAno] = useState(hoje.getFullYear());
    const [mes, setMes] = useState(hoje.getMonth()); // 0-based

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const inicioDaSemana = primeiroDia.getDay(); // 0=dom

    const slotsByDay = useMemo(() => {
        const map: Record<number, ServiceSlot[]> = {};
        for (const slot of slots) {
            const d = parseDate(slot.dataInicio);
            if (d.getFullYear() === ano && d.getMonth() === mes) {
                const dia = d.getDate();
                if (!map[dia]) map[dia] = [];
                map[dia].push(slot);
            }
        }
        return map;
    }, [slots, ano, mes]);

    const nomeMes = primeiroDia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const prevMes = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
    const nextMes = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

    const cells: (number | null)[] = [
        ...Array(inicioDaSemana).fill(null),
        ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={prevMes}>‹</Button>
                <span className="font-medium capitalize">{nomeMes}</span>
                <Button variant="ghost" size="sm" onClick={nextMes}>›</Button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden text-center text-xs font-medium">
                {diasSemana.map(d => (
                    <div key={d} className="bg-muted py-1.5 text-muted-foreground">{d}</div>
                ))}
                {cells.map((dia, i) => {
                    const slotsNoDia = dia ? (slotsByDay[dia] ?? []) : [];
                    const isHoje = dia && new Date(ano, mes, dia).toDateString() === hoje.toDateString();
                    return (
                        <div
                            key={i}
                            className={`bg-background min-h-[64px] p-1 ${!dia ? "opacity-0" : ""} ${isHoje ? "ring-1 ring-inset ring-primary" : ""}`}
                        >
                            {dia && (
                                <>
                                    <span className={`text-xs ${isHoje ? "font-bold text-primary" : "text-muted-foreground"}`}>{dia}</span>
                                    <div className="mt-0.5 space-y-0.5">
                                        {slotsNoDia.slice(0, 3).map(slot => {
                                            const type = typeMap.get(slot.serviceTypeId);
                                            const cor = type?.cor ?? "#6366f1";
                                            return (
                                                <button
                                                    key={slot.id}
                                                    onClick={() => onSlotClick(slot)}
                                                    className="w-full text-left truncate rounded px-1 py-0.5 text-[10px] text-white leading-tight"
                                                    style={{ backgroundColor: cor }}
                                                    title={slot.titulo}
                                                >
                                                    {slot.titulo}
                                                </button>
                                            );
                                        })}
                                        {slotsNoDia.length > 3 && (
                                            <span className="text-[10px] text-muted-foreground">+{slotsNoDia.length - 3}</span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── SlotDetailSheet ───────────────────────────────────────────────

type SheetModo = "detalhes" | "wizard";

interface SlotDetailSheetProps {
    slot: ServiceSlot | null;
    type: ServiceType | undefined;
    open: boolean;
    onClose: () => void;
    onSlotChanged: () => void;
}

function SlotDetailSheet({ slot, type, open, onClose, onSlotChanged }: SlotDetailSheetProps) {
    const { tasks, loading: tasksLoading, error: tasksError, hasMore, loadMore, reload: reloadTasks } = useBookingTasks(slot?.id ?? null);
    const { cancelarAgendamento, findLinkWhatsApp } = useAgendamentoMutations();
    const [modo, setModo] = useState<SheetModo>("detalhes");

    useEffect(() => {
        if (open) setModo("detalhes");
    }, [open, slot?.id]);

    const handleCancelar = useCallback(async (agendamentoId: string) => {
        await cancelarAgendamento(agendamentoId);
        await reloadTasks();
        onSlotChanged();
    }, [cancelarAgendamento, reloadTasks, onSlotChanged]);

    const handleReenviarWhatsapp = useCallback((agendamentoId: string) => {
        return findLinkWhatsApp(agendamentoId);
    }, [findLinkWhatsApp]);

    const handleWizardCompleted = useCallback(() => {
        setModo("detalhes");
        reloadTasks();
        onSlotChanged();
    }, [reloadTasks, onSlotChanged]);

    if (!slot) return null;

    const urgencia = urgenciaLabel(slot.dataInicio);
    const pct = pctVagas(slot.vagasOcupadas, slot.capacidade);
    const livres = slot.capacidade ? slot.capacidade - slot.vagasOcupadas : null;

    return (
        <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
            <SheetContent className={`w-full overflow-y-auto ${modo === "wizard" ? "sm:max-w-2xl" : "sm:max-w-md"}`}>
                <SheetHeader>
                    {modo === "wizard" ? (
                        <div className="space-y-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 w-fit" onClick={() => setModo("detalhes")}>
                                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                                Voltar
                            </Button>
                            <SheetTitle className="text-sm font-medium">Registrar agendamento</SheetTitle>
                        </div>
                    ) : (
                        <SheetTitle className="flex items-center gap-2">
                            <span>{type?.icone ?? "🔧"}</span>
                            <span>{type?.nome}</span>
                        </SheetTitle>
                    )}
                </SheetHeader>

                {modo === "wizard" ? (
                    <BookingWizardContent
                        slotId={slot.id}
                        onCancel={() => setModo("detalhes")}
                        onCompleted={handleWizardCompleted}
                    />
                ) : (
                    <div className="mt-4 space-y-4">
                        {/* Slot info */}
                        <div className="space-y-2">
                            <p className="font-medium">{slot.titulo}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(slot.dataInicio)}
                                {slot.dataFim !== slot.dataInicio && ` → ${formatDate(slot.dataFim)}`}
                            </div>
                            {slot.local && (
                                <p className="text-sm text-muted-foreground">{slot.local}</p>
                            )}
                            {urgencia && <Badge variant={urgencia.variant}>{urgencia.label}</Badge>}
                        </div>

                        {/* Capacidade */}
                        {slot.capacidade && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Vagas ocupadas</span>
                                    <span>{slot.vagasOcupadas} / {slot.capacidade}</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${corVagas(pct)}`}
                                        style={{ width: `${Math.min(100, pct * 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {pct >= 1 ? "Slot lotado" : `${livres} vaga${livres !== 1 ? "s" : ""} disponív${livres !== 1 ? "eis" : "el"}`}
                                </p>
                            </div>
                        )}

                        <Separator />

                        {/* Ações */}
                        <Button
                            className="w-full"
                            disabled={!!slot.capacidade && slot.vagasOcupadas >= slot.capacidade}
                            onClick={() => setModo("wizard")}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Registrar agendamento
                        </Button>

                        <Separator />

                        {/* Lista de bookings */}
                        <div className="space-y-2">
                            <p className="text-sm font-medium flex items-center gap-2">
                                <UserCheck className="h-4 w-4" />
                                Agendamentos ({tasks.length})
                            </p>

                            {tasksLoading && (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            )}

                            {tasksError && !tasksLoading && (
                                <div className="text-center py-4 space-y-2">
                                    <p className="text-sm text-red-500">Erro ao carregar agendamentos: {tasksError}</p>
                                    <Button variant="outline" size="sm" onClick={() => reloadTasks()}>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                        Tentar novamente
                                    </Button>
                                </div>
                            )}

                            {!tasksLoading && !tasksError && tasks.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Nenhum agendamento registrado.
                                </p>
                            )}

                            {!tasksLoading && !tasksError && tasks.map(row => (
                                <AgendamentoRow
                                    key={row.id}
                                    row={row}
                                    onCancelar={handleCancelar}
                                    onReenviarWhatsapp={handleReenviarWhatsapp}
                                />
                            ))}
                            {hasMore && (
                                <Button variant="outline" size="sm" className="w-full" onClick={loadMore}>
                                    Carregar mais
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

// ── Página principal ──────────────────────────────────────────────

export default function AgendamentosPage() {
    const { slots, loading, reload } = useServiceSlots({ status: "publicado" });
    const { types } = useServiceTypes();
    const [visao, setVisao] = useState<Visao>("lista");
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const typeMap = useMemo(() => new Map(types.map(t => [t.id, t])), [types]);
    const selectedSlot = useMemo(
        () => (selectedSlotId ? slots.find(s => s.id === selectedSlotId) ?? null : null),
        [slots, selectedSlotId]
    );

    const handleSlotClick = useCallback((slot: ServiceSlot) => {
        setSelectedSlotId(slot.id);
        setSheetOpen(true);
    }, []);

    const handleSheetClose = useCallback(() => {
        setSheetOpen(false);
    }, []);

    const handleSlotChanged = useCallback(() => {
        reload();
    }, [reload]);

    useEffect(() => {
        if (sheetOpen && !loading && selectedSlotId && !selectedSlot) {
            setSheetOpen(false);
            toast.error("Este slot não está mais disponível.");
        }
    }, [sheetOpen, loading, selectedSlotId, selectedSlot]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Agendamentos</h1>
                    <p className="text-muted-foreground text-sm">
                        Selecione um slot para ver detalhes ou registrar um atendimento.
                    </p>
                </div>
                <div className="flex items-center gap-1 border rounded-md p-0.5">
                    <Button
                        variant={visao === "lista" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setVisao("lista")}
                    >
                        <List className="h-3.5 w-3.5 mr-1" />
                        Lista
                    </Button>
                    <Button
                        variant={visao === "calendario" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setVisao("calendario")}
                    >
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        Calendário
                    </Button>
                </div>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            )}

            {!loading && visao === "lista" && (
                <VistaLista slots={slots} typeMap={typeMap} onSlotClick={handleSlotClick} />
            )}

            {!loading && visao === "calendario" && (
                <VistaCalendario slots={slots} typeMap={typeMap} onSlotClick={handleSlotClick} />
            )}

            <SlotDetailSheet
                slot={selectedSlot}
                type={selectedSlot ? typeMap.get(selectedSlot.serviceTypeId) : undefined}
                open={sheetOpen}
                onClose={handleSheetClose}
                onSlotChanged={handleSlotChanged}
            />
        </div>
    );
}
