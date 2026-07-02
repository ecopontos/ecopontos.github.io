"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { Fragment, useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouteParamOrQuery } from "@/src/interface/hooks/routing/useRouteParamOrQuery";
import { ArrowLeft, Plus, Trash2, Save, Truck, Users, ChevronUp, ChevronDown, Printer, Search, ClipboardCheck, Scale, RefreshCw, MapPin, Wand2, Route, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { uuidv7 } from 'ecoforms-core';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoteiroById, useClientesByRoteiro, useExecucoes } from "@/src/interface/hooks/catalog/logistica";
import { usePesagensByExecucao, useExternalPesagensSync } from "@/src/interface/hooks/catalog/logistica";
import { useLogisticsMutations } from "@/src/interface/hooks/catalog/logistica";
import { useClientes } from "@/src/interface/hooks/catalog/clientes";
import { useAllUsers } from "@/src/interface/hooks/catalog/auth";
import { useExecucaoClientes } from "@/src/interface/hooks/catalog/logistica";
import { useExecucaoClientesMutations } from "@/src/interface/hooks/catalog/logistica";
import type { Roteiro, RoteiroCliente, ExecucaoColeta } from "@/src/domain/logistics/LogisticsRepository";
import type { ItinerarioStop } from "@/src/interface/hooks/catalog/logistica";
import { ExecucaoColetaStateMachine } from "@/src/domain/logistics/ExecucaoColetaStateMachine";
import { NovaExecucaoDialog } from "@/components/logistics/NovaExecucaoDialog";
import ItinerarioMap from "@/components/logistics/ItinerarioMap";
import { useItinerario, useClientesGeo, useTerrenos } from "@/src/interface/hooks/catalog/logistica";
import {
  nearestNeighborOrder,
  countSemLocalizacao,
  totalRouteKm,
  deriveCoordOrigem,
  deriveMotivoSemLocalizacao,
  COORD_ORIGEM_LABELS,
  MOTIVO_SEM_LOCALIZACAO_LABELS,
  type GeoStop,
} from "@/lib/itinerary";
import { toast } from "sonner";
import { useAuth } from "@/src/interface/hooks/catalog/auth";

