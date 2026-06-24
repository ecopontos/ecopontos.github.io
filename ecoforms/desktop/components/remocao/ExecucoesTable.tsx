"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Truck, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { useExecucoesClientes } from "@/src/interface/hooks/queries/useExecucoesClientes";

export default function ExecucoesTable() {
    const { data: execucoes, loading } = useExecucoesClientes();
    const [selectedExecucao, setSelectedExecucao] = useState<string | null>(null);

    const selected = selectedExecucao ? execucoes.filter(e => e.execucaoId === selectedExecucao) : execucoes;

    const execucaoIds = [...new Set(execucoes.map(e => e.execucaoId))];

    if (loading) {
        return (
            <div className="text-center py-20">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Carregando execuções...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Truck className="h-6 w-6" />
                    Execuções de Coleta
                </h1>
                <p className="text-muted-foreground">
                    Registro de visitas a clientes durante a execução de coleta
                </p>
            </div>

            {execucaoIds.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                    <Badge
                        variant={selectedExecucao === null ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setSelectedExecucao(null)}
                    >
                        Todas
                    </Badge>
                    {execucaoIds.slice(0, 10).map(id => (
                        <Badge
                            key={id}
                            variant={selectedExecucao === id ? "default" : "outline"}
                            className="cursor-pointer font-mono"
                            onClick={() => setSelectedExecucao(id)}
                        >
                            {id.slice(0, 8)}...
                        </Badge>
                    ))}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Visitas por Cliente</CardTitle>
                    <CardDescription>
                        {selected.length} registro(s) de visita{selected.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Execução</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Coleta</TableHead>
                                <TableHead>Horário</TableHead>
                                <TableHead>Localização</TableHead>
                                <TableHead>Ocorrência</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selected.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        Nenhuma execução registrada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                selected.map((exec) => (
                                    <TableRow key={exec.id}>
                                        <TableCell className="font-mono text-xs">{exec.execucaoId.slice(0, 8)}...</TableCell>
                                        <TableCell className="font-mono text-xs">{exec.clienteId.slice(0, 8)}...</TableCell>
                                        <TableCell>
                                            {exec.coletaRealizada ? (
                                                <Badge variant="default" className="bg-green-600">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Realizada
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive">
                                                    <XCircle className="h-3 w-3 mr-1" /> Não realizada
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {exec.horarioVisita ? new Date(exec.horarioVisita).toLocaleString() : "—"}
                                        </TableCell>
                                        <TableCell>
                                            {exec.latitude && exec.longitude ? (
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    {exec.latitude.toFixed(4)}, {exec.longitude.toFixed(4)}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[200px] truncate">
                                            {exec.ocorrencia || exec.observacao || "—"}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
