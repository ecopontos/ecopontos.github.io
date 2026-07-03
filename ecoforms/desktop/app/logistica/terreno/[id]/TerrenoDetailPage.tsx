"use client";
/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Página de detalhe do terreno (Fase 4 — georreferenciamento).
 * Hospeda o cadastro de pontos operacionais. Mata o dead link
 * /logistica/terreno/${id} que já existia no popup de useGeoDataLayers.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, Plus, Save, Trash2, Star } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouteParamOrQuery } from "@/src/interface/hooks/routing/useRouteParamOrQuery";
import { fetchTerrenoById } from "@/src/interface/hooks/queries/lookups/geo";
import { usePontosOperacionais, usePontoOperacionalMutations } from "@/src/interface/hooks/queries/usePontoOperacional";
import { computeCentroid } from "@/src/interface/hooks/queries/useMapData";
import { PontoOperacionalMap } from "@/components/logistics/PontoOperacionalMap";
import { PONTO_OPERACIONAL_TIPOS, type PontoOperacionalTipo } from "@/types/clientes";
import { uuidv7 } from "ecoforms-core";
import { toast } from "sonner";

interface TerrenoData {
    id: string;
    nome: string;
    codigo_cadastral?: string | null;
    tipo?: string | null;
    geojson: string;
    centroid_lat?: number | null;
    centroid_lng?: number | null;
    area_m2?: number | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
}

