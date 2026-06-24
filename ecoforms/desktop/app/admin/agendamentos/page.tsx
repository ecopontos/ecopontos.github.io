"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar } from "lucide-react";
import Link from "next/link";
import { useServiceSlots, useServiceTypes, useServiceMutations } from "@/src/interface/hooks/catalog/service";

export default function AdminAgendamentosPage() {
    const { slots, loading, reload } = useServiceSlots();
    const { types } = useServiceTypes();
    const { publishSlot, cancelSlot } = useServiceMutations();
    const [publishing, setPublishing] = useState<string | null>(null);

    const typeMap = new Map(types.map(t => [t.id, t]));

    const handlePublish = useCallback(async (slotId: string) => {
        setPublishing(slotId);
        try {
            await publishSlot(slotId);
            reload?.();
        } catch (err) {
            alert("Erro ao publicar: " + (err as Error).message);
        } finally {
            setPublishing(null);
        }
    }, [publishSlot, reload]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Slots de Agendamento</h1>
                    <p className="text-muted-foreground">
                        Gerencie as janelas de tempo disponíveis para cada tipo de serviço.
                    </p>
                </div>
                <Link href="/admin/agendamentos/slots/novo">
                    <Button><Plus className="mr-2 h-4 w-4" />Novo Slot</Button>
                </Link>
            </div>

            {loading && <p>Carregando...</p>}

            <div className="space-y-3">
                {slots.map(slot => {
                    const type = typeMap.get(slot.serviceTypeId);
                    return (
                        <Card key={slot.id} className="hover:bg-gray-50 transition-colors">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <Link href={`/admin/agendamentos/slots/${slot.id}`} className="hover:underline">
                                        {slot.titulo}
                                    </Link>
                                </CardTitle>
                                <Badge variant={slot.status === 'publicado' ? 'default' : 'secondary'}>
                                    {slot.status}
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex gap-4 text-muted-foreground">
                                        <span>{type?.icone} {type?.nome ?? 'Tipo desconhecido'}</span>
                                        <span>{slot.dataInicio} → {slot.dataFim}</span>
                                        <span>Vagas: {slot.vagasOcupadas} / {slot.capacidade ?? '∞'}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {(slot.status === 'rascunho' || slot.status === 'publicado') && (
                                            <Button size="sm" variant="outline" asChild>
                                                <Link href={`/admin/agendamentos/slots/${slot.id}/editar`}>Editar</Link>
                                            </Button>
                                        )}
                                        {slot.status === 'rascunho' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={publishing === slot.id}
                                                onClick={() => handlePublish(slot.id)}
                                            >
                                                {publishing === slot.id ? "Publicando..." : "Publicar"}
                                            </Button>
                                        )}
                                        <Button size="sm" variant="ghost" asChild>
                                            <Link href={`/admin/agendamentos/slots/${slot.id}`}>Detalhes</Link>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
