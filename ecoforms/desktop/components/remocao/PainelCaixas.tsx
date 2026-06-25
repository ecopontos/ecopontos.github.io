"use client";

import { useMemo, useState } from "react";
import { useCaixasData } from "@/src/interface/hooks/catalog/forms";
import { useRemocaoAnalytics } from "@/src/interface/hooks/queries/useRemocaoAnalytics";
import { useSetores } from "@/src/interface/hooks/catalog/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefreshCw, LayoutGrid, List as ListIcon, Info, TrendingUp, Clock, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface CaixasRemovidas {
    [key: string]: boolean;
}

interface EcopontoStatus {
    id: string;
    name: string;
    lastUpdate: string;
    status: 'critical' | 'warning' | 'normal';
    occupation: {
        entulho: number;
        madeira: number;
        poda: number;
        reciclavel: number;
        rejeito: number;
        sucata: number;
        vidro: number;
        [key: string]: number;
    };
    removed: {
        entulho: boolean;
        madeira: boolean;
        poda: boolean;
        reciclavel: boolean;
        rejeito: boolean;
        sucata: boolean;
        vidro: boolean;
        [key: string]: boolean;
    };
}

export default function PainelCaixas() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedEcoponto, setSelectedEcoponto] = useState<string | null>(null);
    const { rawData, loading, refetch } = useCaixasData();
    const analytics = useRemocaoAnalytics(selectedEcoponto);
    const { data: setores } = useSetores();
    const { user } = useAuth();

    const [agendarDialog, setAgendarDialog] = useState<{ ecopontoId: string; ecopontoName: string } | null>(null);
    const [setorDestino, setSetorDestino] = useState('');
    const [observacao, setObservacao] = useState('');
    const [agendando, setAgendando] = useState(false);

    const handleAgendarRemocao = async () => {
        if (!agendarDialog || !setorDestino) return;
        setAgendando(true);
        try {
            await invoke('ecoponto_agendar_remocao', {
                ecopontoId: agendarDialog.ecopontoId,
                setorDestino,
                observacao: observacao || null,
            });
            toast.success('Remoção agendada com sucesso.');
            setAgendarDialog(null);
            setSetorDestino('');
            setObservacao('');
            refetch();
        } catch (err) {
            toast.error('Erro ao agendar remoção: ' + String(err));
        } finally {
            setAgendando(false);
        }
    };

    const ecopontosStatus = useMemo(() => {
        if (!rawData) return [];

        const latestByEcoponto = new Map<string, Record<string, unknown>>();

        rawData.forEach((row) => {
            try {
                const dados = typeof row.dados === 'string' ? JSON.parse(row.dados) as Record<string, unknown> : row.dados as Record<string, unknown>;

                const actualData = (dados.campos || dados.data || dados) as Record<string, unknown>;

                const ecopontoId = (actualData.ecoponto || actualData.ecopontoLabel) as string;

                if (ecopontoId && !latestByEcoponto.has(ecopontoId)) {
                    latestByEcoponto.set(ecopontoId, {
                        ...actualData,
                        timestamp: row.criado_em
                    });
                }
            } catch (e) {
                console.warn("Error parsing record:", row.id, e);
            }
        });

        return Array.from(latestByEcoponto.entries()).map(([id, data]) => {
            const caixasList = (data.caixas_list || {}) as Record<string, unknown>;
            const occupation = (caixasList.ocupacao || {}) as Record<string, unknown>;
            const removed = (caixasList.removidas || {}) as Record<string, unknown>;

            const mappedOccupation = {
                entulho: Number(occupation['1'] || 0),
                madeira: Number(occupation['2'] || 0),
                poda: Number(occupation['3'] || 0),
                reciclavel: Number(occupation['4'] || 0),
                rejeito: Number(occupation['5'] || 0),
                sucata: Number(occupation['6'] || 0),
                vidro: Number(occupation['7'] || 0),
            };

            const mappedRemoved: CaixasRemovidas = {
                entulho: !!removed['1'],
                madeira: !!removed['2'],
                poda: !!removed['3'],
                reciclavel: !!removed['4'],
                rejeito: !!removed['5'],
                sucata: !!removed['6'],
                vidro: !!removed['7'],
            };

            let criticalCount = 0;
            let filledCount = 0;

            Object.entries(mappedOccupation).forEach(([key, level]) => {
                if (level > 0) filledCount++;
                if (level >= 75 && !mappedRemoved[key]) criticalCount++;
            });

            let status: 'critical' | 'warning' | 'normal' = 'normal';
            if (criticalCount > 0) status = 'critical';
            else if (filledCount > 2) status = 'warning';

            return {
                id,
                name: data.ecopontoLabel || id,
                lastUpdate: data.timestamp,
                status,
                occupation: mappedOccupation,
                removed: mappedRemoved
            } as EcopontoStatus;
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [rawData]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'critical': return <Badge variant="destructive" className="bg-red-600">Crítico</Badge>;
            case 'warning': return <Badge className="bg-amber-500 hover:bg-amber-600">Alerta</Badge>;
            case 'normal': return <Badge className="bg-green-600 hover:bg-green-700">Normal</Badge>;
            default: return <Badge variant="outline">Desconhecido</Badge>;
        }
    };

    const getBarGradient = (type: string) => {
        switch (type) {
            case 'entulho': return 'from-gray-500 to-gray-600';
            case 'madeira': return 'from-amber-800 to-amber-900';
            case 'poda': return 'from-green-600 to-green-800';
            case 'reciclavel': return 'from-sky-500 to-sky-700';
            case 'rejeito': return 'from-gray-700 to-gray-900';
            case 'sucata': return 'from-amber-500 to-amber-600';
            case 'vidro': return 'from-cyan-500 to-cyan-700';
            default: return 'from-blue-500 to-blue-600';
        }
    };

    const wasteTypes = [
        { key: 'entulho', label: 'Entulho', icon: '\u{1F3D7}\uFE0F' },
        { key: 'madeira', label: 'Madeira', icon: '\u{1FAB5}' },
        { key: 'poda', label: 'Poda', icon: '\u{1F33F}' },
        { key: 'reciclavel', label: 'Reciclável', icon: '\u267B\uFE0F' },
        { key: 'rejeito', label: 'Rejeito', icon: '\u{1F5D1}\uFE0F' },
        { key: 'sucata', label: 'Sucata', icon: '\u2699\uFE0F' },
        { key: 'vidro', label: 'Vidro', icon: '\u{1FA9F}' },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Ecopontos: Caixas</h1>
                    <p className="text-muted-foreground">
                        Monitoramento em tempo real da ocupação das caixas.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-muted rounded-lg p-1">
                        <Button
                            variant={viewMode === 'grid' ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode('grid')}
                            title="Visualização em Grade"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            title="Visualização em Lista"
                        >
                            <ListIcon className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={loading}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {loading && ecopontosStatus.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            ) : ecopontosStatus.length === 0 ? (
                <Card className="bg-muted/50 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Info className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold">Nenhum dado encontrado</h3>
                        <p className="text-muted-foreground max-w-sm mt-2">
                            Não foram encontrados registros de ocupação de caixas (ecopontoCaixasForm).
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                    {ecopontosStatus.map((ecoponto) => (
                        <Card
                            key={ecoponto.id}
                            className={`overflow-hidden border-l-4 cursor-pointer transition-shadow hover:shadow-md ${ecoponto.status === 'critical' ? 'border-l-red-500' :
                                ecoponto.status === 'warning' ? 'border-l-amber-500' :
                                    'border-l-green-500'
                                } ${selectedEcoponto === ecoponto.id ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setSelectedEcoponto(selectedEcoponto === ecoponto.id ? null : ecoponto.id)}
                        >
                            <CardHeader className="pb-3 bg-slate-50/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl">{ecoponto.name}</CardTitle>
                                        <CardDescription className="flex items-center gap-1 mt-1 text-xs">
                                            Atualizado em {format(new Date(ecoponto.lastUpdate), "dd/MM/yyyy HH:mm")}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(ecoponto.status)}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSetorDestino('');
                                                setObservacao('');
                                                setAgendarDialog({ ecopontoId: ecoponto.id, ecopontoName: ecoponto.name });
                                            }}
                                            title="Agendar remoção de caixas"
                                        >
                                            <Truck className="h-3.5 w-3.5 mr-1" />
                                            Agendar
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className={`grid gap-x-6 gap-y-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7'}`}>
                                    {wasteTypes.map((type) => {
                                        const level = ecoponto.occupation[type.key] || 0;
                                        const isRemoved = ecoponto.removed[type.key];

                                        return (
                                            <div key={type.key} className="space-y-1.5 group">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                                                        <span className="text-base">{type.icon}</span> {type.label}
                                                    </span>
                                                    {isRemoved && (
                                                        <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                                            Removida
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                                                    <div
                                                        className={`h-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm transition-all duration-500 bg-gradient-to-r ${getBarGradient(type.key)} ${isRemoved ? 'opacity-40 grayscale' : ''}`}
                                                        style={{ width: `${Math.max(5, level)}%` }}
                                                    >
                                                        {level}%
                                                    </div>
                                                    <div className="absolute top-0 bottom-0 left-[75%] w-px bg-red-400/30 border-r border-dashed border-red-500/50 z-10 pointer-events-none" title="Limite Crítico (75%)"></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {selectedEcoponto && (
                <AnalyticsSection
                    ecopontoName={ecopontosStatus.find(e => e.id === selectedEcoponto)?.name || selectedEcoponto}
                    analytics={analytics}
                />
            )}

            <Dialog open={!!agendarDialog} onOpenChange={(open) => { if (!open) setAgendarDialog(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            Agendar Remoção — {agendarDialog?.ecopontoName}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Setor de destino *</Label>
                            <Select value={setorDestino} onValueChange={setSetorDestino}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o setor responsável" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(setores ?? []).map((s: { id: string; nome: string }) => (
                                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Observação</Label>
                            <Textarea
                                placeholder="Informações adicionais sobre a remoção..."
                                value={observacao}
                                onChange={e => setObservacao(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAgendarDialog(null)} disabled={agendando}>
                            Cancelar
                        </Button>
                        <Button onClick={handleAgendarRemocao} disabled={!setorDestino || agendando}>
                            {agendando ? 'Agendando...' : 'Agendar Remoção'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function AnalyticsSection({
    ecopontoName,
    analytics,
}: {
    ecopontoName: string;
    analytics: ReturnType<typeof useRemocaoAnalytics>;
}) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    if (analytics.loading) {
        return (
            <Card className="mt-6">
                <CardContent className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </CardContent>
            </Card>
        );
    }

    if (analytics.error) {
        return (
            <Card className="mt-6 bg-red-50">
                <CardContent className="py-6">
                    <p className="text-red-600 text-sm">{analytics.error}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="mt-6 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Analytics — {ecopontoName}
            </h2>

            <Card>
                <CardHeader className="cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, historico: !prev.historico }))}>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Histórico de Ocupação
                        </CardTitle>
                        {expanded.historico ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    <CardDescription>
                        {analytics.historico.length} registros de snapshot ao longo do tempo
                    </CardDescription>
                </CardHeader>
                {expanded.historico && (
                    <CardContent>
                        {analytics.historico.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum dado histórico disponível.</p>
                        ) : (
                            <HistoricoChart entries={analytics.historico} />
                        )}
                    </CardContent>
                )}
            </Card>

            <Card>
                <CardHeader className="cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, visitas: !prev.visitas }))}>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Visitas por Hora do Dia
                        </CardTitle>
                        {expanded.visitas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    <CardDescription>
                        Distribuição de atendimentos por horário
                    </CardDescription>
                </CardHeader>
                {expanded.visitas && (
                    <CardContent>
                        {analytics.visitasPorHora.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum registro de visitas disponível.</p>
                        ) : (
                            <VisitasHoraChart entries={analytics.visitasPorHora} />
                        )}
                    </CardContent>
                )}
            </Card>

            <Card>
                <CardHeader className="cursor-pointer" onClick={() => setExpanded(prev => ({ ...prev, veiculos: !prev.veiculos }))}>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Truck className="h-4 w-4" /> Média de Visitas por Veículo
                        </CardTitle>
                        {expanded.veiculos ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    <CardDescription>
                        Participação de veículos no ciclo de coleta
                    </CardDescription>
                </CardHeader>
                {expanded.veiculos && (
                    <CardContent>
                        {analytics.mediaPorVeiculo.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum dado de veículos disponível.</p>
                        ) : (
                            <VeiculoMediaTable entries={analytics.mediaPorVeiculo} />
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}

function HistoricoChart({ entries }: { entries: { timestamp: string; tipo: string; ocupacao: number }[] }) {
    const grouped = new Map<string, typeof entries>();
    for (const e of entries) {
        const key = e.tipo;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(e);
    }

    return (
        <div className="space-y-4">
            {Array.from(grouped.entries()).map(([tipo, data]) => {
                const last = data[data.length - 1];
                const first = data[0];
                const trend = last && first ? last.ocupacao - first.ocupacao : 0;

                return (
                    <div key={tipo} className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="font-medium text-slate-700">{tipo}</span>
                            <span>
                                {data.length} registros
                                {trend !== 0 && (
                                    <span className={trend > 0 ? 'text-red-500 ml-1' : 'text-green-500 ml-1'}>
                                        ({trend > 0 ? '+' : ''}{trend}%)
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            {data.map((d, i) => (
                                <div
                                    key={i}
                                    className="h-full bg-blue-500 hover:bg-blue-600 transition-colors"
                                    style={{ width: `${100 / data.length}%`, opacity: 0.3 + (d.ocupacao / 100) * 0.7 }}
                                    title={`${format(new Date(d.timestamp), "dd/MM HH:mm")}: ${d.ocupacao}%`}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function VisitasHoraChart({ entries }: { entries: { hora: string; visitas: number }[] }) {
    const maxVisitas = Math.max(...entries.map(e => e.visitas), 1);

    return (
        <div className="space-y-1">
            {Array.from({ length: 24 }, (_, i) => {
                const key = String(i).padStart(2, '0');
                const total = entries.filter(e => e.hora === key).reduce((s, e) => s + e.visitas, 0);

                return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="w-8 text-right text-muted-foreground">{key}h</span>
                        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-amber-500 rounded-full transition-all"
                                style={{ width: `${(total / maxVisitas) * 100}%` }}
                            />
                        </div>
                        <span className="w-8 text-muted-foreground">{total}</span>
                    </div>
                );
            })}
        </div>
    );
}

function VeiculoMediaTable({ entries }: { entries: { tipo: string; totalVisitas: number; veiculosDistintos: number; mediaPorVeiculo: number; inicioCiclo: string; fimCiclo: string }[] }) {
    return (
        <div className="space-y-3">
            {entries.length > 0 && entries[0].inicioCiclo && (
                <p className="text-xs text-muted-foreground">
                    Período: {format(new Date(entries[0].inicioCiclo), "dd/MM/yyyy")} — {format(new Date(entries[0].fimCiclo), "dd/MM/yyyy")}
                </p>
            )}
            <div className="grid gap-2">
                {entries.map(e => (
                    <div key={e.tipo} className="flex items-center gap-3 p-2 bg-slate-50 rounded-md">
                        <span className="text-sm font-medium w-20">{e.tipo}</span>
                        <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${Math.min((e.mediaPorVeiculo / 10) * 100, 100)}%` }}
                            />
                        </div>
                        <span className="text-xs text-muted-foreground w-32 text-right">
                            {e.mediaPorVeiculo.toFixed(1)} visitas/veículo
                        </span>
                        <span className="text-xs text-muted-foreground">
                            ({e.totalVisitas} visitas / {e.veiculosDistintos} veículos)
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