export default function TerrenoDetailPage() {
    const id = useRouteParamOrQuery("id");
    const [terreno, setTerreno] = useState<TerrenoData | null>(null);
    const [loading, setLoading] = useState(true);

    const { data: pontos, loading: loadingPontos, refetch: refetchPontos } = usePontosOperacionais(id);
    const { insert, update, remove, setPrincipal, loading: saving } = usePontoOperacionalMutations();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        tipo: "coleta" as PontoOperacionalTipo,
        latitude: 0,
        longitude: 0,
        principal: false,
        observacao: "",
    });
    const [showForm, setShowForm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetchTerrenoById(id)
            .then((row) => {
                if (row) setTerreno(row as unknown as TerrenoData);
            })
            .finally(() => setLoading(false));
    }, [id]);

    const geometria = useMemo<GeoJSON.Geometry | null>(() => {
        if (!terreno?.geojson) return null;
        try {
            return JSON.parse(terreno.geojson) as GeoJSON.Geometry;
        } catch {
            return null;
        }
    }, [terreno]);

    const centroide = useMemo<[number, number] | null>(() => (geometria ? computeCentroid(geometria) : null), [geometria]);

    // Rascunho da coordenada no mapa ([lng, lat]).
    const [rascunho, setRascunho] = useState<[number, number] | null>(null);

    function iniciarNovo() {
        if (!centroide) { toast.error("Terreno sem geometria para sugerir coordenada"); return; }
        setEditingId(null);
        setForm({ tipo: "coleta", latitude: centroide[1], longitude: centroide[0], principal: false, observacao: "" });
        setRascunho(centroide);
        setShowForm(true);
    }

    function iniciarEdicao(p: typeof pontos[number]) {
        setEditingId(p.id);
        setForm({
            tipo: (p.tipo ?? "coleta") as PontoOperacionalTipo,
            latitude: p.latitude,
            longitude: p.longitude,
            principal: p.principal === 1,
            observacao: p.observacao ?? "",
        });
        setRascunho([p.longitude, p.latitude]);
        setShowForm(true);
    }

    function handleRascunhoChange(lngLat: [number, number]) {
        setRascunho(lngLat);
        setForm((prev) => ({ ...prev, longitude: lngLat[0], latitude: lngLat[1] }));
    }

    function usarCentroide() {
        if (!centroide) return;
        setRascunho(centroide);
        setForm((prev) => ({ ...prev, longitude: centroide[0], latitude: centroide[1] }));
    }

    async function salvar() {
        if (!id) return;
        try {
            if (editingId) {
                await update({
                    id: editingId,
                    tipo: form.tipo,
                    latitude: form.latitude,
                    longitude: form.longitude,
                    observacao: form.observacao || null,
                });
                if (form.principal) await setPrincipal(editingId, id);
                toast.success("Ponto atualizado");
            } else {
                await insert({
                    id: uuidv7(),
                    imovel_id: id,
                    tipo: form.tipo,
                    latitude: form.latitude,
                    longitude: form.longitude,
                    principal: form.principal,
                    origem: "manual",
                    observacao: form.observacao || null,
                });
                toast.success("Ponto criado");
            }
            setShowForm(false);
            setEditingId(null);
            refetchPontos();
        } catch {
            toast.error("Erro ao salvar ponto");
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await remove(deleteTarget.id);
            toast.success("Ponto removido");
            refetchPontos();
        } catch {
            toast.error("Erro ao remover ponto");
        } finally {
            setDeleteTarget(null);
        }
    }

    if (loading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
    if (!terreno || !geometria) {
        return (
            <div className="p-6 space-y-3">
                <Link href="/logistica"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button></Link>
                <p className="text-muted-foreground">Terreno não encontrado.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <Link href="/logistica"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button></Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />{terreno.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        {[terreno.codigo_cadastral, terreno.bairro, terreno.cidade, terreno.estado].filter(Boolean).join(" · ") || "Sem informações adicionais"}
                    </p>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Tipo: </span>{terreno.tipo ?? "—"}</div>
                    <div><span className="text-muted-foreground">Área: </span>{terreno.area_m2 ? `${Math.round(terreno.area_m2)} m²` : "—"}</div>
                    <div><span className="text-muted-foreground">Centroide: </span>{centroide ? `${centroide[1].toFixed(6)}, ${centroide[0].toFixed(6)}` : "—"}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex items-center justify-between">
                    <div>
                        <CardTitle>Pontos operacionais</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Pontos práticos (entrada, coleta, portaria). O principal é usado na roteirização no lugar do centroide.
                        </p>
                    </div>
                    <Button size="sm" onClick={iniciarNovo}><Plus className="h-4 w-4 mr-1" />Novo ponto</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <PontoOperacionalMap
                        geometria={geometria}
                        pontos={pontos}
                        rascunho={showForm ? rascunho : null}
                        onRascunhoChange={handleRascunhoChange}
                    />

                    {showForm && (
                        <div className="p-4 border rounded-md bg-muted/30 space-y-3">
                            <h3 className="font-medium">{editingId ? "Editar ponto" : "Novo ponto operacional"}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Tipo</Label>
                                    <select
                                        value={form.tipo}
                                        onChange={(e) => setForm({ ...form, tipo: e.target.value as PontoOperacionalTipo })}
                                        className="w-full border rounded-md px-3 py-2"
                                    >
                                        {PONTO_OPERACIONAL_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Observação</Label>
                                    <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Opcional" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Latitude</Label>
                                    <Input value={form.latitude?.toString() ?? ""} type="number" step="any"
                                        onChange={(e) => { const v = Number(e.target.value); setForm({ ...form, latitude: v }); if (!Number.isNaN(v)) setRascunho([form.longitude, v]); }} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Longitude</Label>
                                    <Input value={form.longitude?.toString() ?? ""} type="number" step="any"
                                        onChange={(e) => { const v = Number(e.target.value); setForm({ ...form, longitude: v }); if (!Number.isNaN(v)) setRascunho([v, form.latitude]); }} />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="checkbox" checked={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.checked })} />
                                    Principal (usado na roteirização)
                                </label>
                                <Button size="sm" variant="outline" onClick={usarCentroide}>Usar centroide</Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Arraste o marcador laranja no mapa para ajustar a posição.</p>
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
                                <Button size="sm" onClick={salvar} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
                            </div>
                        </div>
                    )}

                    {loadingPontos ? (
                        <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : pontos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum ponto operacional cadastrado.</p>
                    ) : (
                        <div className="space-y-2">
                            {pontos.map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-3 p-3 border rounded-md hover:bg-muted/30">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium">{p.tipo ?? "ponto"}</span>
                                            {p.principal === 1 && <Badge className="text-[10px]">principal</Badge>}
                                            {p.origem && <Badge variant="secondary" className="text-[10px]">{p.origem}</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}
                                            {p.observacao ? ` · ${p.observacao}` : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Definir como principal"
                                            onClick={async () => { try { await setPrincipal(p.id, p.imovel_id); toast.success("Definido como principal"); refetchPontos(); } catch { toast.error("Erro"); } }}>
                                            <Star className={`h-4 w-4 ${p.principal === 1 ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => iniciarEdicao(p)}>Editar</Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => setDeleteTarget({ id: p.id, label: p.tipo ?? "ponto" })}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover ponto operacional</AlertDialogTitle>
                        <AlertDialogDescription>Remover o ponto &quot;{deleteTarget?.label}&quot;? Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
