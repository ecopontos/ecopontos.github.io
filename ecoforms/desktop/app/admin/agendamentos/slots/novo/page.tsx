"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { useServiceTypes, useServiceMutations } from "@/src/interface/hooks/catalog/service";
import { useAuth } from "@/contexts/AuthContext";
import { TaskDateSection, DEFAULT_RECORRENCIA } from "@/components/kanban/TaskDateSection";
import type { TipoPrazo, RecorrenciaConfig } from "@/components/kanban/TaskDateSection";
import type { AberturaRegra } from "@/src/application/service/CreateServiceSlotUseCase";
import { toast } from "sonner";

export default function NovoServiceSlotPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { types } = useServiceTypes();
    const { createSlot, loading } = useServiceMutations();
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
    const [aberturaEm, setAberturaEm] = useState("");

    const selectedType = types.find(t => t.id === serviceTypeId);

    const aberturaRegra = useMemo<AberturaRegra | null>(() => {
        const raw = (selectedType as unknown as { aberturaRegra?: string })?.aberturaRegra;
        if (!raw) return null;
        try { return JSON.parse(raw) as AberturaRegra; } catch { return null; }
    }, [selectedType]);

    const aberturaEmComputada = useMemo<string | null>(() => {
        if (!aberturaRegra || aberturaRegra.tipo !== 'antecedencia_dias' || !prazo) return null;
        const dias = aberturaRegra.antecedencia_dias ?? 0;
        if (!dias) return null;
        const d = new Date(prazo);
        d.setDate(d.getDate() - dias);
        return d.toLocaleDateString('pt-BR');
    }, [aberturaRegra, prazo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prazo) { toast.error("Informe a data de início."); return; }
        try {
            const dataInicio = prazo;
            const dataFim = tipoPrazo === 'unico' ? prazo : (prazoFim || prazo);
            await createSlot({
                serviceTypeId,
                titulo,
                descricao: descricao || undefined,
                dataInicio,
                dataFim,
                tipoPrazo,
                recorrencia: tipoPrazo === 'recorrente' ? JSON.stringify(recorrencia) : undefined,
                capacidade: capacidade ? parseInt(capacidade) : undefined,
                bairros: bairros.split(',').map(b => b.trim()).filter(Boolean),
                local: local || undefined,
                aberturaEm: aberturaRegra?.tipo === 'data_especifica' && aberturaEm ? aberturaEm : undefined,
                userId: user?.id ?? 'anon',
            });
            router.push("/admin/agendamentos");
        } catch (err) {
            toast.error("Erro ao criar slot: " + (err as Error).message);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Novo Slot</h1>
                <p className="text-muted-foreground">
                    Crie uma janela de tempo para um tipo de serviço.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Dados do Slot</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tipo de Serviço *</Label>
                            <Select value={serviceTypeId} onValueChange={setServiceTypeId} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um tipo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {types.map(t => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.icone ?? '🔧'} {t.nome}
                                        </SelectItem>
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

                        {/* Janela de abertura — condicional por abertura_regra do tipo */}
                        {aberturaRegra && aberturaRegra.tipo !== 'imediato' && (
                            <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                                <Label className="flex items-center gap-2">
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                    Janela de abertura para agendamentos
                                </Label>
                                {aberturaRegra.tipo === 'antecedencia_dias' && (
                                    <div className="text-sm text-muted-foreground">
                                        <p>
                                            Este tipo usa antecedência de{" "}
                                            <strong>{aberturaRegra.antecedencia_dias} dia{aberturaRegra.antecedencia_dias !== 1 ? "s" : ""}</strong>{" "}
                                            antes do início.
                                        </p>
                                        {aberturaEmComputada && (
                                            <p className="mt-1">
                                                Abertura prevista:{" "}
                                                <Badge variant="outline">{aberturaEmComputada}</Badge>
                                            </p>
                                        )}
                                        {!prazo && (
                                            <p className="mt-1 text-yellow-600">Informe a data de início para ver a abertura calculada.</p>
                                        )}
                                    </div>
                                )}
                                {aberturaRegra.tipo === 'data_especifica' && (
                                    <div className="space-y-1.5">
                                        <p className="text-sm text-muted-foreground">
                                            Informe quando o agendamento estará disponível para o público.
                                        </p>
                                        <Input
                                            id="abertura_em"
                                            type="datetime-local"
                                            value={aberturaEm}
                                            onChange={e => setAberturaEm(e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 pt-4">
                            <Button type="submit" disabled={loading}>
                                {loading ? "Criando..." : "Criar Slot"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => router.push("/admin/agendamentos")}>
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
