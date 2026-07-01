"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Smartphone,
    Download,
    FolderOpen,
    FileArchive,
    CheckCircle2,
    XCircle,
    Loader2,
    Database,
    HardDrive,
    Wifi,
} from "lucide-react";
import { useTauriInvoke } from "@/src/interface/hooks/catalog/tauri";
import { useSqlite } from "@/src/interface/hooks/catalog/tauri";
import { toast } from "sonner";

type ExportDestination = "appdata" | "lan";

interface ExportMeta {
    gerado_em: string;
    schema_version: number;
    tabelas: Record<string, number>;
    tamanho_bytes: number;
}

const TABLES = [
    "usuarios",
    "tarefas",
    "clientes",
    "demandas",
    "agendamentos",
    "manifestacoes",
    "setores",
    "roteiros",
    "ecopontos",
    "registro_dados",
    "registro_modulos",
];

function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function fileNameFromPath(filePath: string): string {
    return filePath.split(/[/\\]/).pop() ?? "ecoforms_mobile.db";
}

export default function ExportarMobilePage() {
    const safeInvoke = useTauriInvoke();
    const sqlite = useSqlite();
    const [exporting, setExporting] = useState(false);
    const [exportMeta, setExportMeta] = useState<ExportMeta | null>(null);
    const [lanSyncPath, setLanSyncPath] = useState("");
    const [exportDestination, setExportDestination] = useState<ExportDestination>("appdata");
    const [error, setError] = useState<string | null>(null);
    const [exportRelativePath, setExportRelativePath] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const rows = await sqlite.query<{ valor: string }>(
                    `SELECT valor FROM configuracoes_sistema WHERE chave = 'lan_sync_path' LIMIT 1`,
                );
                if (!cancelled) {
                    setLanSyncPath(rows[0]?.valor?.trim() ?? "");
                }
            } catch {
                if (!cancelled) {
                    setLanSyncPath("");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [sqlite]);

    const countTables = useCallback(async () => {
        try {
            const counts: Record<string, number> = {};
            for (const table of TABLES) {
                try {
                    const rows = await sqlite.query<{ cnt: number }>(`SELECT count(*) as cnt FROM ${table}`);
                    counts[table] = rows[0]?.cnt ?? 0;
                } catch {
                    counts[table] = 0;
                }
            }
            return counts;
        } catch {
            return {};
        }
    }, [sqlite]);

    const handleExport = useCallback(async () => {
        if (exportDestination === "lan" && !lanSyncPath.trim()) {
            const msg = "Configure o caminho LAN antes de exportar para a rede.";
            setError(msg);
            toast.error("Falha na exportação", { description: msg });
            return;
        }

        setExporting(true);
        setError(null);
        setExportRelativePath(null);
        setExportMeta(null);

        try {
            const relativePath = await safeInvoke<string>("db_export_for_mobile", {
                destination: exportDestination,
            });

            const tabelas = await countTables();
            setExportMeta({
                gerado_em: new Date().toISOString(),
                schema_version: 28,
                tabelas,
                tamanho_bytes: 0,
            });
            setExportRelativePath(relativePath);
            toast.success("Banco exportado com sucesso", {
                description: `Arquivo: ${relativePath}`,
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            toast.error("Falha na exportação", { description: msg });
        } finally {
            setExporting(false);
        }
    }, [safeInvoke, exportDestination, lanSyncPath, countTables]);

    const handleDownload = useCallback(async () => {
        if (!exportRelativePath) return;

        try {
            const bytes = base64ToBytes(await safeInvoke<string>("db_read_mobile_export", {
                destination: exportDestination,
                path: exportRelativePath,
            }));

            const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
            const blob = new Blob([payload], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileNameFromPath(exportRelativePath);
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast.success("Download iniciado");
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error("Erro no download", { description: msg });
        }
    }, [exportRelativePath, exportDestination, safeInvoke]);

    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    const hasLanPath = lanSyncPath.trim().length > 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Exportar Mobile</h1>
                <p className="text-muted-foreground">
                    Gerar banco de dados completo para provisionamento do app mobile (ADR-028).
                </p>
            </div>

            {!isTauri && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-amber-800">
                            <Wifi className="h-5 w-5" />
                            <p className="text-sm font-medium">
                                Recurso disponível apenas no Tauri Desktop. Execute com <code className="rounded bg-amber-100 px-1">npm run start:tauri</code>.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            Banco de Dados Local
                        </CardTitle>
                        <CardDescription>
                            O arquivo .db gerado contém todas as tabelas do schema canônico
                            (schema_ddl.sql), com dados sensíveis removidos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="exportDestination">Destino da exportação</Label>
                            <Select
                                value={exportDestination}
                                onValueChange={(value) => setExportDestination(value as ExportDestination)}
                                disabled={exporting || !isTauri}
                            >
                                <SelectTrigger id="exportDestination">
                                    <SelectValue placeholder="Selecione o destino" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="appdata">AppData local</SelectItem>
                                    <SelectItem value="lan" disabled={!hasLanPath}>
                                        Pasta LAN compartilhada
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {exportDestination === "appdata"
                                    ? "O arquivo fica em `AppData/mobile_exports` e pode ser baixado localmente."
                                    : hasLanPath
                                        ? `O arquivo será gravado em ${lanSyncPath}`
                                        : "Configure a pasta LAN nas configurações antes de usar este destino."}
                            </p>
                        </div>

                        <div className="space-y-2 rounded-md border p-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium">Pasta LAN configurada</span>
                                <Badge variant={hasLanPath ? "secondary" : "outline"}>
                                    {hasLanPath ? "Configurada" : "Não configurada"}
                                </Badge>
                            </div>
                            <p className="break-all text-xs text-muted-foreground">
                                {lanSyncPath || "Nenhum caminho LAN foi salvo nas configurações."}
                            </p>
                        </div>

                        <Button
                            onClick={handleExport}
                            disabled={exporting || !isTauri}
                            className="w-full"
                        >
                            {exporting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Exportando...
                                </>
                            ) : (
                                <>
                                    <FileArchive className="mr-2 h-4 w-4" />
                                    Gerar Banco Mobile (.db)
                                </>
                            )}
                        </Button>

                        {error && (
                            <div className="flex items-center gap-2 text-sm text-red-600">
                                <XCircle className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Smartphone className="h-5 w-5" />
                            Resultado da Exportação
                        </CardTitle>
                        <CardDescription>
                            Após gerar, faça o download do arquivo ou copie para
                            o dispositivo mobile via USB / pasta LAN.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {exportRelativePath ? (
                            <>
                                <div className="flex items-center gap-2 text-sm text-green-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="break-all font-mono text-xs">
                                        {exportRelativePath}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <HardDrive className="h-4 w-4" />
                                    Destino atual: {exportDestination === "appdata" ? "AppData local" : "Pasta LAN"}
                                </div>

                                <Button
                                    onClick={handleDownload}
                                    variant="outline"
                                    className="w-full"
                                    disabled={!isTauri}
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Baixar Arquivo .db
                                </Button>

                                {exportMeta && (
                                    <div className="space-y-2 pt-2 border-t">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <HardDrive className="h-4 w-4" />
                                            Tabelas exportadas:
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(exportMeta.tabelas)
                                                .filter(([, count]) => count > 0)
                                                .map(([tabela, count]) => (
                                                    <Badge key={tabela} variant="secondary" className="text-xs">
                                                        {tabela}: {count}
                                                    </Badge>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
                                <FolderOpen className="h-10 w-10" />
                                <p className="text-center text-sm">
                                    Nenhum arquivo gerado ainda.
                                    <br />
                                    Selecione um destino e clique em Gerar.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5" />
                        Como usar no Mobile
                    </CardTitle>
                    <CardDescription>
                        O arquivo .db gerado pode ser provisionado no app mobile de três formas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2 rounded-lg border p-3">
                            <h4 className="flex items-center gap-1 text-sm font-medium">
                                <Download className="h-4 w-4" />
                                Download direto
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Baixe o arquivo e transfira para o dispositivo via USB.
                                Na tela de configuração inicial do mobile, selecione
                                &quot;Importar banco&quot;.
                            </p>
                        </div>
                        <div className="space-y-2 rounded-lg border p-3">
                            <h4 className="flex items-center gap-1 text-sm font-medium">
                                <FolderOpen className="h-4 w-4" />
                                Pasta LAN (ADR-027)
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Configure o caminho de destino para a pasta LAN compartilhada.
                                O mobile lê o arquivo automaticamente na inicialização.
                            </p>
                        </div>
                        <div className="space-y-2 rounded-lg border p-3">
                            <h4 className="flex items-center gap-1 text-sm font-medium">
                                <Wifi className="h-4 w-4" />
                                Sync incremental pós-provisão
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Após importar o banco, o mobile sincroniza apenas
                                o delta (eventos posteriores à exportação) via Supabase
                                ou LAN.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
