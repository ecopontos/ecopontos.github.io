"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Eye, RotateCcw, Trash2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DetailViewModal } from "@/components/DetailViewModal";
import type { TblSuiteRecord } from "@/types";
import { useHistoryData } from "@/src/interface/hooks/catalog/forms";

export default function HistoryPage() {
    return (
        <ErrorBoundary moduleName="Histórico">
            <HistoryContent />
        </ErrorBoundary>
    );
}

function HistoryContent() {
    const [viewRecord, setViewRecord] = useState<TblSuiteRecord | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const { data, loading, restoreRecord, deleteRecord, refetch } = useHistoryData();

    const handleRestore = async (record: TblSuiteRecord) => {
        if (!confirm("Deseja restaurar este item para a Inbox?")) return;
        try {
            await restoreRecord(record.id);
            alert("Restaurado com sucesso!");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            alert("Erro ao restaurar: " + message);
        }
    };

    const handleDeletePermanent = async (id: string) => {
        if (!confirm("ATENÇÃO: Isso apagará o registro permanentemente. Continuar?")) return;
        try {
            await deleteRecord(id);
            alert("Registro apagado.");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            alert("Erro ao apagar: " + message);
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Histórico</h1>
                    <p className="text-muted-foreground">
                        Registros processados e arquivados.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Arquivo Morto</CardTitle>
                    <CardDescription>Itens removidos da Inbox.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Formulário</TableHead>
                                <TableHead>Dados (Resumo)</TableHead>
                                <TableHead>Arquivado Em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10">Carregando...</TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                        Nenhum histórico encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium">
                                            <Badge variant="secondary">{record.tipo_form || "N/A"}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-75 truncate text-muted-foreground">
                                            {record.dados ? JSON.stringify(record.dados).substring(0, 50) + "..." : "Sem dados"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {record.arquivado_em ? new Date(record.arquivado_em).toLocaleString("pt-BR") : '—'}
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="icon" onClick={() => { setViewRecord(record); setIsViewOpen(true); }} title="Ver Detalhes">
                                                <Eye className="h-4 w-4 text-gray-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleRestore(record)} title="Restaurar para Inbox">
                                                <RotateCcw className="h-4 w-4 text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeletePermanent(record.id)} title="Excluir Permanentemente">
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <DetailViewModal
                record={viewRecord}
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
                hideActions={true}
            />
        </div>
    );
}
