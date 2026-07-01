"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { TblSuiteRecord } from "@/types";
import { DetailViewModal } from "@/components/DetailViewModal";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Archive,
  Download,
  RefreshCw,
  Eye,
  FileText,
  Search,
  BellRing,
  PlayCircle,
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Settings2,
  PlusCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { openInNewWindow } from "@/src/lib/window-utils";
import { useSync } from "@/src/interface/hooks/catalog/sync";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import { useFormPermissions } from "@/src/interface/hooks/catalog/auth";
import { HideForRole } from "@/components/auth/PermissionGuards";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DynamicDashboard } from "@/components/DynamicDashboard";
import { useDashboardWidgets } from "@/src/interface/hooks/catalog/modules-views";
import { useWidgetMutations } from "@/src/interface/hooks/catalog/modules-views";
import { getAvailableWidgets } from "@/src/application/widgets/WidgetRegistry";
import type { WidgetConfig } from "@/src/application/widgets/WidgetRegistry";
import type { UserRole } from "@/src/interface/hooks/catalog/auth";
import { getContainerAsync } from "@/src/interface/hooks/catalog/utils";
import { closePacotes } from "@/src/interface/hooks/queries/lookups/pacotes";
import {
  useInboxData,
  useAssignedTasks,
  useFormRegistryData,
} from "@/src/interface/hooks/catalog/forms";

export default function InboxPage() {
  return (
    <ErrorBoundary moduleName="Inbox">
      <InboxContent />
    </ErrorBoundary>
  );
}

