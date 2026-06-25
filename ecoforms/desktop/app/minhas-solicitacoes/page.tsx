"use client";

import React, { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, RefreshCw, Clock, CheckCircle, XCircle, Plus, ChevronRight, Archive } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useSolicitacoesList, SolicitacaoPackage } from "@/src/interface/hooks/catalog/forms";

export default function MinhasSolicitacoesPage() {
    const [selectedForView, setSelectedForView] = useState<SolicitacaoPackage | null>(null);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [currentTab, setCurrentTab] = useState("todas");
    const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);

    const { user } = useAuth();
    const {
        solicitacoes,
        availableForms,
        loading,
        hasMore,
        loadMore,
        fetchSolicitacoes,
        fetchAvailableForms,
    } = useSolicitacoesList(user?.id);

    const handleNewRequest = async () => {
        await fetchAvailableForms();
        setIsNewRequestOpen(true);
    };

    const openForm = (formId: string) => {
        import("@/lib/window-utils").then(({ openInNewWindow }) => {
            const formTitle = availableForms.find(f => f.form_id === formId)?.titulo || "Formulário";
            openInNewWindow(`/run?id=${formId}`, `run-${formId}`, `Solicitar: ${formTitle}`);
            setIsNewRequestOpen(false);
        });
    };

    const getFormTitle = (resourceType: string) => {
        const matchingForm = availableForms.find(f => f.form_id === resourceType);
        if (matchingForm) return matchingForm.titulo;
        const formTitles: Record<string, string> = {
            'educacaoambientalForm': 'Educação Ambiental',
            'ecopontoForm': 'Atendimento em Ecoponto',
            'galpaoChamadaForm': 'Chamada de Cooperados',
        };
        return formTitles[resourceType] || resourceType;
    };

    const getStatusBadge = (sol: SolicitacaoPackage) => {
        if (sol.tarefa_arquivada === 1) {
            return (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200 flex items-center gap-1">
                    <Archive className="h-3 w-3" />
                    Arquivado
                </Badge>
            );
        }

        const canonicalStatus = sol.status;
        const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
            'aguardando_aprovacao': { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
            'submitted': { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
            'under_review': { label: 'Em Revisão', color: 'bg-amber-100 text-amber-800', icon: Clock },
            'a_fazer': { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
            'em_progresso': { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800', icon: Clock },
            'concluido': { label: 'Concluído', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
            'cancelado': { label: 'Rejeitado', color: 'bg-red-100 text-red-800', icon: XCircle },
            'approved': { label: 'Aprovado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
            'rejected': { label: 'Rejeitado', color: 'bg-red-100 text-red-800', icon: XCircle },
        };

        const config = statusConfig[canonicalStatus] || { label: canonicalStatus, color: 'bg-gray-100 text-gray-800', icon: Clock };
        const Icon = config.icon;

        return (
            <Badge className={`${config.color} flex items-center gap-1`}>
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
        );
    };

    const filteredSolicitacoes = solicitacoes.filter(sol => {
        if (currentTab === "todas") return true;
        if (currentTab === "pendentes") return sol.status === "aguardando_aprovacao" && sol.tarefa_arquivada !== 1;
        if (currentTab === "aprovadas") return ["a_fazer", "em_progresso", "concluido"].includes(sol.status) && sol.tarefa_arquivada !== 1;
        if (currentTab === "rejeitadas") return sol.status === "cancelado";
        if (currentTab === "arquivadas") return sol.tarefa_arquivada === 1;
        return true;
    });

    function renderTable(data: SolicitacaoPackage[]) {
        if (data.length === 0) {
            return <div className="text-center py-12 text-gray-500">Nenhuma solicitação encontrada.</div>;
        }

        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tipo de Formulário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data da Solicitação</TableHead>
                        <TableHead>Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((sol) => (
                        <TableRow key={sol.id_pacote}>
                            <TableCell>
                                <div className="font-medium">{getFormTitle(sol.tipo_recurso)}</div>
                                <div className="text-xs text-gray-500">{sol.tipo_recurso}</div>
                            </TableCell>
                            <TableCell>{getStatusBadge(sol)}</TableCell>
                            <TableCell>{new Date(sol.criado_em).toLocaleString('pt-BR')}</TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    <Button onClick={() => { setSelectedForView(sol); setShowViewDialog(true); }} variant="outline" size="sm">
                                        <Eye className="h-4 w-4 mr-1" />
                                        Ver
                                    </Button>
                                    {sol.status !== 'aguardando_aprovacao' && sol.tarefa_gerada_id && (
                                        <Link href={`/kanban?task_id=${sol.tarefa_gerada_id}`}>
                                            <Button variant="outline" size="sm" className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100">
                                                <ChevronRight className="h-4 w-4 mr-1" />
                                                Ver Tarefa
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-center">
                            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                            Carregando suas solicitações...
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Minhas Solicitações</CardTitle>
                            <CardDescription>Acompanhe o status das suas solicitações de tarefas</CardDescription>
                        </div>
                        <Button onClick={handleNewRequest}>
                            <Plus className="h-4 w-4 mr-2" />
                            Nova Solicitação
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                        <div className="flex justify-between items-center mb-4">
                            <TabsList>
                                <TabsTrigger value="todas">Todas ({solicitacoes.length})</TabsTrigger>
                                <TabsTrigger value="pendentes">
                                    Pendentes ({solicitacoes.filter(s => s.status === 'aguardando_aprovacao').length})
                                </TabsTrigger>
                                <TabsTrigger value="aprovadas">
                                    Aprovadas ({solicitacoes.filter(s => ['a_fazer','em_progresso','concluido'].includes(s.status)).length})
                                </TabsTrigger>
                                <TabsTrigger value="rejeitadas">
                                    Rejeitadas ({solicitacoes.filter(s => s.status === 'cancelado').length})
                                </TabsTrigger>
                                <TabsTrigger value="arquivadas">
                                    Arquivadas ({solicitacoes.filter(s => s.tarefa_arquivada === 1).length})
                                </TabsTrigger>
                            </TabsList>
                            <Button onClick={fetchSolicitacoes} variant="outline" size="sm">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Atualizar
                            </Button>
                        </div>
                        {["todas", "pendentes", "aprovadas", "rejeitadas", "arquivadas"].map(tab => (
                            <TabsContent key={tab} value={tab} className="mt-0">
                                {renderTable(filteredSolicitacoes)}
                                {hasMore && (
                                    <div className="flex justify-center py-4">
                                        <Button variant="outline" size="sm" onClick={loadMore}>
                                            Carregar mais
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>

            {/* Dialog de Visualização */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalhes da Solicitação</DialogTitle>
                    </DialogHeader>
                    {selectedForView && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div><strong>Tipo:</strong> {getFormTitle(selectedForView.tipo_recurso)}</div>
                                {getStatusBadge(selectedForView)}
                            </div>
                            <div><strong>Data de Criação:</strong> {new Date(selectedForView.criado_em).toLocaleString('pt-BR')}</div>
                            {selectedForView.revisado_em && (
                                <div><strong>Data de Revisão:</strong> {new Date(selectedForView.revisado_em).toLocaleString('pt-BR')}</div>
                            )}
                            {selectedForView.status === 'cancelado' && selectedForView.motivo_rejeicao && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded">
                                    <strong className="text-red-800">Motivo da Rejeição:</strong>
                                    <p className="mt-2 text-red-700">{selectedForView.motivo_rejeicao}</p>
                                </div>
                            )}
                            {['a_fazer','em_progresso','concluido'].includes(selectedForView.status) && selectedForView.tarefa_gerada_id && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded">
                                    <strong className="text-green-800">Tarefa Aprovada:</strong>
                                    <p className="mt-2 text-green-700">ID da Tarefa: {selectedForView.tarefa_gerada_id}</p>
                                </div>
                            )}
                            <div>
                                <strong>Dados do Formulário:</strong>
                                <pre className="mt-2 p-4 bg-gray-100 rounded text-sm overflow-x-auto">
                                    {JSON.stringify(JSON.parse(selectedForView.carga_json || '{}'), null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Dialog de Nova Solicitação */}
            <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nova Solicitação</DialogTitle>
                        <p className="text-sm text-gray-500">Selecione o tipo de solicitação que deseja realizar:</p>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                        {availableForms.length === 0 ? (
                            <p className="text-center py-4 text-gray-500 italic">Carregando formulários...</p>
                        ) : (
                            availableForms.map(form => (
                                <Button key={form.form_id} variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => openForm(form.form_id)}>
                                    <div className="flex flex-col items-start">
                                        <span className="font-semibold">{form.titulo}</span>
                                        <span className="text-xs text-gray-500">{form.form_id}</span>
                                    </div>
                                </Button>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
