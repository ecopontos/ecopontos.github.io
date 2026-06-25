"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, MapPin, Repeat, MapIcon } from "lucide-react";
import Link from "next/link";
import { useBookingTasks, useServiceSlotById, useServiceTypes, useServiceMutations } from "@/src/interface/hooks/catalog/service";
import { RoteiroModal } from "@/components/agendamentos/RoteiroModal";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
    a_fazer: 'A fazer',
    em_progresso: 'Em progresso',
    em_revisao: 'Em revisão',
    concluido: 'Concluído',
    arquivado: 'Arquivado',
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    a_fazer: 'secondary',
    em_progresso: 'default',
    em_revisao: 'outline',
    concluido: 'default',
    arquivado: 'secondary',
};

export default function SlotDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [publishing, setPublishing] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [roteiroOpen, setRoteiroOpen] = useState(false);

    const { slot, loading: fetching, reload: reloadSlot } = useServiceSlotById(id ?? null);
    const { types } = useServiceTypes();
    const { publishSlot, cancelSlot } = useServiceMutations();
    const { tasks, hasMore, loadMore, reload: reloadTasks } = useBookingTasks(id ?? null);

    const serviceType = types.find(t => t.id === slot?.serviceTypeId) ?? null;

    const handlePublish = async () => {
        setPublishing(true);
        try {
            await publishSlot(id);
            reloadSlot();
            await reloadTasks();
        } catch (err) {
            toast.error("Erro: " + (err as Error).message);
        } finally {
            setPublishing(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm("Cancelar este slot?")) return;
        setCancelling(true);
        try {
            await cancelSlot(id);
            reloadSlot();
            await reloadTasks();
        } catch (err) {
            toast.error("Erro: " + (err as Error).message);
        } finally {
            setCancelling(false);
        }
    };

    if (fetching) return <div className="p-8 text-muted-foreground">Carregando...</div>;
    if (!slot) return <div className="p-8 text-red-500">Slot não encontrado.</div>;

    const vagasLivres = slot.capacidade != null ? slot.capacidade - slot.vagasOcupadas : null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/admin/agendamentos"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{slot.titulo}</h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            {serviceType?.icone} {serviceType?.nome ?? 'Tipo desconhecido'}
                            <Badge variant={slot.status === 'publicado' ? 'default' : 'secondary'}>
                                {slot.status}
                            </Badge>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {serviceType?.requerMapa && (
                        <Button variant="outline" onClick={() => setRoteiroOpen(true)}>
                            <MapIcon className="h-4 w-4 mr-1.5" />
                            Ver Roteiro
                        </Button>
                    )}
                    {(slot.status === 'rascunho' || slot.status === 'publicado') && (
                        <Button variant="outline" asChild>
                            <Link href={`/admin/agendamentos/slots/${slot.id}/editar`}>Editar</Link>
                        </Button>
                    )}
                    {slot.status === 'rascunho' && (
                        <Button onClick={handlePublish} disabled={publishing}>
                            {publishing ? "Publicando..." : "Publicar"}
                        </Button>
                    )}
                    {(slot.status === 'rascunho' || slot.status === 'publicado') && (
                        <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                            {cancelling ? "Cancelando..." : "Cancelar slot"}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-sm">Período</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {slot.tipoPrazo === 'unico' ? (
                                <span>{new Date(slot.dataInicio).toLocaleString('pt-BR')}</span>
                            ) : (
                                <span>
                                    {new Date(slot.dataInicio).toLocaleString('pt-BR')} → {new Date(slot.dataFim).toLocaleString('pt-BR')}
                                </span>
                            )}
                        </div>
                        {slot.tipoPrazo === 'recorrente' && slot.recorrencia && (() => {
                            const rec = JSON.parse(slot.recorrencia);
                            const FREQ: Record<string, string> = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' };
                            return (
                                <div className="flex items-center gap-2">
                                    <Repeat className="h-4 w-4 text-muted-foreground" />
                                    <span>{FREQ[rec.frequencia] ?? rec.frequencia}{rec.intervalo > 1 ? ` · a cada ${rec.intervalo}` : ''}{rec.fim_recorrencia ? ` · até ${new Date(rec.fim_recorrencia).toLocaleDateString('pt-BR')}` : ''}</span>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-sm">Vagas</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {slot.vagasOcupadas} ocupadas / {slot.capacidade ?? '∞'} total
                                {vagasLivres != null && ` · ${vagasLivres} livres`}
                            </span>
                        </div>
                        {slot.bairros.length > 0 && (
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>{slot.bairros.join(', ')}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Tasks no Kanban ({tasks.length})</CardTitle>
                    {slot.status === 'publicado' && (
                        <Button size="sm" asChild>
                            <Link href={`/agendamentos/novo?slotId=${slot.id}`}>
                                + Novo booking
                            </Link>
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            Nenhum booking registrado para este slot.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {tasks.map(task => (
                                <div key={task.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                                    <div>
                                        <p className="text-sm font-medium">{task.titulo}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(task.criadoEm).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                    <Badge variant={STATUS_VARIANTS[task.status] ?? 'secondary'}>
                                        {STATUS_LABELS[task.status] ?? task.status}
                                    </Badge>
                                </div>
                            ))}
                            {hasMore && (
                                <Button variant="outline" size="sm" className="w-full" onClick={loadMore}>
                                    Carregar mais
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {serviceType?.requerMapa && (
                <RoteiroModal
                    slotId={slot.id}
                    slotTitulo={slot.titulo}
                    open={roteiroOpen}
                    onClose={() => setRoteiroOpen(false)}
                />
            )}
        </div>
    );
}
