"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Eye, Calendar, User, ClipboardList, Info,
    Copy, Check, FileJson, LayoutTemplate, Table as TableIcon, Search, ChevronLeft,
    History,
} from "lucide-react";
import { TblSuiteRecord, FormField } from "@/types";
import { fetchPacotesForTarefa } from "@/src/interface/hooks/queries/lookups";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useFormTemplate } from "@/src/interface/hooks/catalog/forms";
import { useAllUsers } from "@/src/interface/hooks/catalog/auth";
import { useTaskHistory } from "@/src/interface/hooks/catalog/kanban";
import { TaskHistoryTab } from "./TaskHistoryTab";

interface TaskEntriesModalProps {
    taskId: string;
    taskTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TaskEntriesModal({ taskId, taskTitle, open, onOpenChange }: TaskEntriesModalProps) {
    const [selectedRecord, setSelectedRecord] = useState<(TblSuiteRecord & { usuario_nome?: string }) | null>(null);
    const [copied, setCopied] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [outerTab, setOuterTab] = useState<"registros" | "historico">("registros");

    const { events, loading: historyLoading, refetch: refetchHistory } = useTaskHistory(taskId, open && !!taskId);

    const [recordsData, setRecordsData] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !taskId) { setRecordsData([]); return; }
        let cancelled = false;
        setLoading(true);
        fetchPacotesForTarefa(taskId)
          .then(rows => { if (!cancelled) setRecordsData(rows as unknown as Record<string, unknown>[]); })
          .catch(() => { if (!cancelled) setRecordsData([]); })
          .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [taskId, open]);

    const records = (recordsData || []).map((r: Record<string, unknown>) => {
        const dados = r.dados;
        return { ...r, dados: typeof dados === "string" ? JSON.parse(dados) : dados };
    }) as (TblSuiteRecord & { usuario_nome?: string })[];

    const { template, loading: templateLoading } = useFormTemplate(selectedRecord?.tipo_form);
    const { users: allUsers } = useAllUsers();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "submitted": return <Badge className="bg-yellow-500 text-white">Enviado</Badge>;
            case "under_review": return <Badge className="bg-blue-500 text-white">Em Revisão</Badge>;
            case "approved": return <Badge className="bg-green-500 text-white">Aprovado</Badge>;
            case "rejected": return <Badge className="bg-red-500 text-white">Rejeitado</Badge>;
            case "correction_needed": return <Badge className="bg-orange-500 text-white">Correção</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const handleCopy = () => {
        if (!selectedRecord) return;
        navigator.clipboard.writeText(JSON.stringify(selectedRecord, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getUserDisplay = (userId: string | null | undefined) => {
        if (!userId) return "Anônimo";
        const user = allUsers.find((u) => u.id === userId);
        return user ? `${user.nome} (${user.username})` : userId;
    };

    const getValue = (path: string, data: Record<string, unknown>): unknown => {
        if (data[path] !== undefined) return data[path];
        return path.split('.').reduce<unknown>((obj, key) => {
            const o = obj as Record<string, unknown> | null | undefined;
            return o ? o[key] : undefined;
        }, data);
    };

    const renderSmartField = (field: FormField) => {
        const value = getValue(field.id, selectedRecord!.dados) as string | { url?: string; dataUrl?: string } | null | undefined;
        if (value === undefined || value === null || value === "") return null;

        const displayUrl = typeof value === "string" ? value : value?.url || value?.dataUrl || null;
        const isImageUrl =
            typeof displayUrl === "string" &&
            (displayUrl.startsWith("data:image/") ||
                displayUrl.includes("/storage/v1/object/public/") ||
                (displayUrl.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i) && displayUrl.startsWith("http")));

        return (
            <div key={field.id} className="p-3 bg-white border rounded-md shadow-sm">
                <p className="text-xs font-semibold text-slate-500 mb-1">{field.label}</p>
                <div className="text-sm text-slate-900">
                    {isImageUrl ? (
                        <div className="mt-2 rounded-md overflow-hidden border border-slate-200 bg-slate-50">
                            <img
                                src={displayUrl}
                                alt={field.label}
                                className="max-w-full h-auto max-h-48 object-contain mx-auto"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                }}
                            />
                        </div>
                    ) : Array.isArray(value) ? (
                        <div className="flex flex-wrap gap-1">
                            {value.map((v, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] py-0">{String(v)}</Badge>
                            ))}
                        </div>
                    ) : typeof value === "object" ? (
                        <pre className="text-[10px] bg-slate-50 p-1 rounded font-mono overflow-auto max-h-24">
                            {JSON.stringify(value, null, 2)}
                        </pre>
                    ) : (
                        String(value)
                    )}
                </div>
            </div>
        );
    };

    const hasDetail = selectedRecord !== null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-primary" />
                        <DialogTitle>Registros da Tarefa</DialogTitle>
                    </div>
                    <DialogDescription className="text-slate-500 font-medium mt-0.5">
                        {taskTitle}
                    </DialogDescription>
                </DialogHeader>

                {/* Outer tab bar */}
                <div className="px-6 pt-2 pb-0 border-b shrink-0 bg-white">
                    <Tabs value={outerTab} onValueChange={(v) => setOuterTab(v as "registros" | "historico")}>
                        <TabsList className="h-8">
                            <TabsTrigger value="registros" className="gap-1.5 text-xs h-7">
                                <ClipboardList className="h-3.5 w-3.5" />
                                Registros
                                {records.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1.5 h-4">
                                        {records.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="historico" className="gap-1.5 text-xs h-7">
                                <History className="h-3.5 w-3.5" />
                                Histórico
                                {events.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1.5 h-4">
                                        {events.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Body: split layout (registros) or history timeline */}
                <div className="flex flex-1 min-h-0">
                    {outerTab === "historico" ? (
                        <TaskHistoryTab
                            taskId={taskId}
                            events={events}
                            loading={historyLoading}
                            onCommentAdded={refetchHistory}
                        />
                    ) : (
                        <>
                        {/* Left panel — list */}
                        <div className={`flex flex-col border-r transition-all duration-200 ${hasDetail ? "w-[42%]" : "w-full"}`}>
                            {loading ? (
                                <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse text-sm">
                                    Carregando registros...
                                </div>
                            ) : records.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
                                    <Info className="w-10 h-10 text-slate-300" />
                                    <p className="text-slate-500 font-medium text-sm">Nenhum registro encontrado.</p>
                                    <p className="text-xs text-slate-400">Os registros aparecem após serem submetidos no mobile.</p>
                                </div>
                            ) : (
                                <ScrollArea className="flex-1">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                            <TableRow>
                                                <TableHead className="pl-4">Data / Usuário</TableHead>
                                                {!hasDetail && <TableHead>Status</TableHead>}
                                                <TableHead className="text-right pr-4">
                                                    {hasDetail ? "Status" : ""}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {records.map((record) => {
                                                const isSelected = selectedRecord?.id === record.id;
                                                return (
                                                    <TableRow
                                                        key={record.id}
                                                        onClick={() => setSelectedRecord(record)}
                                                        className={`cursor-pointer transition-colors ${
                                                            isSelected
                                                                ? "bg-primary/8 border-l-2 border-l-primary"
                                                                : "hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <TableCell className="pl-4 py-3">
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(record.criado_em).toLocaleString("pt-BR")}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                                                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                {record.usuario_nome || record.user_id || "—"}
                                                            </div>
                                                        </TableCell>
                                                        {!hasDetail && (
                                                            <TableCell>{getStatusBadge(record.status || "submitted")}</TableCell>
                                                        )}
                                                        <TableCell className="text-right pr-4">
                                                            {hasDetail ? (
                                                                getStatusBadge(record.status || "submitted")
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs"
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedRecord(record); }}
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                    Ver
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            )}
                        </div>

                        {/* Right panel — detail */}
                        {hasDetail && (
                            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                                {/* Detail header */}
                                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-slate-50 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 text-slate-500 hover:text-slate-700 text-xs px-2"
                                        onClick={() => setSelectedRecord(null)}
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        Lista
                                    </Button>
                                    <span className="text-xs text-slate-400">|</span>
                                    <span className="text-xs text-slate-500 font-mono">#{selectedRecord.id.slice(0, 8)}</span>
                                    <span className="ml-auto">{getStatusBadge(selectedRecord.status || "submitted")}</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopy}
                                        className="h-7 gap-1 text-xs ml-1"
                                    >
                                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                        {copied ? "Copiado!" : "JSON"}
                                    </Button>
                                </div>

                                {/* Detail tabs */}
                                <Tabs defaultValue="smart" className="flex-1 flex flex-col min-h-0 px-4 pt-3">
                                    <TabsList className="shrink-0 self-start mb-3">
                                        <TabsTrigger value="smart" className="gap-1.5 text-xs">
                                            <LayoutTemplate className="h-3.5 w-3.5" />
                                            Detalhado
                                        </TabsTrigger>
                                        <TabsTrigger value="table" className="gap-1.5 text-xs">
                                            <TableIcon className="h-3.5 w-3.5" />
                                            Tabela
                                        </TabsTrigger>
                                        <TabsTrigger value="json" className="gap-1.5 text-xs">
                                            <FileJson className="h-3.5 w-3.5" />
                                            JSON
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="smart" className="flex-1 overflow-hidden mt-0">
                                        <ScrollArea className="h-full pr-2 pb-4">
                                            <div className="space-y-5">
                                                <section>
                                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                                        <div className="w-1 h-3.5 bg-primary rounded-full" />
                                                        Metadados
                                                    </h3>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <p className="text-xs text-slate-400 mb-0.5">Usuário</p>
                                                            <p className="text-xs font-mono bg-slate-50 border rounded px-2 py-1 truncate">
                                                                {getUserDisplay(selectedRecord.user_id)}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-slate-400 mb-0.5">Recebido em</p>
                                                            <p className="text-xs bg-slate-50 border rounded px-2 py-1">
                                                                {new Date(selectedRecord.criado_em).toLocaleString("pt-BR")}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </section>

                                                <section>
                                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                                        <div className="w-1 h-3.5 bg-blue-500 rounded-full" />
                                                        Dados do Formulário
                                                    </h3>
                                                    {template ? (
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {template.campos.map(renderSmartField)}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-6 bg-slate-50 rounded border border-dashed">
                                                            <p className="text-xs text-slate-500">
                                                                {templateLoading ? "Carregando template..." : "Template não encontrado."}
                                                            </p>
                                                        </div>
                                                    )}
                                                </section>
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>

                                    <TabsContent value="table" className="flex-1 overflow-hidden mt-0 flex flex-col gap-2 pb-4">
                                        <div className="relative shrink-0">
                                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                            <Input
                                                placeholder="Filtrar campos..."
                                                className="pl-8 h-8 text-xs"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1 overflow-hidden border rounded-md">
                                            <ScrollArea className="h-full">
                                                <Table>
                                                    <TableHeader className="sticky top-0 bg-slate-50 z-10">
                                                        <TableRow>
                                                            <TableHead className="w-[35%] text-xs">Campo</TableHead>
                                                            <TableHead className="text-xs">Valor</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {selectedRecord.dados
                                                            ? Object.entries(selectedRecord.dados)
                                                                  .filter(([key, val]) => {
                                                                      const s = searchTerm.toLowerCase();
                                                                      return key.toLowerCase().includes(s) || String(val).toLowerCase().includes(s);
                                                                  })
                                                                  .map(([key, val]) => (
                                                                      <TableRow key={key}>
                                                                          <TableCell className="font-semibold text-xs text-slate-700 align-top py-2">{key}</TableCell>
                                                                          <TableCell className="text-xs text-slate-600 break-all py-2">
                                                                              {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                                                          </TableCell>
                                                                      </TableRow>
                                                                  ))
                                                            : null}
                                                    </TableBody>
                                                </Table>
                                            </ScrollArea>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="json" className="flex-1 overflow-hidden mt-0 pb-4">
                                        <ScrollArea className="h-full">
                                            <div className="rounded-md bg-slate-950 border border-slate-800 p-4">
                                                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-all">
                                                    {JSON.stringify(selectedRecord.dados, null, 2)}
                                                </pre>
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t shrink-0 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
