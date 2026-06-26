"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, ArrowLeft, Loader2, FileJson } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getContainerAsync } from "@/src/interface/hooks/utils/useContainer";
import { ProtectedPage } from "@/components/auth/PermissionGuards";
import Link from "next/link";
import type { DadosTitular } from "@/src/application/usuario/ExportacaoDadosTitularUseCase";

export default function ExportarTitularPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [dados, setDados] = useState<DadosTitular | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleExportar = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const c = await getContainerAsync();
            const d = await c.exportacaoDadosTitularUseCase.execute(id, user.perfil);
            setDados(d);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!dados) return;
        const json = JSON.stringify(dados, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dados_titular_${id}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <ProtectedPage permission="users.view_all">
            <div className="space-y-6 max-w-2xl">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin/users"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <FileJson className="h-5 w-5" />
                            Exportação de Dados do Titular
                        </h1>
                        <p className="text-sm text-muted-foreground">LGPD Art. 18, V — portabilidade de dados</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Usuário: <code className="font-mono text-sm bg-muted px-1 rounded">{id}</code></CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Gera um arquivo JSON com todos os dados pessoais do titular: perfil, tarefas, agendamentos, manifestações e log de ações.
                        </p>

                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
                        )}

                        {!dados && (
                            <Button onClick={handleExportar} disabled={loading}>
                                {loading
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
                                    : <><FileJson className="mr-2 h-4 w-4" />Gerar exportação</>
                                }
                            </Button>
                        )}

                        {dados && (
                            <div className="space-y-4">
                                {/* Resumo */}
                                <div className="rounded-md border p-3 space-y-2">
                                    <p className="text-sm font-medium">Resumo da exportação</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline">
                                            Usuário: {dados.usuario ? dados.usuario.nome as string : "não encontrado"}
                                        </Badge>
                                        <Badge variant="outline">{dados.tarefas.length} tarefa(s)</Badge>
                                        <Badge variant="outline">{dados.agendamentos.length} agendamento(s)</Badge>
                                        <Badge variant="outline">{dados.manifestacoes.length} manifestação(ões)</Badge>
                                        <Badge variant="outline">{dados.log_acoes.length} entrada(s) de log</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Gerado em: {new Date(dados.exportadoEm).toLocaleString("pt-BR")}
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <Button onClick={handleDownload} className="flex-1">
                                        <Download className="mr-2 h-4 w-4" />
                                        Baixar JSON
                                    </Button>
                                    <Button variant="outline" onClick={handleExportar} disabled={loading}>
                                        Regerar
                                    </Button>
                                </div>
                            </div>
                        )}

                        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/users")}>
                            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                            Voltar
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </ProtectedPage>
    );
}