function InboxContent() {
  const { user } = useAuth();
  const formPermissions = useFormPermissions();
  const { widgets: dashboardWidgets, refetch: refetchWidgets } = useDashboardWidgets();
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { add: addWidget, remove: removeWidget } = useWidgetMutations(refetchWidgets);
  const userRole = ((user?.perfil as string) || "operador") as UserRole;
  const availableToAdd = getAvailableWidgets(userRole).filter(
    (w) => !dashboardWidgets.some((dw) => dw.id === w.id),
  );
  const { syncAll, syncing: isSyncing } = useSync();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFormType, setSelectedFormType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewRecord, setViewRecord] = useState<TblSuiteRecord | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const { data: inboxRows, loading: inboxLoading, refetch: refetchInbox } = useInboxData(
    user?.id, user?.perfil, searchTerm
  );

  const { forms: formsCatalogRaw, loading: formsLoading } = useFormRegistryData(false);
  const formsCatalog = useMemo(
    () => [...formsCatalogRaw].sort((a, b) => a.titulo.localeCompare(b.titulo)),
    [formsCatalogRaw]
  );

  const { tasks: assignedTasks, loading: assignedTasksLoading } = useAssignedTasks(user?.id);

  const data = useMemo<TblSuiteRecord[]>(() => inboxRows.map((row) => ({
    id: row.id,
    criado_em: row.criado_em,
    atualizado_em: row.criado_em,
    user_id: row.user_id,
    tipo_form: row.tipo_form,
    usuario_nome_completo: row.usuario_nome_completo ?? undefined,
    ativo: true,
    status: (row.lifecycle_status || 'submitted') as TblSuiteRecord['status'],
    sync_status: row.sync_status === 'pending' ? null : row.sync_status,
    dados: JSON.parse((row.dados_json as string) || '{}') as Record<string, unknown>,
  })), [inboxRows]);

  const formTypes = useMemo(
    () => Array.from(new Set(data.map((r) => r.tipo_form || "Desconhecido"))),
    [data]
  );

  const accessibleForms = useMemo(() => {
    if (!user) return [];
    return formsCatalog.filter((form) => formPermissions.canAccessForm(form.form_id));
  }, [formsCatalog, formPermissions, user]);

  const assignedTaskSummary = useMemo(() => {
    const row = assignedTasks?.[0];
    return {
      abertas: Number(row?.abertas_count || 0),
      a_fazer: Number(row?.a_fazer_count || 0),
      em_progresso: Number(row?.em_progresso_count || 0),
      atrasadas: Number(row?.atrasadas_count || 0),
    };
  }, [assignedTasks]);

  const filteredData = data.filter(r => {
    const typeMatch = selectedFormType === "all" || (r.tipo_form || "Desconhecido") === selectedFormType;
    const statusMatch = selectedStatus === "all" || (r.status || 'submitted') === selectedStatus;
    return typeMatch && statusMatch;
  });

  const handleSync = async () => {
    try { await syncAll(); } catch (e) { console.error("Sync error:", e); }
    refetchInbox();
  };

  const handleArchive = useCallback(async () => {
    if (!confirm(`Deseja arquivar ${selectedIds.size} itens?\nEles serão movidos para o histórico e removidos desta lista.`)) return;
    setIsProcessing(true);
    try {
      const idsArray = Array.from(selectedIds);
      await closePacotes(idsArray);
      toast.success("Itens arquivados com sucesso!");
      setSelectedIds(new Set());
      refetchInbox();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Erro ao arquivar: " + message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, refetchInbox]);

  const handleDownloadJson = () => {
    const recordsToExport = data.filter(r => selectedIds.has(r.id));
    if (recordsToExport.length === 0) return;
    const dataStr = JSON.stringify(recordsToExport, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ecosuite_export_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredData.map(r => r.id)));
  };

  const formatDeadline = (prazo: string | null) => {
    if (!prazo) return "Sem prazo";
    const date = new Date(prazo);
    if (Number.isNaN(date.getTime())) return "Sem prazo";
    return date.toLocaleDateString("pt-BR");
  };

  const isOverdueTask = (prazo: string | null) => {
    if (!prazo) return false;
    const date = new Date(prazo);
    if (Number.isNaN(date.getTime())) return false;
    return date < new Date();
  };

  const getPriorityBadge = (prioridade: "baixa" | "media" | "alta") => {
    if (prioridade === "alta") return <Badge className="bg-red-500">Alta</Badge>;
    if (prioridade === "media") return <Badge className="bg-amber-500">Média</Badge>;
    return <Badge className="bg-emerald-600">Baixa</Badge>;
  };

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Início</h1>
          <p className="text-muted-foreground">
            Acesso rápido aos formulários e tarefas atribuídas para o seu usuário.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={inboxLoading || isSyncing}
          className={isSyncing ? "border-primary text-primary" : ""}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${inboxLoading || isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Atualizar'}
        </Button>
      </div>

      {dashboardWidgets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            {editMode && (
              <Button variant="outline" size="sm" onClick={() => setAddOpen((v) => !v)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Adicionar Widget
              </Button>
            )}
            <Button
              variant={editMode ? "default" : "ghost"}
              size="sm"
              onClick={() => { setEditMode((v) => !v); setAddOpen(false); }}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {editMode ? "Concluído" : "Personalizar"}
            </Button>
          </div>

          {addOpen && availableToAdd.length > 0 && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Escolha um widget para adicionar:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableToAdd.map((w: WidgetConfig) => (
                  <button
                    key={w.id}
                    onClick={async () => { await addWidget(w); setAddOpen(false); }}
                    className="text-left rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <span className="font-medium">{w.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <DynamicDashboard
            widgets={dashboardWidgets}
            editMode={editMode}
            onRemove={async (instanceId) => { await removeWidget(instanceId); }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Atalhos de Formulários</CardTitle>
            <CardDescription>
              Formulários ativos aos quais você possui acesso direto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formsLoading ? (
              <p className="text-sm text-muted-foreground">Carregando formulários...</p>
            ) : accessibleForms.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum formulário ativo foi atribuído ao seu usuário.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accessibleForms.slice(0, 8).map((form) => (
                  <Button
                    key={form.form_id}
                    variant="outline"
                    className="h-auto justify-between p-3"
                    onClick={() => openInNewWindow(`/run?id=${form.form_id}`, `run-${form.form_id}`, `Executar: ${form.titulo}`)}
                  >
                    <div className="text-left min-w-0">
                      <p className="font-medium truncate">{form.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {form.form_id} • v{form.versao || "1.0"}
                      </p>
                    </div>
                    <PlayCircle className="h-4 w-4 shrink-0" />
                  </Button>
                ))}
              </div>
            )}
            <HideForRole roles={["operador"]}>
              <div className="flex justify-end">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/forms">
                    Ver catálogo completo
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </HideForRole>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Notificações de Tarefas
            </CardTitle>
            <CardDescription>
              Tarefas atribuídas ao seu usuário no módulo Tarefas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">Abertas</p>
                <p className="font-semibold text-lg">{assignedTaskSummary.abertas}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">Atrasadas</p>
                <p className="font-semibold text-lg text-red-600">{assignedTaskSummary.atrasadas}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">A fazer</p>
                <p className="font-semibold">{assignedTaskSummary.a_fazer}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-muted-foreground">Em progresso</p>
                <p className="font-semibold">{assignedTaskSummary.em_progresso}</p>
              </div>
            </div>
            {assignedTasksLoading ? (
              <p className="text-sm text-muted-foreground">Carregando tarefas...</p>
            ) : assignedTasks.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Você não possui tarefas pendentes atribuídas.
              </div>
            ) : (
              <div className="space-y-2">
                {assignedTasks.map((task) => {
                  const overdue = isOverdueTask(task.prazo);
                  return (
                    <div key={task.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{task.titulo}</p>
                          <p className="text-xs text-muted-foreground truncate">{task.projeto_nome}</p>
                        </div>
                        {getPriorityBadge(task.prioridade)}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          {overdue ? <AlertTriangle className="h-3 w-3 text-red-600" /> : <Clock className="h-3 w-3" />}
                          Prazo: {formatDeadline(task.prazo)}
                        </span>
                        {task.status === "em_progresso" ? (
                          <Badge variant="outline">Em progresso</Badge>
                        ) : (
                          <Badge variant="outline">A fazer</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end">
              <Button asChild size="sm" variant="outline">
                <Link href="/kanban">
                  Abrir módulo Tarefas
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Inbox Operacional
            </CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative w-64 mr-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Busca rápida (FTS)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              {selectedIds.size > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={handleDownloadJson}>
                    <Download className="mr-2 h-4 w-4" /> Baixar JSON ({selectedIds.size})
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleArchive} disabled={isProcessing}>
                    <Archive className="mr-2 h-4 w-4" /> {isProcessing ? "Arquivando..." : `Arquivar (${selectedIds.size})`}
                  </Button>
                </>
              )}
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-37.5">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="submitted">🟡 Enviado</SelectItem>
                  <SelectItem value="under_review">🔵 Em Revisão</SelectItem>
                  <SelectItem value="approved">🟢 Aprovado</SelectItem>
                  <SelectItem value="rejected">🔴 Rejeitado</SelectItem>
                  <SelectItem value="correction_needed">🟠 Correção</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedFormType} onValueChange={setSelectedFormType}>
                <SelectTrigger className="w-45">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {formTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription>
            Selecione itens para arquivar ou exportar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12.5">
                    <Checkbox
                      checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Formulário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inboxLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-row-${i}`}>
                      <TableCell><div className="h-4 w-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-24 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-8 w-8 bg-muted rounded animate-pulse ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((record, index) => (
                    <TableRow key={record.id || `fallback-${index}`} className={selectedIds.has(record.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(record.id)}
                          onCheckedChange={() => toggleSelection(record.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Badge variant="outline">{record.tipo_form || "N/A"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const s = record.status || 'submitted';
                            switch (s) {
                              case 'submitted': return <Badge className="bg-yellow-500 hover:bg-yellow-600">Enviado</Badge>;
                              case 'under_review': return <Badge className="bg-blue-500 hover:bg-blue-600">Em Revisão</Badge>;
                              case 'approved': return <Badge className="bg-green-500 hover:bg-green-600">Aprovado</Badge>;
                              case 'rejected': return <Badge className="bg-red-500 hover:bg-red-600">Rejeitado</Badge>;
                              case 'correction_needed':
                                return (
                                  <div className="flex flex-col gap-1">
                                    <Badge className="bg-orange-500 hover:bg-orange-600">Correção</Badge>
                                    {record.prazo_correcao && (
                                      <span className="text-[10px] text-red-600 font-bold">
                                        Até {new Date(record.prazo_correcao).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                );
                              case 'processed': return <Badge className="bg-purple-500 hover:bg-purple-600">Processado</Badge>;
                              case 'archived': return <Badge variant="secondary">Arquivado</Badge>;
                              default: return <Badge variant="outline">{s}</Badge>;
                            }
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-40 font-medium" title={record.usuario_nome_completo}>
                        {record.usuario_nome_completo || (record.user_id ? `${record.user_id.substring(0, 8)}...` : "Desconhecido")}
                      </TableCell>
                      <TableCell>
                        {new Date(record.criado_em).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openInNewWindow(`/view/${record.id}`, `view-${record.id}`, `Visualizar: ${record.tipo_form}`)}
                            title="Ver no Formulário"
                          >
                            <FileText className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setViewRecord(record); setIsViewOpen(true); }}
                            title="Ver Detalhes JSON"
                          >
                            <Eye className="h-4 w-4 text-gray-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DetailViewModal
        record={viewRecord}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
      />
    </div>
  );
}
