"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServiceTypes, useServiceSlotById, useServiceMutations } from "@/src/interface/hooks/catalog/service";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { TaskDateSection, DEFAULT_RECORRENCIA } from "@/components/kanban/TaskDateSection";
import type { TipoPrazo, RecorrenciaConfig } from "@/components/kanban/TaskDateSection";
import { toast } from "sonner";

export default function EditarServiceSlotClient() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const { types } = useServiceTypes();
    const { slot: loadedSlot, loading } = useServiceSlotById(id ?? null);
    const { updateSlot } = useServiceMutations();
    const [saving, setSaving] = useState(false);

    const [serviceTypeId, setServiceTypeId] = useState("");
    const [titulo, setTitulo] = useState("");
    const [descricao, setDescricao] = useState("");
    const [tipoPrazo, setTipoPrazo] = useState<TipoPrazo>('periodo');
    const [prazo, setPrazo] = useState("");
    const [prazoFim, setPrazoFim] = useState("");
    const [recorrencia, setRecorrencia] = useState<RecorrenciaConfig>(DEFAULT_RECORRENCIA);
    const [capacidade, setCapacidade] = useState("");
    const [bairros, setBairros] = useState("");
    const [local, setLocal] = useState("");

    const selectedType = types.find(t => t.id === serviceTypeId);

    const initialized = useRef(false);
    useEffect(() => {
        if (!loadedSlot || initialized.current) return;
        if (loadedSlot.status === 'encerrado' || loadedSlot.status === 'cancelado') {
            toast.error("Não é possível editar um slot encerrado ou cancelado");
            router.push(`/admin/agendamentos/slots/${id}`);
            return;
        }
        initialized.current = true;
        setServiceTypeId(loadedSlot.serviceTypeId);
        setTitulo(loadedSlot.titulo);
        setDescricao(loadedSlot.descricao ?? "");
        setTipoPrazo((loadedSlot.tipoPrazo ?? 'periodo') as TipoPrazo);
        setPrazo(loadedSlot.dataInicio ?? "");
        setPrazoFim(loadedSlot.dataFim ?? "");
        setRecorrencia(loadedSlot.recorrencia ? JSON.parse(loadedSlot.recorrencia) : DEFAULT_RECORRENCIA);
        setCapacidade(loadedSlot.capacidade?.toString() ?? "");
        setBairros((loadedSlot.bairros ?? []).join(", "));
        setLocal(loadedSlot.local ?? "");
    }, [loadedSlot, id, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !prazo) return;
        setSaving(true);
        try {
            const dataInicio = prazo;
            const dataFim = tipoPrazo === 'unico' ? prazo : (prazoFim || prazo);
            await updateSlot({
                id,
                titulo,
                descricao: descricao || null,
                dataInicio,
                dataFim,
                tipoPrazo,
                recorrencia: tipoPrazo === 'recorrente' ? JSON.stringify(recorrencia) : null,
                capacidade: capacidade ? parseInt(capacidade) : null,
                bairros: bairros.split(",").map(b => b.trim()).filter(Boolean),
                local: local || null,
            });
            router.push(`/admin/agendamentos/slots/${id}`);
        } catch (err) {
            toast.error("Erro ao salvar: " + (err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (loading || !loadedSlot) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/admin/agendamentos/slots/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Editar Slot</h1>
                    <p className="text-muted-foreground">Altere os dados da janela de tempo.</p>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>Dados do Slot</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tipo de Serviço *</Label>
                            <Select value={serviceTypeId} onValueChange={setServiceTypeId} required>
                                <SelectTrigger><SelectValue placeholder="Selecione um tipo..." /></SelectTrigger>
                                <SelectContent>
                                    {types.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.icone ?? '🔧'} {t.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="titulo">Título *</Label>
                            <Input id="titulo" value={titulo} onChange={e => setTitulo(e.target.value)} required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="descricao">Descrição</Label>
                            <Input id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label>Janela de Tempo *</Label>
                            <TaskDateSection
                                tipoPrazo={tipoPrazo}
                                onChangeTipoPrazo={setTipoPrazo}
                                prazo={prazo}
                                onChangePrazo={setPrazo}
                                prazoFim={prazoFim}
                                onChangePrazoFim={setPrazoFim}
                                recorrencia={recorrencia}
                                onChangeRecorrencia={setRecorrencia}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="capacidade">Capacidade {selectedType?.capacidadePadrao && `(padrão: ${selectedType.capacidadePadrao})`}</Label>
                            <Input id="capacidade" type="number" value={capacidade} onChange={e => setCapacidade(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bairros">Bairros atendidos (separados por vírgula)</Label>
                            <Input id="bairros" value={bairros} onChange={e => setBairros(e.target.value)} placeholder="Centro, Santa Cruz, ..." />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="local">Local</Label>
                            <Input id="local" value={local} onChange={e => setLocal(e.target.value)} />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
                            <Button type="button" variant="outline" onClick={() => router.push(`/admin/agendamentos/slots/${id}`)}>Cancelar</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
