"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Building, BarChart2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getContainerAsync } from "@/src/interface/hooks/catalog/utils";
import { useRemocaoAnalytics } from "@/src/interface/hooks/catalog/logistica";
import type { Ecoponto } from "@/src/domain/ecoponto/Ecoponto";

export default function EcopontoDetailPage() {
    const params = useParams();
    const id = typeof params.id === "string" ? params.id : null;

    const [ecoponto, setEcoponto] = useState<Ecoponto | null>(null);
    const [loading, setLoading] = useState(true);
    const [setorNome, setSetorNome] = useState<string | null>(null);

    const { historico, visitasPorHora, mediaPorVeiculo, loading: analyticsLoading, error: analyticsError } = useRemocaoAnalytics(id);

    useEffect(() => {
        if (!id) { setLoading(false); return; }
        let mounted = true;
        getContainerAsync().then(async c => {
            const eco = await c.ecopontoRepository.findById(id);
            if (!mounted) return;
            setEcoponto(eco);
            if (eco?.setorId) {
                const setor = await c.setorRepository.findById(eco.setorId).catch(() => null);
                if (mounted) setSetorNome(setor?.nome ?? null);
            }
        }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [id]);

    if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
    if (!ecoponto) return (
        <div className="p-8">
            <p className="text-muted-foreground">Ecoponto não encontrado.</p>
            <Link href="/remocao"><Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></Link>
        </div>
    );

    return (
        <div className="container mx-auto py-6 px-4 space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/remocao">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{ecoponto.nome}</h1>
                    {ecoponto.endereco && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />{ecoponto.endereco}
                        </p>
                    )}
                </div>
                <Badge variant={ecoponto.ativo ? "default" : "outline"}>
                    {ecoponto.ativo ? "Ativo" : "Inativo"}
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building className="h-4 w-4" />Informações</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Setor responsável</span>
                            <span className="font-medium">{setorNome ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Endereço</span>
                            <span className="font-medium">{ecoponto.endereco ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Cadastrado em</span>
                            <span className="font-medium">
                                {ecoponto.criadoEm ? new Date(ecoponto.criadoEm).toLocaleDateString('pt-BR') : "—"}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" />Visitas por Hora do Dia</CardTitle></CardHeader>
                    <CardContent>
                        {analyticsLoading ? (
                            <p className="text-xs text-muted-foreground">Carregando analytics...</p>
                        ) : analyticsError ? (
                            <p className="text-xs text-red-500">{analyticsError}</p>
                        ) : visitasPorHora.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sem registros de visita.</p>
                        ) : (
                            <div className="space-y-1">
                                {visitasPorHora.slice(0, 8).map(v => (
                                    <div key={v.hora} className="flex items-center gap-2 text-xs">
                                        <span className="w-12 text-muted-foreground">{v.hora}h</span>
                                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-2 bg-primary rounded-full"
                                                style={{ width: `${Math.min(100, (v.visitas / Math.max(...visitasPorHora.map(x => x.visitas))) * 100)}%` }}
                                            />
                                        </div>
                                        <span className="w-8 text-right">{v.visitas}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="h-4 w-4" />Histórico de Ocupação por Caixa</CardTitle></CardHeader>
                <CardContent>
                    {analyticsLoading ? (
                        <p className="text-xs text-muted-foreground">Carregando...</p>
                    ) : historico.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum registro de ocupação encontrado.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="text-left py-1 pr-3">Data/Hora</th>
                                        <th className="text-left py-1 pr-3">Caixa</th>
                                        <th className="text-left py-1 pr-3">Tipo</th>
                                        <th className="text-right py-1">Ocupação</th>
                                        <th className="text-right py-1">Removida</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historico.slice(0, 50).map((h, i) => (
                                        <tr key={i} className="border-b border-border/40">
                                            <td className="py-1 pr-3 text-muted-foreground">
                                                {new Date(h.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                                            </td>
                                            <td className="py-1 pr-3">{h.caixaId}</td>
                                            <td className="py-1 pr-3">{h.tipo}</td>
                                            <td className="py-1 text-right">{h.ocupacao}%</td>
                                            <td className="py-1 text-right">{h.removida ? "✓" : "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {historico.length > 50 && (
                                <p className="text-xs text-muted-foreground mt-2">Exibindo 50 de {historico.length} registros.</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
