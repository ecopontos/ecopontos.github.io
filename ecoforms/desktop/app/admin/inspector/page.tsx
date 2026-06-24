"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
    FileArchive, Database, RefreshCw, Calendar, Hash, Download,
    Copy, List, ChevronLeft, ChevronRight, Key, Table2,
} from "lucide-react";
import { useSQLiteQuery } from "@/src/interface/hooks/catalog/tauri";
import { useSqlite } from "@/src/interface/hooks/catalog/tauri";
import { useNetworkParquet } from "@/src/interface/hooks/catalog/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─── Tipos ──────────────────────────────────────────────────────── */

interface TableInfo { name: string; type: string; }
interface ColumnInfo { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number; }
interface IndexInfo  { name: string; unique: number; origin: string; }
interface TableRowCount { count: number; }

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatModified(modified: string | null): string {
    if (!modified) return "—";
    try { return formatDistanceToNow(new Date(modified), { addSuffix: true, locale: ptBR }); }
    catch { return modified; }
}

function safeTable(name: string) { return name.replace(/"/g, '""'); }

function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const PAGE_SIZE = 50;

/* ─── Aba de dados por tabela ────────────────────────────────────── */

function TableDataContent({ tableName }: { tableName: string }) {
    const sqlite = useSqlite();
    const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const [data, cnt] = await Promise.all([
                sqlite.query<Record<string, unknown>>(
                    `SELECT * FROM "${safeTable(tableName)}" LIMIT ? OFFSET ?`,
                    [PAGE_SIZE, p * PAGE_SIZE],
                ),
                sqlite.query<TableRowCount>(
                    `SELECT COUNT(*) as count FROM "${safeTable(tableName)}"`, [],
                ),
            ]);
            setRows(data);
            setTotal(cnt[0]?.count ?? 0);
            setPage(p);
        } catch (e) {
            toast.error(`Erro ao carregar dados de ${tableName}`);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [sqlite, tableName]);

    useEffect(() => { load(0); }, [load]);

    const exportTable = useCallback(async () => {
        try {
            const all = await sqlite.query<Record<string, unknown>>(
                `SELECT * FROM "${safeTable(tableName)}"`, [],
            );
            downloadJson(
                `${tableName}_${new Date().toISOString().slice(0, 10)}.json`,
                { tabela: tableName, exportadoEm: new Date().toISOString(), total: all.length, registros: all },
            );
            toast.success(`${all.length} registros exportados`);
        } catch {
            toast.error("Erro ao exportar tabela");
        }
    }, [sqlite, tableName]);

    if (loading && rows === null) {
        return (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando dados…</span>
            </div>
        );
    }

    const columns = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                    {total.toLocaleString("pt-BR")} registro(s) no total
                    {totalPages > 1 && ` · página ${page + 1} de ${totalPages}`}
                </span>
                <Button size="sm" variant="outline" onClick={exportTable} className="h-7 text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Exportar JSON
                </Button>
            </div>

            {rows && rows.length > 0 ? (
                <div className="border rounded-md overflow-auto max-h-80">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                {columns.map((col) => (
                                    <TableHead key={col} className="text-xs font-mono whitespace-nowrap py-2 px-3">
                                        {col}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row, i) => (
                                <TableRow key={i} className="hover:bg-muted/20">
                                    {columns.map((col) => {
                                        const val = row[col];
                                        const display = val === null || val === undefined
                                            ? <span className="text-muted-foreground/50 italic text-[10px]">null</span>
                                            : typeof val === "string" && val.length > 80
                                            ? <span title={val}>{val.slice(0, 80)}…</span>
                                            : String(val);
                                        return (
                                            <TableCell key={col} className="text-xs font-mono py-1.5 px-3 max-w-[200px] truncate">
                                                {display}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                    Tabela vazia
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        size="sm" variant="outline" className="h-7 w-7 p-0"
                        onClick={() => load(page - 1)} disabled={page === 0 || loading}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
                    <Button
                        size="sm" variant="outline" className="h-7 w-7 p-0"
                        onClick={() => load(page + 1)} disabled={page >= totalPages - 1 || loading}
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </div>
    );
}

/* ─── Linha de tabela no accordion ──────────────────────────────── */

function TableSchemaRow({ tableName }: { tableName: string }) {
    const { data: columns } = useSQLiteQuery<ColumnInfo>(
        `SELECT * FROM pragma_table_info('${tableName.replace(/'/g, "''")}')`, [],
    );
    const { data: indexes } = useSQLiteQuery<IndexInfo>(
        `SELECT * FROM pragma_index_list('${tableName.replace(/'/g, "''")}')`, [],
    );
    const { data: rowCountResult } = useSQLiteQuery<TableRowCount>(
        `SELECT COUNT(*) as count FROM "${safeTable(tableName)}"`, [],
    );

    const rowCount = rowCountResult[0]?.count ?? 0;
    const [dataLoaded, setDataLoaded] = useState(false);

    return (
        <AccordionItem value={tableName} className="border rounded-md mb-2 overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&[data-state=open]]:bg-muted/30">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Database className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="font-mono text-sm font-medium truncate">{tableName}</span>
                    <div className="flex items-center gap-2 ml-auto mr-4">
                        <Badge variant="outline" className="text-xs font-normal gap-1">
                            <Hash className="h-3 w-3" />
                            {rowCount.toLocaleString("pt-BR")} linhas
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-normal">
                            {columns.length} colunas
                        </Badge>
                        {indexes.length > 0 && (
                            <Badge variant="outline" className="text-xs font-normal text-violet-600 border-violet-300">
                                {indexes.length} índice(s)
                            </Badge>
                        )}
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
                <div className="border-t">
                    <Tabs defaultValue="colunas" onValueChange={(v) => { if (v === "dados") setDataLoaded(true); }}>
                        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-9 px-3 gap-1">
                            <TabsTrigger value="colunas" className="h-7 text-xs gap-1.5">
                                <Key className="h-3 w-3" />
                                Colunas
                            </TabsTrigger>
                            <TabsTrigger value="dados" className="h-7 text-xs gap-1.5">
                                <Table2 className="h-3 w-3" />
                                Dados
                                {rowCount > 0 && (
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                                        {rowCount > 999 ? `${Math.round(rowCount / 1000)}k` : rowCount}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            {indexes.length > 0 && (
                                <TabsTrigger value="indices" className="h-7 text-xs">
                                    Índices
                                </TabsTrigger>
                            )}
                        </TabsList>

                        <TabsContent value="colunas" className="mt-0 p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/20">
                                        <TableHead className="pl-4 text-xs">Coluna</TableHead>
                                        <TableHead className="text-xs">Tipo</TableHead>
                                        <TableHead className="text-xs text-center">PK</TableHead>
                                        <TableHead className="text-xs text-center">NOT NULL</TableHead>
                                        <TableHead className="text-xs">Default</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {columns.map((col) => (
                                        <TableRow key={col.cid} className="text-xs">
                                            <TableCell className="pl-4 font-mono font-medium">
                                                {col.pk === 1 && <span className="inline-block mr-1 text-yellow-500" title="Primary Key">⚷</span>}
                                                {col.name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] font-mono font-normal">
                                                    {col.type || "—"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {col.pk === 1 ? <span className="text-yellow-500">✓</span> : ""}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {col.notnull === 1
                                                    ? <span className="text-blue-500">✓</span>
                                                    : <span className="text-muted-foreground text-[10px]">null</span>}
                                            </TableCell>
                                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                                                {col.dflt_value ?? "—"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TabsContent>

                        <TabsContent value="dados" className="mt-0 p-3">
                            {dataLoaded && <TableDataContent tableName={tableName} />}
                        </TabsContent>

                        {indexes.length > 0 && (
                            <TabsContent value="indices" className="mt-0 p-3">
                                <div className="flex flex-wrap gap-2">
                                    {indexes.map((idx) => (
                                        <Badge key={idx.name} variant="outline" className="text-[10px] font-mono font-normal text-violet-600 border-violet-300">
                                            {idx.name}{idx.unique ? " (unique)" : ""}
                                        </Badge>
                                    ))}
                                </div>
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

/* ─── Painel de schema + dados ───────────────────────────────────── */

function SchemaPanel() {
    const sqlite = useSqlite();
    const { data: tables, loading, refetch } = useSQLiteQuery<TableInfo>(
        `SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name ASC`,
        [],
    );
    const [filter, setFilter] = useState("");
    const [copying, setCopying] = useState(false);

    const userTables = useMemo(
        () => tables.filter((t) =>
            !t.name.startsWith("__") &&
            !t.name.endsWith("_fts") &&
            !t.name.endsWith("_content") &&
            !t.name.endsWith("_data") &&
            !t.name.endsWith("_idx") &&
            !t.name.endsWith("_docsize") &&
            !t.name.endsWith("_config") &&
            t.type === "table"
        ),
        [tables],
    );

    const ftsAndInternal = useMemo(() => tables.filter((t) => !userTables.includes(t)), [tables, userTables]);

    const filtered = useMemo(() => {
        const q = filter.toLowerCase();
        if (!q) return userTables;
        return userTables.filter((t) => t.name.toLowerCase().includes(q));
    }, [userTables, filter]);

    const copySchemaJson = useCallback(async () => {
        setCopying(true);
        try {
            const result: Record<string, unknown> = {};
            for (const t of userTables) {
                const [cols, idxs] = await Promise.all([
                    sqlite.query<ColumnInfo>(`SELECT * FROM pragma_table_info('${t.name.replace(/'/g, "''")}')`, []),
                    sqlite.query<IndexInfo>(`SELECT * FROM pragma_index_list('${t.name.replace(/'/g, "''")}')`, []),
                ]);
                result[t.name] = { columns: cols, indexes: idxs };
            }
            await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
            toast.success("Schema copiado para a área de transferência");
        } catch {
            toast.error("Erro ao copiar schema");
        } finally {
            setCopying(false);
        }
    }, [sqlite, userTables]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                    <List className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                        placeholder="Filtrar por nome de tabela…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="max-w-xs h-8 text-sm"
                    />
                    {filter && (
                        <span className="text-xs text-muted-foreground">{filtered.length} resultado(s)</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground hidden sm:block">
                        <strong className="text-foreground">{userTables.length}</strong> tabelas
                        {ftsAndInternal.length > 0 && ` + ${ftsAndInternal.length} internas`}
                    </p>
                    <Button size="sm" variant="outline" onClick={copySchemaJson} disabled={copying} className="gap-1.5">
                        <Copy className="h-4 w-4" />
                        {copying ? "Copiando…" : "Copiar schema"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={refetch} disabled={loading} className="gap-1.5">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Carregando schema…
                </div>
            ) : (
                <>
                    <Accordion type="multiple" className="space-y-1">
                        {filtered.map((t) => (
                            <TableSchemaRow key={t.name} tableName={t.name} />
                        ))}
                    </Accordion>

                    {filtered.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            Nenhuma tabela encontrada.
                        </p>
                    )}

                    {ftsAndInternal.length > 0 && (
                        <details className="text-xs text-muted-foreground pt-2">
                            <summary className="cursor-pointer select-none hover:text-foreground transition-colors py-1">
                                Mostrar tabelas internas / FTS ({ftsAndInternal.length})
                            </summary>
                            <div className="mt-2 flex flex-wrap gap-1.5 pt-1">
                                {ftsAndInternal.map((t) => (
                                    <Badge key={t.name} variant="outline" className="font-mono text-[10px]">
                                        {t.name}
                                    </Badge>
                                ))}
                            </div>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}

/* ─── Painel Parquet ─────────────────────────────────────────────── */

function ParquetPanel() {
    const { path, parquetFiles, isListing, listFiles } = useNetworkParquet();
    const [hasLoaded, setHasLoaded] = useState(false);

    const handleList = useCallback(async () => {
        await listFiles();
        setHasLoaded(true);
    }, [listFiles]);

    const totalSize = parquetFiles.reduce((acc, f) => acc + f.size, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {path
                        ? <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{path}</span>
                        : <span className="text-yellow-600">Nenhuma pasta configurada em Configurações → Pasta de Rede.</span>
                    }
                </p>
                <Button size="sm" variant="outline" onClick={handleList} disabled={isListing || !path} className="gap-1.5">
                    <RefreshCw className={`h-4 w-4 ${isListing ? "animate-spin" : ""}`} />
                    {isListing ? "Listando…" : "Atualizar lista"}
                </Button>
            </div>

            {!hasLoaded && !isListing && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <FileArchive className="h-10 w-10 opacity-30" />
                    <p className="text-sm">Clique em &quot;Atualizar lista&quot; para carregar os arquivos.</p>
                </div>
            )}

            {hasLoaded && parquetFiles.length === 0 && !isListing && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <FileArchive className="h-10 w-10 opacity-30" />
                    <p className="text-sm">Nenhum arquivo .parquet encontrado na pasta.</p>
                </div>
            )}

            {parquetFiles.length > 0 && (
                <>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <span><strong className="text-foreground">{parquetFiles.length}</strong> arquivo(s)</span>
                        <span>Total: <strong className="text-foreground">{formatBytes(totalSize)}</strong></span>
                    </div>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[60%]">Nome do arquivo</TableHead>
                                    <TableHead className="text-right">Tamanho</TableHead>
                                    <TableHead className="text-right">Modificado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parquetFiles.map((file) => (
                                    <TableRow key={file.full_path}>
                                        <TableCell className="font-mono text-xs">
                                            <div className="flex items-center gap-2">
                                                <FileArchive className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                {file.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">
                                            {formatBytes(file.size)}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            <div className="flex items-center justify-end gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {formatModified(file.modified)}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── Página principal ───────────────────────────────────────────── */

export default function InspectorPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Inspetor de Dados</h1>
                <p className="text-muted-foreground">
                    Visualize o schema, os dados e os arquivos Parquet da pasta de rede. Export JSON por tabela disponível na aba Dados.
                </p>
            </div>

            <Tabs defaultValue="schema">
                <TabsList>
                    <TabsTrigger value="schema" className="gap-2">
                        <Database className="h-4 w-4" />
                        Schema + Dados
                    </TabsTrigger>
                    <TabsTrigger value="parquet" className="gap-2">
                        <FileArchive className="h-4 w-4" />
                        Arquivos Parquet
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="schema" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5 text-blue-500" />
                                Banco SQLite Local
                            </CardTitle>
                            <CardDescription>
                                Estrutura e conteúdo de todas as tabelas. Clique em uma tabela e selecione a aba <strong>Dados</strong> para visualizar ou exportar os registros.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SchemaPanel />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="parquet" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileArchive className="h-5 w-5 text-blue-500" />
                                Arquivos Parquet
                            </CardTitle>
                            <CardDescription>
                                Arquivos <code className="text-xs bg-muted px-1 rounded">.parquet</code> presentes na pasta de rede configurada.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ParquetPanel />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
