"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchFormSchemasAtivos, fetchTarefaById, fetchPacotesRecentAtuais } from "@/src/interface/hooks/queries/lookups";
import type { TarefaRow, PacoteRow } from "@/src/interface/hooks/queries/lookups";
import { ReadOnlyFormRenderer } from "@/components/runtime/ReadOnlyFormRenderer";
import { useAuth } from "@/contexts/AuthContext";
import type { FormContent } from "@/types";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    "pendente": "secondary",
    "em_andamento": "default",
    "concluida": "outline",
    "cancelada": "destructive",
    "aberta": "secondary",
};

export default function TaskDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const [task, setTask] = useState<TarefaRow | null>(null);
    const [suites, setSuites] = useState<PacoteRow[]>([]);
    const [formSchemas, setFormSchemas] = useState<Map<string, FormContent>>(new Map());
    const [loading, setLoading] = useState(true);

    const activeAction = searchParams.get("action");

    useEffect(() => {
        if (!id || !user) return;
        let cancelled = false;
        setLoading(true);

        async function load() {
            try {
                const taskRow = await fetchTarefaById(id);
                if (cancelled) return;
                setTask(taskRow);
                if (!taskRow) { setLoading(false); return; }

                const pacoteRows = await fetchPacotesRecentAtuais();
                if (cancelled) return;
                setSuites(pacoteRows);

                const formRows = await fetchFormSchemasAtivos();
                if (cancelled) return;
                const map = new Map<string, FormContent>();
                for (const row of formRows) {
                    try {
                        map.set(row.form_id, JSON.parse(row.conteudo));
                    } catch { }
                }
                setFormSchemas(map);
            } catch { } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [id, user]);

    if (loading) {
        return (
            <div className="container mx-auto py-8 px-4">
                <p className="text-muted-foreground">Carregando...</p>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="container mx-auto py-8 px-4">
                <p className="text-muted-foreground">Tarefa não encontrada.</p>
                <Button variant="link" onClick={() => router.back()} className="mt-2 p-0">Voltar</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold">{task.titulo}</h1>
                        <Badge variant={statusVariant[task.status] ?? "secondary"}>
                            {task.status}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Criada em {new Date(task.created_at).toLocaleDateString("pt-BR")}
                        {task.prazo && ` · Prazo: ${new Date(task.prazo).toLocaleDateString("pt-BR")}`}
                    </p>
                </div>
                {activeAction && (
                    <Badge variant="default" className="text-xs">
                        Ação: {activeAction}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {suites.map((suite) => {
                        const schema = formSchemas.get(suite.tipo_modulo);
                        if (!schema) return null;

                        let values: Record<string, unknown> = {};
                        try { values = JSON.parse(suite.carga_json); } catch { }

                        return (
                            <Card key={suite.id_pacote}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            {schema.titulo || suite.tipo_modulo}
                                            <Badge variant="outline" className="text-[10px]">
                                                {suite.tipo_modulo}
                                            </Badge>
                                        </CardTitle>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(suite.criado_em).toLocaleDateString("pt-BR")}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <ReadOnlyFormRenderer
                                        schema={schema}
                                        values={values}
                                    />
                                </CardContent>
                            </Card>
                        );
                    })}

                    {suites.length === 0 && (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                Nenhum registro vinculado a esta tarefa.
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Metadados</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <span>{task.status}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Prioridade</span>
                                <span>{task.prioridade || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Atribuído</span>
                                <span className="truncate max-w-[120px]">{task.atribuido_para || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Setor</span>
                                <span>{task.setor_id || "—"}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
