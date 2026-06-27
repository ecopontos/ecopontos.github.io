"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContainerAsync } from "@/src/interface/hooks/catalog/utils";
import { fetchSetorById, fetchUsuarioNomeById } from "@/src/interface/hooks/queries/lookups";
import type { Demanda } from "@/src/domain/demanda/Demanda";
import type { DemandaEvento } from "@/src/domain/demanda/DemandaEvento";

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

export default function DemandaDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [demanda, setDemanda] = useState<Demanda | null>(null);
    const [eventos, setEventos] = useState<DemandaEvento[]>([]);
    const [setorNome, setSetorNome] = useState<string>("—");
    const [solicitanteNome, setSolicitanteNome] = useState<string>("—");
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        setLoading(true);

        async function load() {
            try {
                const c = await getContainerAsync();
                const d = await c.demandaRepository.findById(id);
                if (!d || cancelled) return;
                setDemanda(d);

                const evts = await c.demandaRepository.findEventos(id);
                if (!cancelled) setEventos(evts);

                const setor = await fetchSetorById(d.destinatarioId);
                if (!cancelled && setor) setSetorNome(setor.nome);

                const userNome = await fetchUsuarioNomeById(d.solicitanteId);
                if (!cancelled && userNome) setSolicitanteNome(userNome);
            } catch (e) {
                console.error("[DemandaDetail] erro:", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [id]);

    const handleAceitar = async () => {
        if (!demanda) return;
        setActionLoading(true);
        setActionMessage(null);
        try {
            const c = await getContainerAsync();
            await c.demandas.accept.execute({
                demandaId: demanda.id,
                aceitoPor: "desktop",
                tarefas: [],
            });
            setActionMessage("Demanda aceita com sucesso.");
            setDemanda({ ...demanda, status: "aceita" } as Demanda);
            const evts = await c.demandaRepository.findEventos(demanda.id);
            setEventos(evts);
        } catch (e: unknown) {
            setActionMessage(`Erro: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEncerrar = async () => {
        if (!demanda) return;
        setActionLoading(true);
        setActionMessage(null);
        try {
            const c = await getContainerAsync();
            await c.demandas.close.execute({
                demandaId: demanda.id,
                encerradoPor: "desktop",
            });
            setActionMessage("Demanda encerrada com sucesso.");
            setDemanda({ ...demanda, status: "concluida" } as Demanda);
            const evts = await c.demandaRepository.findEventos(demanda.id);
            setEventos(evts);
        } catch (e: unknown) {
            setActionMessage(`Erro: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto py-8 px-4">
                <p className="text-muted-foreground">Carregando...</p>
            </div>
        );
    }

    if (!demanda) {
        return (
            <div className="container mx-auto py-8 px-4">
                <p className="text-muted-foreground">Demanda não encontrada.</p>
                <Button variant="link" onClick={() => router.back()} className="mt-2 p-0">Voltar</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-6 px-4">
            <div className="flex items-center gap-3 mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.push("/demandas")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold">Demanda #{demanda.id.slice(0, 8)}</h1>
                        <Badge variant={STATUS_VARIANT[demanda.status] ?? "secondary"}>
                            {STATUS_LABEL[demanda.status] || demanda.status}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Criada em {new Date(demanda.criadaEm).toLocaleDateString("pt-BR")}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Descrição</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">
                                {demanda.descricao || "Sem descrição."}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Timeline de Eventos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {eventos.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
                            ) : (
                                <div className="space-y-3">
                                    {eventos.map((evt) => (
                                        <div key={evt.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                                            <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {evt.type}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(evt.createdAt).toLocaleString("pt-BR")}
                                                    </span>
                                                </div>
                                                <pre className="text-xs mt-1 text-slate-600 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                                                    {JSON.stringify(evt.payload, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Detalhes</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant={STATUS_VARIANT[demanda.status] ?? "secondary"}>
                                    {STATUS_LABEL[demanda.status] || demanda.status}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Origem</span>
                                <span>{demanda.origemTipo}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Solicitante</span>
                                <span className="truncate max-w-[120px]">{solicitanteNome}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Setor Destino</span>
                                <span className="truncate max-w-[120px]">{setorNome}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tipo de Ação</span>
                                <span>{demanda.tipoAcao || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Política</span>
                                <span>{demanda.politicaConclusao === "todas" ? "Todas as tarefas" : "Declarado"}</span>
                            </div>
                            {demanda.aceitoEm && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Aceita em</span>
                                    <span>{new Date(demanda.aceitoEm).toLocaleDateString("pt-BR")}</span>
                                </div>
                            )}
                            {demanda.encerradoEm && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Encerrada em</span>
                                    <span>{new Date(demanda.encerradoEm).toLocaleDateString("pt-BR")}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Ações</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {demanda.status === "aberta" && (
                                <Button
                                    className="w-full"
                                    onClick={handleAceitar}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? "Processando..." : "Aceitar Demanda"}
                                </Button>
                            )}
                            {demanda.status === "aceita" && (
                                <Button
                                    className="w-full"
                                    variant="destructive"
                                    onClick={handleEncerrar}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? "Processando..." : "Encerrar Demanda"}
                                </Button>
                            )}
                            {demanda.status === "concluida" && (
                                <p className="text-sm text-muted-foreground text-center">
                                    Demanda já encerrada.
                                </p>
                            )}
                            {actionMessage && (
                                <p className={`text-xs mt-2 ${actionMessage.startsWith("Erro") ? "text-destructive" : "text-emerald-600"}`}>
                                    {actionMessage}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
