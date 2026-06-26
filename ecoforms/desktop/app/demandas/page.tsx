"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDemandas } from "@/src/interface/hooks/queries/useDemandas";
import type { DemandaListItem } from "@/src/domain/demanda/DemandaRepository";
import type { DemandaStatus } from "@/src/domain/demanda/Demanda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Inbox, ArrowRight } from "lucide-react";

type DemandaRow = DemandaListItem;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    aberta: "default",
    aceita: "secondary",
    em_campo: "outline",
    concluida: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
    aberta: "Aberta",
    aceita: "Aceita",
    em_campo: "Em Campo",
    concluida: "Concluída",
};

export default function DemandasPage() {
    const router = useRouter();
    const { listDemandasWithDetails } = useDemandas();
    const [demandas, setDemandas] = useState<DemandaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("todas");

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const filters = statusFilter === "todas"
                    ? {}
                    : { status: statusFilter as DemandaStatus };
                const rows = await listDemandasWithDetails(filters);
                if (!cancelled) setDemandas(rows);
            } catch (e) {
                console.error("[DemandasPage] erro ao carregar:", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [statusFilter, listDemandasWithDetails]);

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Demandas</h1>
                    <p className="text-sm text-muted-foreground">
                        Demandas encaminhadas entre setores
                    </p>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        <SelectItem value="aberta">Abertas</SelectItem>
                        <SelectItem value="aceita">Aceitas</SelectItem>
                        <SelectItem value="em_campo">Em Campo</SelectItem>
                        <SelectItem value="concluida">Concluídas</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <p className="text-muted-foreground py-8">Carregando...</p>
            ) : demandas.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Inbox className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                        <p>Nenhuma demanda encontrada.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {demandas.length} demanda(s)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Demanda</TableHead>
                                    <TableHead>Origem</TableHead>
                                    <TableHead>Setor Destino</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {demandas.map((d) => (
                                    <TableRow
                                        key={d.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/demandas/${d.id}`)}
                                    >
                                        <TableCell>
                                            <div>
                                                <div className="font-medium text-sm">
                                                    #{d.id.slice(0, 8)}
                                                </div>
                                                {d.descricao && (
                                                    <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                                                        {d.descricao}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {d.solicitante_nome || d.solicitante_id?.slice(0, 8) || "—"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {d.origem_tipo}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {d.setor_nome || d.destinatario_id?.slice(0, 8) || "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-muted-foreground">
                                                {d.tipo_acao || "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>
                                                {STATUS_LABEL[d.status] || d.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(d.criado_em).toLocaleDateString("pt-BR")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/demandas/${d.id}`);
                                                }}
                                            >
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