function htmlEscape(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function RoteiroDetailPage() {
  const searchParams = useSearchParams();
  const id = useRouteParamOrQuery("id");
  // Deep-link vindo da página principal: /logistica/roteiros/[id]?exec=...&panel=coleta
  const deepLinkExecId = searchParams.get("exec");
  const deepLinkPanel = searchParams.get("panel");
  const { roteiro, loading } = useRoteiroById(id);
  const { saveRoteiro, addClienteToRoteiro, removeClienteFromRoteiro, updateClienteOrdem, updateClienteOrdemBatch, transicaoExecucaoStatus, loading: saving } = useLogisticsMutations();
  const { data: clientesRoteiro, refetch: refetchClientes } = useClientesByRoteiro(id);
  const { data: execucoes, refetch: refetchExecucoes } = useExecucoes(id ? { roteiroId: id } : undefined);
  const { user } = useAuth();
  const { users: usuarios } = useAllUsers();

  // Aba Mapa (G1/G2/G3): itinerário geocodificado + camadas reutilizando ItinerarioMap.
  const { data: itinerario } = useItinerario(id);
  const { data: clientesGeo } = useClientesGeo();
  const { data: terrenosGeo } = useTerrenos();
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);

  const geoStops: GeoStop[] = useMemo(() => {
    const coordById = new Map(
      (itinerario || []).map((s) => [s.cliente_id, { lat: s.latitude, lng: s.longitude }]),
    );
    return [...(clientesRoteiro || [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((c) => ({
        id: c.clienteId,
        lat: coordById.get(c.clienteId)?.lat ?? null,
        lng: coordById.get(c.clienteId)?.lng ?? null,
      }));
  }, [clientesRoteiro, itinerario]);

  const semLocMapa = countSemLocalizacao(geoStops);
  const totalKmMapa = totalRouteKm(geoStops);

  const itinerarioByCliente = useMemo(() => {
    const map = new Map<string, ItinerarioStop>();
    for (const s of itinerario || []) map.set(s.cliente_id, s);
    return map;
  }, [itinerario]);

  // Paradas sem localização resolvida (latitude/longitude nulos), com o motivo provável —
  // ver deriveMotivoSemLocalizacao (desktop/lib/itinerary.ts).
  const paradasSemLocalizacao = useMemo(
    () =>
      [...(itinerario || [])]
        .filter((s) => deriveMotivoSemLocalizacao(s) !== null)
        .sort((a, b) => a.ordem - b.ordem),
    [itinerario],
  );

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<typeof roteiro>>({});
  const [showAddExecucao, setShowAddExecucao] = useState(false);
  const [pesagensExpandida, setPesagensExpandida] = useState<string | null>(null);
  const [coletaExpandida, setColetaExpandida] = useState<string | null>(
    deepLinkExecId && (deepLinkPanel === "coleta" || !deepLinkPanel) ? deepLinkExecId : null
  );

  if (loading) return <p className="p-8">Carregando...</p>;
  if (!roteiro) return <p className="p-8">Roteiro não encontrado.</p>;

  const handleEdit = () => { setForm({ ...roteiro }); setEditMode(true); };
  const handleSave = async () => {
    try { await saveRoteiro({ ...roteiro, ...form } as Parameters<typeof saveRoteiro>[0]); toast.success("Roteiro atualizado"); setEditMode(false); }
    catch { toast.error("Erro ao salvar"); }
  };

  const handleRemoveCliente = async (clienteId: string) => {
    try {
      await removeClienteFromRoteiro(id!, clienteId);
      toast.success("Cliente removido");
      refetchClientes();
    } catch { toast.error("Erro ao remover cliente"); }
  };

  // Reordena o itinerário por proximidade (vizinho mais próximo, distância em linha reta —
  // não é cálculo de rota viária, ver lib/itinerary.ts).
  const handleOptimizeOrdem = async () => {
    if (geoStops.filter((s) => s.lat != null && s.lng != null).length < 3) {
      toast.error("Pontos com localização insuficientes para otimizar.");
      return;
    }
    const sortedNow = [...clientesRoteiro].sort((a, b) => a.ordem - b.ordem);
    const orderedIds = nearestNeighborOrder(geoStops);
    const changes = orderedIds
      .map((cid, i) => ({ clienteId: cid, ordem: i + 1 }))
      .filter((c) => sortedNow.find((s) => s.clienteId === c.clienteId)?.ordem !== c.ordem);
    if (changes.length === 0) {
      toast.info("Itinerário já está com a ordem otimizada por proximidade.");
      return;
    }
    try {
      await updateClienteOrdemBatch(id!, changes);
      toast.success("Ordem do itinerário otimizada por proximidade");
      refetchClientes();
    } catch { toast.error("Erro ao otimizar ordem do itinerário"); }
  };

  const handleMoveUp = async (clienteId: string, currentOrdem: number) => {
    const sorted = [...clientesRoteiro].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex(c => c.clienteId === clienteId);
    if (idx <= 0) return;
    try {
      await updateClienteOrdem(id!, sorted[idx - 1].clienteId, currentOrdem);
      await updateClienteOrdem(id!, clienteId, sorted[idx - 1].ordem);
      toast.success("Ordem alterada");
    } catch { toast.error("Erro ao reordenar"); }
    finally { refetchClientes(); }
  };

  const handleMoveDown = async (clienteId: string, currentOrdem: number) => {
    const sorted = [...clientesRoteiro].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex(c => c.clienteId === clienteId);
    if (idx >= sorted.length - 1) return;
    try {
      await updateClienteOrdem(id!, sorted[idx + 1].clienteId, currentOrdem);
      await updateClienteOrdem(id!, clienteId, sorted[idx + 1].ordem);
      toast.success("Ordem alterada");
    } catch { toast.error("Erro ao reordenar"); }
    finally { refetchClientes(); }
  };

  const handlePrintItinerario = () => {
    const sorted = [...clientesRoteiro].sort((a, b) => a.ordem - b.ordem);
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    const rows = sorted.map((c, i) =>
      `<tr><td>${i + 1}</td><td>${htmlEscape(c.clienteNome || c.clienteId)}</td><td>${htmlEscape(c.observacao)}</td><td style="width:40px"></td><td style="width:200px"></td></tr>`
    ).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Itinerário - ${htmlEscape(roteiro.nome)}</title>
<style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px;margin-bottom:4px}p{margin:2px 0;font-size:12px;color:#666}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #999;padding:6px;font-size:12px;text-align:left}th{background:#eee}@media print{button{display:none}}</style></head><body>
<h1>${htmlEscape(roteiro.nome)}</h1><p>Base: ${htmlEscape(roteiro.base)} | Turno: ${htmlEscape(roteiro.turno)} | Periodicidade: ${htmlEscape(roteiro.periodicidade)}</p>
<table><thead><tr><th>Ordem</th><th>Cliente</th><th>Obs</th><th>Coletado</th><th>Ocorrência</th></tr></thead><tbody>${rows}</tbody></table>
<button onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir</button>
</body></html>`);
    w.document.close();
  };


  const handleTransicaoStatus = async (execucaoId: string, novoStatus: string) => {
    try {
      await transicaoExecucaoStatus(execucaoId, novoStatus);
      toast.success(`Status alterado para "${novoStatus}"`);
      refetchExecucoes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar status");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/logistica">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{roteiro.nome}</h1>
          <p className="text-sm text-muted-foreground">{roteiro.descricao || "Sem descrição"}</p>
        </div>
        <Badge variant={roteiro.situacao === "ativo" ? "default" : "outline"}>{roteiro.situacao}</Badge>
        {!editMode ? (
          <Button onClick={handleEdit} variant="outline">Editar</Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" />Salvar</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Tipo de Resíduo</CardDescription></CardHeader><CardContent><p className="font-medium">{roteiro.tipoResiduo || "—"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Periodicidade</CardDescription></CardHeader><CardContent><p className="font-medium">{roteiro.periodicidade || "—"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Turno</CardDescription></CardHeader><CardContent><p className="font-medium">{roteiro.turno || "—"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Base</CardDescription></CardHeader><CardContent><p className="font-medium">{roteiro.base || "—"}</p></CardContent></Card>
      </div>

      <Tabs defaultValue={deepLinkExecId ? "execucoes" : "clientes"}>
        <TabsList>
          <TabsTrigger value="clientes"><Users className="h-4 w-4 mr-1" />Clientes</TabsTrigger>
          <TabsTrigger value="mapa"><MapPin className="h-4 w-4 mr-1" />Mapa</TabsTrigger>
          <TabsTrigger value="execucoes"><Truck className="h-4 w-4 mr-1" />Execuções</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Clientes do Roteiro</CardTitle>
              <div className="flex gap-2">
                <ClienteSearch
                  roteiroId={id!}
                  existingClientIds={clientesRoteiro.map(c => c.clienteId)}
                  onSelect={async (clienteId, clienteNome) => {
                    try {
                      const maxOrdem = clientesRoteiro.reduce((max, c) => Math.max(max, c.ordem), 0);
                      await addClienteToRoteiro({
                        id: uuidv7(), roteiroId: id!, clienteId, ordem: maxOrdem + 1, ativo: 1,
                      } as RoteiroCliente);
                      toast.success(`${clienteNome} vinculado`);
                      await refetchClientes();
                    } catch { toast.error("Erro ao vincular cliente"); }
                  }}
                />
                <Button size="sm" variant="outline" onClick={handlePrintItinerario} disabled={clientesRoteiro.length === 0}>
                  <Printer className="h-4 w-4 mr-1" />Imprimir
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {clientesRoteiro.length === 0 ? (
                <p className="text-muted-foreground">Nenhum cliente vinculado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead className="w-10">#</TableHead><TableHead>Nome</TableHead><TableHead>Observação</TableHead><TableHead className="w-44">Localização</TableHead><TableHead className="w-20"></TableHead><TableHead className="w-10"></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...clientesRoteiro].sort((a, b) => a.ordem - b.ordem).map((c, idx) => {
                      const stop = itinerarioByCliente.get(c.clienteId);
                      const coordOrigem = stop ? deriveCoordOrigem(stop) : null;
                      const motivo = stop ? deriveMotivoSemLocalizacao(stop) : null;
                      return (
                      <TableRow key={c.id}>
                        <TableCell className="text-muted-foreground text-sm">{c.ordem}</TableCell>
                        <TableCell>{c.clienteNome || c.clienteId}</TableCell>
                        <TableCell>{c.observacao || "—"}</TableCell>
                        <TableCell>
                          {coordOrigem ? (
                            <span className="text-xs text-muted-foreground" title={`Origem da coordenada: ${COORD_ORIGEM_LABELS[coordOrigem]}`}>
                              {COORD_ORIGEM_LABELS[coordOrigem]}
                            </span>
                          ) : (
                            <span
                              className="text-xs text-amber-600 inline-flex items-center gap-1"
                              title={motivo ? MOTIVO_SEM_LOCALIZACAO_LABELS[motivo] : "Sem localização"}
                            >
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {motivo ? MOTIVO_SEM_LOCALIZACAO_LABELS[motivo] : "Sem localização"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Mover para cima"
                              onClick={() => handleMoveUp(c.clienteId, c.ordem)} disabled={idx === 0 || saving}>
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Mover para baixo"
                              onClick={() => handleMoveDown(c.clienteId, c.ordem)} disabled={idx === clientesRoteiro.length - 1 || saving}>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleRemoveCliente(c.clienteId)} disabled={saving}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapa" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />Mapa do Itinerário</CardTitle>
                <CardDescription className="flex items-center gap-3 mt-1 flex-wrap">
                  {totalKmMapa > 0 && (
                    <span
                      className="inline-flex items-center gap-1"
                      title="Distância em linha reta entre as paradas — aproximação, não é um cálculo de rota viária"
                    >
                      <Route className="h-3 w-3" />{totalKmMapa.toFixed(1)} km — rota aproximada (linha reta)
                    </span>
                  )}
                  {semLocMapa > 0 && (
                    <span className="text-amber-600 inline-flex items-center gap-1" title="Pontos sem coordenada não aparecem no mapa nem entram na otimização da ordem">
                      <AlertTriangle className="h-3 w-3" />{semLocMapa} de {clientesRoteiro.length} sem localização
                    </span>
                  )}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleOptimizeOrdem}
                disabled={saving || clientesRoteiro.length < 3}
                title="Otimizar ordem por proximidade (vizinho mais próximo, distância em linha reta)"
              >
                <Wand2 className="h-4 w-4 mr-1" />Otimizar ordem por proximidade
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {paradasSemLocalizacao.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs space-y-1">
                  <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {paradasSemLocalizacao.length} parada(s) sem localização resolvida
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                    {paradasSemLocalizacao.map((s) => {
                      const motivo = deriveMotivoSemLocalizacao(s);
                      return (
                        <li key={s.cliente_id} className="text-amber-800 dark:text-amber-300 truncate">
                          {s.nome} — {motivo ? MOTIVO_SEM_LOCALIZACAO_LABELS[motivo] : "motivo desconhecido"}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {clientesRoteiro.length === 0 ? (
                <p className="text-muted-foreground">Nenhum cliente vinculado — adicione pontos na aba Clientes.</p>
              ) : (
                <div className="h-[60vh] min-h-[420px] rounded-md overflow-hidden border">
                  <ItinerarioMap
                    clientesGeo={clientesGeo || []}
                    itinerario={itinerario || []}
                    terrenosGeo={terrenosGeo || []}
                    selectedClienteId={mapSelectedId}
                    onClienteClick={setMapSelectedId}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execucoes" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Execuções</CardTitle>
              <Button size="sm" onClick={() => setShowAddExecucao(true)}><Plus className="h-4 w-4 mr-1" />Nova</Button>
            </CardHeader>
            <CardContent>
              {execucoes.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma execução agendada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead>Motorista</TableHead><TableHead>Veículo</TableHead><TableHead className="w-32">Ações</TableHead><TableHead></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {execucoes.map(e => {
                      const transicoes = ExecucaoColetaStateMachine.getTransitionsFrom(e.status);
                      const isTerminal = ExecucaoColetaStateMachine.isTerminal(e.status);
                      return (
                      <Fragment key={e.id}>
                        <TableRow>
                          <TableCell>{new Date(e.dataExecucao).toLocaleDateString()}</TableCell>
                          <TableCell><Badge variant={e.status === "concluida" ? "default" : e.status === "em_execucao" || e.status === "em_transito" ? "secondary" : "outline"}>{e.status}</Badge></TableCell>
                          <TableCell>{e.motoristaNome || "—"}</TableCell>
                          <TableCell>{e.veiculo || "—"}</TableCell>
                          <TableCell className="flex gap-1 flex-wrap">
                            {!isTerminal && transicoes.filter(s => s !== "cancelada").map(s => {
                              const labels: Record<string, string> = { em_transito: "Iniciar", em_execucao: "Em Execução", concluida: "Concluir" };
                              return (
                                <Button key={s} size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleTransicaoStatus(e.id, s)} disabled={saving}>
                                  {labels[s] || s}
                                </Button>
                              );
                            })}
                            {!isTerminal && (
                              <Button size="sm" variant="outline" className="h-6 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => handleTransicaoStatus(e.id, "cancelada")} disabled={saving}>
                                Cancelar
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="flex gap-1 flex-wrap">
                             <Button size="sm" variant={coletaExpandida === e.id ? "secondary" : "outline"} className="h-7 text-xs gap-1" title="Registrar coleta (quantidade por ponto)" onClick={() => { setColetaExpandida(coletaExpandida === e.id ? null : e.id); setPesagensExpandida(null); }}>
                               <ClipboardCheck className="h-3.5 w-3.5" />Coleta
                             </Button>
                             <Button size="sm" variant={pesagensExpandida === e.id ? "secondary" : "ghost"} className="h-7 text-xs gap-1" title="Pesagens (despacho/balança)" onClick={() => { setPesagensExpandida(pesagensExpandida === e.id ? null : e.id); setColetaExpandida(null); }}>
                               <Scale className="h-3.5 w-3.5" />Pesagens
                            </Button>
                             <Link href={`/logistica?tab=mapa&roteiro=${e.roteiroId}&exec=${e.id}`}>
                               <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" title="Ver execução no mapa (coleta, intercorrências, checklist)">
                                 <MapPin className="h-3.5 w-3.5" />Mapa
                               </Button>
                             </Link>
                          </TableCell>
                        </TableRow>

                        {coletaExpandida === e.id && (
                          <TableRow key={`${e.id}-coleta`}>
                            <TableCell colSpan={6}>
                              <ColetaRegistroPanel execucaoId={e.id} roteiroId={e.roteiroId} />
                            </TableCell>
                          </TableRow>
                        )}
                        {pesagensExpandida === e.id && (
                          <TableRow key={`${e.id}-pesagens`}>
                            <TableCell colSpan={6}>
                              <PesagensPanel execucao={e} onSynced={refetchExecucoes} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NovaExecucaoDialog
        open={showAddExecucao}
        onClose={() => setShowAddExecucao(false)}
        onSaved={refetchExecucoes}
        roteiroId={id!}
        usuarios={usuarios}
      />
    </div>
  );
}

function ClienteSearch({ roteiroId, existingClientIds, onSelect }: {
  roteiroId: string;
  existingClientIds: string[];
  onSelect: (clienteId: string, clienteNome: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: allClientes, loading } = useClientes(search ? { searchTerm: search } : undefined);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() =>
    (allClientes || []).filter(c => !existingClientIds.includes(c.id)),
    [allClientes, existingClientIds]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-64">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          className="pl-8"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && search.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
          {loading ? (
            <p className="p-2 text-sm text-muted-foreground">Buscando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            filtered.slice(0, 20).map(c => (
              <button
                key={c.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                onClick={() => {
                  onSelect(c.id, c.nome);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <span>{c.nome}</span>
                <span className="text-xs text-muted-foreground">{c.tipo} {c.documento ? `· ${c.documento}` : ''}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface ColetaRowState { coletaRealizada: boolean; quantidade: string; ocorrencia: string }
const emptyColetaRow: ColetaRowState = { coletaRealizada: false, quantidade: '', ocorrencia: '' };

function ColetaRegistroPanel({ execucaoId, roteiroId }: { execucaoId: string; roteiroId: string }) {
   const { user } = useAuth();
   const { data: clientesRoteiro, loading: loadingClientes } = useClientesByRoteiro(roteiroId);
   const { data: execucaoClientes, loading: loadingExecClientes, refetch: refetchExecClientes } = useExecucaoClientes(execucaoId);
   const { batchSaveExecucaoClientes, loading: saving } = useExecucaoClientesMutations();
   const [localState, setLocalState] = useState<Record<string, ColetaRowState>>({});
   const [rapidQuery, setRapidQuery] = useState("");
   const rapidRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
     const map: Record<string, ColetaRowState> = {};
     for (const ec of execucaoClientes) {
       map[ec.clienteId] = {
         coletaRealizada: !!ec.coletaRealizada,
         quantidade: ec.quantidade != null ? String(ec.quantidade) : '',
         ocorrencia: ec.ocorrencia || '',
       };
     }
     setLocalState(map);
   }, [execucaoClientes]);

    const sorted = [...clientesRoteiro].sort((a, b) => a.ordem - b.ordem);

    const filtered = useMemo(() => {
      const q = rapidQuery.trim().toLowerCase();
      if (!q) return sorted;
      return sorted.filter(c =>
        String(c.ordem).includes(q) ||
        (c.clienteNome || c.clienteId).toLowerCase().includes(q)
      );
    }, [sorted, rapidQuery]);

    const patchRow = (clienteId: string, patch: Partial<ColetaRowState>) =>
      setLocalState(prev => ({ ...prev, [clienteId]: { ...(prev[clienteId] || emptyColetaRow), ...patch } }));

    // Entrada rápida: digita a ordem (número exato) ou parte do nome → foca a quantidade da linha
    const handleRapidJump = () => {
      const q = rapidQuery.trim().toLowerCase();
      if (!q) return;
      const match =
        sorted.find(c => String(c.ordem) === q) ||
        sorted.find(c => (c.clienteNome || c.clienteId).toLowerCase().includes(q));
      if (!match) {
        rapidRef.current?.classList.add("ring-2", "ring-red-400");
        setTimeout(() => rapidRef.current?.classList.remove("ring-2", "ring-red-400"), 500);
        return;
      }
      setRapidQuery("");
      setTimeout(() => {
        const el = document.getElementById(`qty-${match.clienteId}`) as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }, 0);
    };

   const handleSave = async () => {
     try {
       const items = sorted.map(c => {
         const s = localState[c.clienteId] || emptyColetaRow;
         const qtd = s.quantidade.trim() === '' ? null : Number(s.quantidade);
         return {
           clienteId: c.clienteId,
           // qtd > 0 marca coleta como realizada (espelha o checklist do app de campo)
           coletaRealizada: (s.coletaRealizada || (qtd != null && qtd > 0)) ? 1 : 0,
           quantidade: qtd,
           ocorrencia: s.ocorrencia || undefined,
         };
       });
       const { saved, failed } = await batchSaveExecucaoClientes(items, execucaoId, user?.id ?? '');
       if (failed.length === 0) {
         toast.success("Coleta registrada");
       } else {
         toast.warning(`${saved} registrado(s), ${failed.length} falhou. Tente novamente.`);
       }
       refetchExecClientes();
     } catch { toast.error("Erro ao salvar registro de coleta"); }
   };

   if (loadingClientes || loadingExecClientes) {
     return <div className="p-4 bg-muted/30 rounded-md"><p className="text-sm text-muted-foreground">Carregando...</p></div>;
   }

   const totalQtd = sorted.reduce((sum, c) => {
     const v = Number(localState[c.clienteId]?.quantidade);
     return sum + (Number.isFinite(v) ? v : 0);
   }, 0);
   const totalColetados = sorted.filter(c => {
     const s = localState[c.clienteId];
     const qtd = Number(s?.quantidade);
     return s?.coletaRealizada || (Number.isFinite(qtd) && qtd > 0);
   }).length;

   return (
     <div className="p-4 bg-muted/30 rounded-md space-y-3">
       <div className="flex items-center justify-between">
         <p className="text-sm font-medium flex items-center gap-1">
           <ClipboardCheck className="h-4 w-4" />Registro de Coleta
         </p>
         <Button size="sm" onClick={handleSave} disabled={saving}>
           <Save className="h-3.5 w-3.5 mr-1" />Salvar
         </Button>
       </div>
       {sorted.length === 0 ? (
         <p className="text-sm text-muted-foreground">Nenhum cliente no roteiro. Vincule clientes primeiro.</p>
       ) : (
         <>
           <div className="flex items-center gap-3 flex-wrap">
             <div className="relative flex-1 min-w-[220px]">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input
                 ref={rapidRef}
                 className="pl-8 h-9 transition-shadow"
                 placeholder="Entrada rápida: digite a ordem (nº) ou o nome e pressione Enter…"
                 value={rapidQuery}
                 onChange={e => setRapidQuery(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRapidJump(); } }}
               />
             </div>
              <div className="flex gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span>{rapidQuery.trim() ? `Filtrados: ${filtered.length}/${sorted.length}` : `Coletados: ${totalColetados}/${sorted.length}`}</span>
                <span>Total: <strong className="text-foreground">{totalQtd}</strong></span>
              </div>
           </div>
           <div className="rounded-md border bg-background overflow-hidden">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead className="w-10">#</TableHead>
                   <TableHead>Cliente</TableHead>
                   <TableHead className="w-20 text-center">Coletado</TableHead>
                   <TableHead className="w-24 text-center">Qtde</TableHead>
                   <TableHead>Ocorrência</TableHead>
                 </TableRow>
               </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                   const state = localState[c.clienteId] || emptyColetaRow;
                   const isDone = state.coletaRealizada || Number(state.quantidade) > 0;
                   return (
                     <TableRow key={c.clienteId} className={isDone ? "bg-green-50/60 dark:bg-green-950/20" : ""}>
                       <TableCell className="text-muted-foreground text-sm">{c.ordem}</TableCell>
                       <TableCell className="text-sm">{c.clienteNome || c.clienteId}</TableCell>
                       <TableCell className="text-center">
                         <Checkbox
                           checked={state.coletaRealizada}
                           onCheckedChange={(checked) => patchRow(c.clienteId, { coletaRealizada: !!checked })}
                         />
                       </TableCell>
                       <TableCell>
                         <Input
                           id={`qty-${c.clienteId}`}
                           type="number"
                           min="0"
                           inputMode="decimal"
                           className="h-7 text-sm text-center"
                           placeholder="0"
                           value={state.quantidade}
                            onChange={(e) => {
                              const qtd = e.target.value;
                              patchRow(c.clienteId, {
                                quantidade: qtd,
                                coletaRealizada: qtd.trim() !== '' && Number(qtd) > 0,
                              });
                            }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               e.preventDefault();
                               // volta para a busca rápida para o próximo ponto
                               rapidRef.current?.focus();
                             }
                           }}
                         />
                       </TableCell>
                       <TableCell>
                         <Input
                           className="h-7 text-sm"
                           placeholder="Descreva a ocorrência..."
                           value={state.ocorrencia}
                           onChange={(e) => patchRow(c.clienteId, { ocorrencia: e.target.value })}
                         />
                       </TableCell>
                     </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
           </div>
         </>
       )}
     </div>
   );
 }

function PesagensPanel({ execucao, onSynced }: { execucao: ExecucaoColeta; onSynced: () => void }) {
  const { data, loading, refetch } = usePesagensByExecucao(execucao.id);
  const { syncing, error: syncError, sync } = useExternalPesagensSync();
  const dataDefault = (execucao.dataExecucao || "").slice(0, 10);
  const [dataInicio, setDataInicio] = useState(dataDefault);
  const [dataFim, setDataFim] = useState(dataDefault);
  const [detalhesErros, setDetalhesErros] = useState<string[]>([]);

  const handleSync = async () => {
    if (!dataInicio || !dataFim) {
      toast.error("Informe o período (data inicial e final)");
      return;
    }
    const result = await sync(dataInicio, dataFim);
    if (result) {
      toast.success(result.mensagem);
      setDetalhesErros(result.detalhes_erros);
      refetch();
      onSynced();
    } else {
      setDetalhesErros([]);
      toast.error(syncError || "Erro ao sincronizar pesagens");
    }
  };

  return (
    <div className="p-4 bg-muted/30 rounded-md space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-sm">
          <p className="font-medium flex items-center gap-1"><Scale className="h-4 w-4" />Pesagens</p>
          {execucao.codigoDespacho && <span className="text-muted-foreground">Despacho: <strong className="text-foreground">{execucao.codigoDespacho}</strong></span>}
          {execucao.numeroViagens != null && <span className="text-muted-foreground">Viagens: <strong className="text-foreground">{execucao.numeroViagens}</strong></span>}
          {execucao.pesoTotal != null && <span className="text-muted-foreground">Peso total: <strong className="text-foreground">{execucao.pesoTotal.toLocaleString('pt-BR')} kg</strong></span>}
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" className="h-8 w-36" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          <span className="text-muted-foreground text-xs">até</span>
          <Input type="date" className="h-8 w-36" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>
      {detalhesErros.length > 0 && (
        <ul className="list-disc list-inside text-red-700 text-xs space-y-0.5">
          {detalhesErros.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pesagem registrada para esta execução.</p>
      ) : (
        <div className="rounded-md border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Resíduo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{p.dataPesagem ? new Date(p.dataPesagem).toLocaleString('pt-BR') : "—"}</TableCell>
                  <TableCell className="text-sm">{p.veiculo || "—"}</TableCell>
                  <TableCell className="text-sm">{p.residuo || "—"}</TableCell>
                  <TableCell className="text-sm">{p.origem || "—"}</TableCell>
                  <TableCell className="text-sm">{p.destino || "—"}</TableCell>
                  <TableCell className="text-sm text-right">{p.pesoLiquido != null ? p.pesoLiquido.toLocaleString('pt-BR') : "—"}</TableCell>
                  <TableCell className="text-sm">{p.statusDespacho || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
