"use client";

import { useState } from "react";
import { Box, Search, RefreshCw, MapPin, ListOrdered, Plus, ExternalLink, ClipboardCheck } from "lucide-react";
import dynamic from "next/dynamic";

const LogisticsMap = dynamic(() => import("@/components/logistics/LogisticsMap"), { ssr: false });
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoteiros, useExecucoes, useExternalRoteiroSync } from "@/src/interface/hooks/catalog/logistica";
import { useLogisticsMutations } from "@/src/interface/hooks/catalog/logistica";
import { useAllUsers } from "@/src/interface/hooks/catalog/auth";
import type { Roteiro, ExecucaoColeta } from "@/src/domain/logistics/LogisticsRepository";
import { ExecucaoColetaStateMachine } from "@/src/domain/logistics/ExecucaoColetaStateMachine";
import { ItinerarioModal } from "@/components/logistics/ItinerarioModal";
import { NovaExecucaoDialog } from "@/components/logistics/NovaExecucaoDialog";
import { toast } from "sonner";

export default function LogisticaPage() {
  const [searchRoteiros, setSearchRoteiros] = useState("");
  const [searchExecucoes, setSearchExecucoes] = useState("");
  const [itinerarioRoteiro, setItinerarioRoteiro] = useState<Roteiro | null>(null);
  const { data: roteiros, loading: loadingRoteiros } = useRoteiros({ searchTerm: searchRoteiros || undefined });
  const { data: execucoes, loading: loadingExecucoes, refetch: refetchExecucoes } = useExecucoes({ status: searchExecucoes || undefined });
  const { status: syncStatus, syncing, lastResult, error: syncError, sync, lastSyncAt } = useExternalRoteiroSync();
  const { updateExecucaoStatus, loading: saving } = useLogisticsMutations();
  const { users: usuarios } = useAllUsers();

  const [showNovaExecucao, setShowNovaExecucao] = useState(false);

  const handleTransicaoStatus = async (execucaoId: string, novoStatus: string) => {
    try {
      const fimEm = (novoStatus === "concluida" || novoStatus === "cancelada") ? new Date().toISOString() : undefined;
      await updateExecucaoStatus(execucaoId, novoStatus, fimEm);
      toast.success(`Status alterado para "${novoStatus}"`);
      refetchExecucoes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar status");
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Box className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Logística</h1>
          <p className="text-sm text-muted-foreground">Roteiros de coleta e execuções</p>
        </div>
      </div>

      <Tabs defaultValue="roteiros">
        <TabsList>
          <TabsTrigger value="roteiros">Roteiros</TabsTrigger>
          <TabsTrigger value="execucoes">Execuções</TabsTrigger>
          <TabsTrigger value="mapa"><MapPin className="h-3.5 w-3.5 mr-1.5 inline" />Mapa</TabsTrigger>
        </TabsList>

        <TabsContent value="roteiros" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Lista de Roteiros</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar roteiro..."
                      className="pl-8"
                      value={searchRoteiros}
                      onChange={(e) => setSearchRoteiros(e.target.value)}
                    />
                  </div>
                  {syncStatus && (
                    <Badge variant={syncStatus.conectado ? "default" : "destructive"} className="text-xs">
                      {syncStatus.conectado ? "PG externo conectado" : "PG externo offline"}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={sync}
                    disabled={syncing}
                    title={syncStatus ? `Externo: ${syncStatus.total_externo} | Local: ${syncStatus.total_local}` : "Verificar conexão"}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Sincronizando..." : "Sincronizar"}
                  </Button>
                  <Link href="/logistica/roteiros/novo">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Novo Roteiro
                    </Button>
                  </Link>
                </div>
              </div>
              <CardDescription>
                {roteiros.length} roteiro(s) encontrado(s)
                {syncStatus && (
                  <span className="ml-3 text-xs">
                    | PG externo: <strong>{syncStatus.total_externo}</strong> | Local: <strong>{syncStatus.total_local}</strong>
                  </span>
                )}
                {lastSyncAt && (
                  <span className="ml-3 text-xs">
                    | Última sincronização: {lastSyncAt.toLocaleString('pt-BR')}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncError && (
                <div className="mb-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                  Erro na sincronização: {syncError}
                </div>
              )}
              {lastResult && (
                <div className="mb-3 p-3 rounded-md bg-green-50 border border-green-200 text-green-700 text-sm">
                  {lastResult.mensagem}
                  {lastResult.detalhes_erros.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-red-700 text-xs space-y-0.5">
                      {lastResult.detalhes_erros.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {loadingRoteiros ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : roteiros.length === 0 ? (
                <p className="text-muted-foreground">Nenhum roteiro encontrado.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo de Resíduo</TableHead>
                        <TableHead>Periodicidade</TableHead>
                        <TableHead>Turno</TableHead>
                        <TableHead>Base</TableHead>
                        <TableHead>Distrito</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="w-28"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roteiros.map((r: Roteiro) => (
                        <TableRow key={r.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <Link href={`/logistica/roteiros/${r.id}`} className="block">{r.nome}</Link>
                          </TableCell>
                          <TableCell>{r.tipoResiduo || "—"}</TableCell>
                          <TableCell>{r.periodicidade || "—"}</TableCell>
                          <TableCell>{r.turno || "—"}</TableCell>
                          <TableCell>{r.base || "—"}</TableCell>
                          <TableCell>{r.distrito || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={r.situacao === "ativo" ? "default" : "outline"}>
                              {r.situacao}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => { e.stopPropagation(); setItinerarioRoteiro(r); }}
                            >
                              <ListOrdered className="h-3.5 w-3.5" />
                              Itinerário
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execucoes" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Execuções de Coleta</CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    value={searchExecucoes}
                    onChange={(e) => setSearchExecucoes(e.target.value)}
                    className="border rounded-md px-3 py-1.5 text-sm bg-background w-48"
                  >
                    <option value="">Todos os status</option>
                    <option value="agendada">Agendada</option>
                    <option value="em_transito">Em Trânsito</option>
                    <option value="em_execucao">Em Execução</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  <Button size="sm" onClick={() => setShowNovaExecucao(true)}>
                    <Plus className="h-4 w-4 mr-1" />Nova Execução
                  </Button>
                </div>
              </div>
              <CardDescription>{execucoes.length} execução(ões) encontrada(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingExecucoes ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : execucoes.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma execução encontrada.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roteiro</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Veículo</TableHead>
                        <TableHead className="w-40">Ações</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {execucoes.map((e: ExecucaoColeta) => {
                        const transicoes = ExecucaoColetaStateMachine.getTransitionsFrom(e.status);
                        const isTerminal = ExecucaoColetaStateMachine.isTerminal(e.status);
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.roteiroNome || e.roteiroId}</TableCell>
                            <TableCell>
                              {e.dataExecucao ? new Date(e.dataExecucao).toLocaleDateString("pt-BR") : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  e.status === "concluida"
                                    ? "default"
                                    : e.status === "em_execucao" || e.status === "em_transito"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {e.status}
                              </Badge>
                            </TableCell>
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
                            <TableCell className="flex gap-1">
                              <Link href={`/logistica/roteiros/${e.roteiroId}?exec=${e.id}&panel=coleta`}>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" title="Registrar coleta / checklist">
                                  <ClipboardCheck className="h-3.5 w-3.5" />
                                  Coleta
                                </Button>
                              </Link>
                              <Link href={`/logistica/roteiros/${e.roteiroId}`}>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ver roteiro">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapa">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Mapa de Logística
              </CardTitle>
              <CardDescription>
                Pontos de coleta, clientes e camadas geoprocessadas. Use "Importar GeoJSON" para adicionar terrenos e pontos GPS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogisticsMap />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ItinerarioModal
        roteiroId={itinerarioRoteiro?.id ?? ""}
        roteiroNome={itinerarioRoteiro?.nome ?? ""}
        open={itinerarioRoteiro !== null}
        onClose={() => setItinerarioRoteiro(null)}
      />

      <NovaExecucaoDialog
        open={showNovaExecucao}
        onClose={() => setShowNovaExecucao(false)}
        onSaved={refetchExecucoes}
        roteiros={roteiros}
        usuarios={usuarios}
      />
    </div>
  );
}
