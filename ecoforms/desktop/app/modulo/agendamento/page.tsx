"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, ListTodo, ArrowRight, Clock, Pencil, XCircle, CheckCircle } from "lucide-react";
import { useServiceSlots, useServiceTypes, useBookingTasks, useServiceMutations } from "@/src/interface/hooks/catalog/service";
export default function ModuloAgendamentoPage() {
    const { slots, loading: slotsLoading, reload } = useServiceSlots();
    const { types } = useServiceTypes();
    const { publishSlot, encerrarSlot, cancelSlot, loading: mutating } = useServiceMutations();
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const { tasks, loading: tasksLoading } = useBookingTasks(selectedSlotId);
    const [actionId, setActionId] = useState<string | null>(null);

    const handlePublish = async (slotId: string) => {
        setActionId(slotId);
        try { await publishSlot(slotId); reload?.(); } catch (e) { alert(String(e)); } finally { setActionId(null); }
    };
    const handleEncerrar = async (slotId: string) => {
        if (!confirm("Encerrar este slot?")) return;
        setActionId(slotId);
        try { await encerrarSlot(slotId); reload?.(); } catch (e) { alert(String(e)); } finally { setActionId(null); }
    };
    const handleCancelar = async (slotId: string) => {
        if (!confirm("Cancelar este slot?")) return;
        setActionId(slotId);
        try { await cancelSlot(slotId); reload?.(); } catch (e) { alert(String(e)); } finally { setActionId(null); }
    };

    const typeMap = new Map(types.map(t => [t.id, t]));

    const publicados = slots.filter(s => s.status === 'publicado');
    const rascunhos = slots.filter(s => s.status === 'rascunho');
    const encerrados = slots.filter(s => s.status === 'encerrado' || s.status === 'cancelado');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-primary" />
                        Agendamentos
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gestão de slots de agendamento e bookings de serviços
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/admin/agendamentos/slots/novo">
                        <Button variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Slot
                        </Button>
                    </Link>
                    <Link href="/agendamentos">
                        <Button>
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Portal de Agendamento
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="publicados">
                <TabsList>
                    <TabsTrigger value="publicados">
                        Publicados ({publicados.length})
                    </TabsTrigger>
                    <TabsTrigger value="rascunhos">
                        Rascunhos ({rascunhos.length})
                    </TabsTrigger>
                    <TabsTrigger value="encerrados">
                        Encerrados ({encerrados.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="publicados" className="space-y-4">
                    {slotsLoading ? (
                        <p className="text-muted-foreground">Carregando slots...</p>
                    ) : publicados.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">
                            Nenhum slot publicado. Crie um slot e publique-o para disponibilizar ao público.
                        </p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {publicados.map(slot => {
                                const type = typeMap.get(slot.serviceTypeId);
                                const vagasLivres = slot.capacidade ? slot.capacidade - slot.vagasOcupadas : null;
                                const busy = actionId === slot.id;
                                return (
                                    <Card
                                        key={slot.id}
                                        className={selectedSlotId === slot.id ? "ring-2 ring-primary" : "hover:bg-gray-50"}
                                        onClick={() => setSelectedSlotId(slot.id === selectedSlotId ? null : slot.id)}
                                    >
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                                                <span className="flex items-center gap-2">
                                                    <span className="text-lg">{type?.icone ?? '🔧'}</span>
                                                    {slot.titulo}
                                                </span>
                                                <Badge variant="default">Publicado</Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <p>{type?.nome}</p>
                                                <p className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {slot.dataInicio}
                                                </p>
                                                <p>Vagas: {slot.vagasOcupadas} / {slot.capacidade ?? '∞'}</p>
                                                {vagasLivres !== null && vagasLivres <= 0 && (
                                                    <Badge variant="secondary" className="mt-1">Lotado</Badge>
                                                )}
                                            </div>
                                            <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                                                <Button size="sm" variant="outline" asChild>
                                                    <Link href={`/admin/agendamentos/slots/${slot.id}/editar`}>
                                                        <Pencil className="h-3 w-3 mr-1" />Editar
                                                    </Link>
                                                </Button>
                                                <Button size="sm" variant="outline" disabled={busy || mutating} onClick={() => handleEncerrar(slot.id)}>
                                                    <CheckCircle className="h-3 w-3 mr-1" />{busy ? "..." : "Encerrar"}
                                                </Button>
                                                <Button size="sm" variant="ghost" disabled={busy || mutating} onClick={() => handleCancelar(slot.id)}>
                                                    <XCircle className="h-3 w-3 mr-1" />{busy ? "..." : "Cancelar"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="rascunhos" className="space-y-4">
                    {slotsLoading ? (
                        <p className="text-muted-foreground">Carregando slots...</p>
                    ) : rascunhos.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">Nenhum rascunho.</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {rascunhos.map(slot => {
                                const type = typeMap.get(slot.serviceTypeId);
                                const busy = actionId === slot.id;
                                return (
                                    <Card key={slot.id} className="hover:bg-gray-50">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                <span className="text-lg">{type?.icone ?? '🔧'}</span>
                                                {slot.titulo}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <p>{type?.nome}</p>
                                                <p>{slot.dataInicio} → {slot.dataFim}</p>
                                                <Badge variant="secondary">Rascunho</Badge>
                                            </div>
                                            <div className="flex gap-2 mt-3">
                                                <Button size="sm" variant="outline" asChild>
                                                    <Link href={`/admin/agendamentos/slots/${slot.id}/editar`}>
                                                        <Pencil className="h-3 w-3 mr-1" />Editar
                                                    </Link>
                                                </Button>
                                                <Button size="sm" disabled={busy || mutating} onClick={() => handlePublish(slot.id)}>
                                                    {busy ? "..." : "Publicar"}
                                                </Button>
                                                <Button size="sm" variant="ghost" disabled={busy || mutating} onClick={() => handleCancelar(slot.id)}>
                                                    <XCircle className="h-3 w-3 mr-1" />{busy ? "..." : "Cancelar"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="encerrados" className="space-y-4">
                    {slotsLoading ? (
                        <p className="text-muted-foreground">Carregando slots...</p>
                    ) : encerrados.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">Nenhum slot encerrado.</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {encerrados.map(slot => {
                                const type = typeMap.get(slot.serviceTypeId);
                                return (
                                    <Card key={slot.id} className="opacity-60">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                <span className="text-lg">{type?.icone ?? '🔧'}</span>
                                                {slot.titulo}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                <p>{type?.nome}</p>
                                                <p>{slot.dataInicio} → {slot.dataFim}</p>
                                                <Badge variant="outline">{slot.status}</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {selectedSlotId && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ListTodo className="h-5 w-5" />
                            Bookings do Slot
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {tasksLoading ? (
                            <p className="text-muted-foreground">Carregando bookings...</p>
                        ) : tasks.length === 0 ? (
                            <p className="text-muted-foreground">Nenhum booking registrado para este slot.</p>
                        ) : (
                            <div className="space-y-2">
                                {tasks.map(task => (
                                    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div>
                                            <p className="font-medium">{task.titulo}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Status: {task.status} · Criado em: {task.criado_em}
                                            </p>
                                        </div>
                                        <Link href={`/tasks/${task.id}`}>
                                            <Button size="sm" variant="outline">Ver Tarefa</Button>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
