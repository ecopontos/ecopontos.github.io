"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useTauriInvoke } from "@/src/interface/hooks/tauri/useTauriInvoke";
import { useSqlite } from "@/src/interface/hooks/queries/useSqlite";
import { toast } from "sonner";

interface ExportMeta {
    gerado_em: string;
    schema_version: number;
    tabelas: Record<string, number>;
    tamanho_bytes: number;
}

export default function ExportarMobilePage() {
    const safeInvoke = useTauriInvoke();
    const sqlite = useSqlite();
    const [exporting, setExporting] = useState(false);
    const [exportMeta, setExportMeta] = useState<ExportMeta | null>(null);
    const [lanPath, setLanPath] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [exportFilePath, setExportFilePath] = useState<string | null>(null);

    const countTables = useCallback(async () => {
        try {
            const tables = [
                "usuarios", "tarefas", "clientes", "tbl_demandas",
                "tbl_agendamentos", "tbl_manifestacoes", "tbl_setores",
                "tbl_roteiros", "ecopontos", "data_registry",
                "module_registry"
            ];
            const counts: Record<string, number> = {};
            for (const t of tables) {
                try {
                    const r = await sqlite.query<{ cnt: number }>(
                        `SELECT count(*) as cnt FROM ${t}`
                    );
                    counts[t] = r[0]?.cnt ?? 0;
                } catch {
                    counts[t] = 0;
                }
            }
            return counts;
        } catch {
            return {};
        }
    }, [sqlite]);

    const handleExport = useCallback(async () => {
        setExporting(true);
        setError(null);
        setExportFilePath(null);
        setExportMeta(null);

        try {
            const dateStr = new Date().toISOString().slice(0, 10);
            const exportPath = lanPath.trim()
                ? `${lanPath.trim().replace(/\\+$/, "")}/ecoforms_mobile_${dateStr}.db`
                : `ecoforms_mobile_${dateStr}.db`;

            const resultPath = await safeInvoke<string>("db_export_for_mobile", {
                exportPath,
            });

            const tabelas = await countTables();

            setExportMeta({
                gerado_em: new Date().toISOString(),
                schema_version: 28,
                tabelas,
                tamanho_bytes: 0,
            });

            setExportFilePath(resultPath);
            toast.success("Banco exportado com sucesso", {
                description: `Arquivo: ${resultPath}`,
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            toast.error("Falha na exportação", { description: msg });
        } finally {
            setExporting(false);
        }
    }, [safeInvoke, lanPath, countTables]);

    const handleDownload = useCallback(async () => {
        if (!exportFilePath) return;
        try {
            const b64 = await safeInvoke<string>("lan_read_file", {
                path: exportFilePath,
            });
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = exportFilePath.split(/[/\\]/).pop() ?? "ecoforms_mobile.db";
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Download iniciado");
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error("Erro no download", { description: msg });
        }
    }, [exportFilePath, safeInvoke]);

    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
                                Recurso disponível apenas no Tauri Desktop. Execute com <code className="bg-amber-100 px-1 rounded">npm run start:tauri</code>.
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
                            <Label htmlFor="lanPath">Caminho de destino (opcional)</Label>
                            <Input
                                id="lanPath"
                                placeholder="Ex: C:\dados\mobile ou /mnt/lan"
                                value={lanPath}
                                onChange={(e) => setLanPath(e.target.value)}
                                disabled={exporting}
                            />
                            <p className="text-xs text-muted-foreground">
                                Se vazio, o arquivo é gerado no diretório de dados do app.
                            </p>
                        </div>

                        <Button
                            onClick={handleExport}
                            disabled={exporting}
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
                        {exportFilePath ? (
                            <>
                                <div className="flex items-center gap-2 text-sm text-green-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="font-mono text-xs break-all">
                                        {exportFilePath}
                                    </span>
                                </div>

                                <Button
                                    onClick={handleDownload}
                                    variant="outline"
                                    className="w-full"
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
                                                .filter(([, cnt]) => cnt > 0)
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
                                <p className="text-sm text-center">
                                    Nenhum arquivo gerado ainda.
                                    <br />
                                    Configure o caminho e clique em Gerar.
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
                        <div className="space-y-2 p-3 border rounded-lg">
                            <h4 className="font-medium text-sm flex items-center gap-1">
                                <Download className="h-4 w-4" />
                                Download direto
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Baixe o arquivo e transfira para o dispositivo via USB.
                                Na tela de configuração inicial do mobile, selecione
                                &quot;Importar banco&quot;.
                            </p>
                        </div>
                        <div className="space-y-2 p-3 border rounded-lg">
                            <h4 className="font-medium text-sm flex items-center gap-1">
                                <FolderOpen className="h-4 w-4" />
                                Pasta LAN (ADR-027)
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Configure o caminho de destino para a pasta LAN compartilhada.
                                O mobile lê o arquivo automaticamente na inicialização.
                            </p>
                        </div>
                        <div className="space-y-2 p-3 border rounded-lg">
                            <h4 className="font-medium text-sm flex items-center gap-1">
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
