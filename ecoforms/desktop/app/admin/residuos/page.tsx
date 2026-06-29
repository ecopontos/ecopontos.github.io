"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, Download, LayoutDashboard, Loader2, Recycle, RefreshCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProtectedPage } from "@/components/auth/PermissionGuards";
import { useExternalResiduos } from "@/src/interface/hooks/catalog/logistica";
import { usePgLegacyConfig } from "@/src/interface/hooks/catalog/logistica";
import { PgConfigCard } from "@/components/admin/PgConfigCard";

type FilterMode = "all" | "ativo" | "inativo";

export default function TiposResiduoPage() {
    const [filterMode, setFilterMode] = useState<FilterMode>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const router = useRouter();
    const { config, loading: configLoading, saving, error: configError, saveConfig } = usePgLegacyConfig();
    const { residuos, total, loading, syncing, error, syncResult, refetch, sync } = useExternalResiduos();

    const filtered = useMemo(() => {
        let list = residuos;
        if (filterMode === "ativo") list = list.filter((r) => r.ativo);
        if (filterMode === "inativo") list = list.filter((r) => !r.ativo);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter(
                (r) =>
                    r.descricao.toLowerCase().includes(term) ||
                    (r.sigla && r.sigla.toLowerCase().includes(term)) ||
                    String(r.id_cad_residuo).includes(term),
            );
        }
        return list;
    }, [residuos, filterMode, searchTerm]);

    const ativos = useMemo(() => residuos.filter((r) => r.ativo).length, [residuos]);
    const inativos = total - ativos;

    return (
        <ProtectedPage permission="users.view_all">
            <div className="container mx-auto py-8 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Recycle className="h-8 w-8" />
                            Tipos de Resíduo
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Dados do banco legado comcap (comcap.cad_residuo)
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push("/admin")}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Voltar ao Admin
                        </Button>
                        <Button variant="outline" onClick={refetch} disabled={loading}>
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Atualizar
                        </Button>
                        <Button onClick={sync} disabled={syncing || loading}>
                            {syncing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            {syncing ? "Sincronizando..." : "Sync p/ Local"}
                        </Button>
                    </div>
                </div>

                <PgConfigCard config={config} loading={configLoading || Boolean(configError)} saving={saving} onSave={saveConfig} />

                {configError && (
                    <Alert variant="destructive">
                        <AlertTitle>Erro ao carregar a configuração</AlertTitle>
                        <AlertDescription>{configError}</AlertDescription>
                    </Alert>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Erro ao conectar no PostgreSQL</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {syncResult && (
                    <Alert>
                        <AlertTitle>Sincronização concluída</AlertTitle>
                        <AlertDescription>{syncResult}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                <CardTitle className="text-sm">Total no Legado</CardTitle>
                            </div>
                            <CardDescription>comcap.cad_residuo</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">{total}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-green-600">Ativos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">{ativos}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-red-500">Inativos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">{inativos}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3 md:flex-row md:items-end">
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={filterMode === "all" ? "default" : "outline"}
                                    onClick={() => setFilterMode("all")}
                                >
                                    Todos
                                </Button>
                                <Button
                                    size="sm"
                                    variant={filterMode === "ativo" ? "default" : "outline"}
                                    onClick={() => setFilterMode("ativo")}
                                >
                                    Ativos
                                </Button>
                                <Button
                                    size="sm"
                                    variant={filterMode === "inativo" ? "default" : "outline"}
                                    onClick={() => setFilterMode("inativo")}
                                >
                                    Inativos
                                </Button>
                            </div>
                            <div className="flex-1 max-w-sm space-y-1.5">
                                <Label className="text-xs">Buscar</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        placeholder="Descrição, sigla ou ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground ml-auto">
                                {filtered.length} de {total} registros
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="w-24">Sigla</TableHead>
                                    <TableHead className="w-28">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                            <p className="mt-2 text-sm text-muted-foreground">Consultando PostgreSQL...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : error ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                            Falha ao carregar dados do legado.
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                            Nenhum resíduo encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((r) => (
                                        <TableRow key={r.id_cad_residuo}>
                                            <TableCell className="font-mono text-sm">{r.id_cad_residuo}</TableCell>
                                            <TableCell className="font-medium">{r.descricao}</TableCell>
                                            <TableCell className="font-mono text-sm text-muted-foreground">
                                                {r.sigla ?? "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={r.ativo ? "default" : "secondary"}>
                                                    {r.ativo ? "Ativo" : "Inativo"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </ProtectedPage>
    );
}
