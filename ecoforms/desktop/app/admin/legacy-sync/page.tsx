"use client";

import { useCallback, useState } from "react";
import { ProtectedPage } from "@/components/auth/PermissionGuards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownToLine, Database, RefreshCcw, Weight } from "lucide-react";
import {
    useLegacySyncActions,
    useLegacySyncData,
    usePgLegacyConfig,
    DEFAULT_FILTERS,
    type LegacySyncFilters,
} from "@/src/interface/hooks/queries/useLegacySyncData";
import { PgConfigCard } from "@/components/admin/PgConfigCard";

const SELECT_ALL_VALUE = "__all__";

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <Select value={value || SELECT_ALL_VALUE} onValueChange={(v) => onChange(v === SELECT_ALL_VALUE ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={SELECT_ALL_VALUE}>Todos</SelectItem>
                    {options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                            {opt}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function isoDateDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}


export default function LegacySyncPage() {
    const [filters, setFilters] = useState<LegacySyncFilters>(DEFAULT_FILTERS);
    const [pesagemDataInicio, setPesagemDataInicio] = useState(() => isoDateDaysAgo(7));
    const [pesagemDataFim, setPesagemDataFim] = useState(() => isoDateDaysAgo(0));

    const { config, saving, saveConfig } = usePgLegacyConfig();
    const { roteiros, pesagens, filterOptions, loading, refetch } = useLegacySyncData(filters);
    const {
        syncingRoteiros,
        syncingPesagens,
        roteiroResult,
        pesagemResult,
        error: syncError,
        syncRoteiros,
        syncPesagens,
    } = useLegacySyncActions(config);

    const updateFilter = useCallback((key: keyof LegacySyncFilters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSyncPesagens = useCallback(async () => {
        if (!pesagemDataInicio || !pesagemDataFim) return;
        await syncPesagens(pesagemDataInicio, pesagemDataFim);
        refetch();
    }, [pesagemDataInicio, pesagemDataFim, syncPesagens, refetch]);

    const handleSyncRoteiros = useCallback(async () => {
        await syncRoteiros();
        refetch();
    }, [syncRoteiros, refetch]);

    return (
        <ProtectedPage permission="system.sync">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Sync Legado (PostgreSQL)</h1>
                        <p className="text-sm text-muted-foreground">
                            Dados sincronizados do banco comcap (cad_roteiro + cad_balanca).
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => refetch()}>
                        <RefreshCcw className="size-4" />
                        Atualizar dados
                    </Button>
                </div>

                <PgConfigCard config={config} saving={saving} onSave={saveConfig} />

                {(syncError || roteiroResult || pesagemResult) && (
                    <div className="space-y-2">
                        {syncError && (
                            <Alert variant="destructive">
                                <AlertTitle>Erro de sincronização</AlertTitle>
                                <AlertDescription>{syncError}</AlertDescription>
                            </Alert>
                        )}
                        {roteiroResult && (
                            <Alert>
                                <AlertTitle>Roteiros</AlertTitle>
                                <AlertDescription>{roteiroResult}</AlertDescription>
                            </Alert>
                        )}
                        {pesagemResult && (
                            <Alert>
                                <AlertTitle>Pesagens</AlertTitle>
                                <AlertDescription>
                                    {pesagemResult.split("\n").map((linha, i) => (
                                        <p key={i}>{linha}</p>
                                    ))}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Database className="size-4 text-muted-foreground" />
                                <CardTitle className="text-sm">Roteiros Locais</CardTitle>
                            </div>
                            <CardDescription>Sincronizados de comcap.cad_roteiro</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">{roteiros.length}</p>
                            <p className="text-xs text-muted-foreground">últimos registros exibidos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Weight className="size-4 text-muted-foreground" />
                                <CardTitle className="text-sm">Pesagens Locais</CardTitle>
                            </div>
                            <CardDescription>Sincronizadas de comcap.cad_balanca</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">{pesagens.length}</p>
                            <p className="text-xs text-muted-foreground">últimos registros exibidos</p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="roteiros">
                    <TabsList>
                        <TabsTrigger value="roteiros">
                            <Database className="mr-1.5 size-3.5" />
                            Roteiros
                        </TabsTrigger>
                        <TabsTrigger value="pesagens">
                            <Weight className="mr-1.5 size-3.5" />
                            Pesagens
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="roteiros" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Filtros — Roteiros</CardTitle>
                                        <CardDescription>Filtre os roteiros sincronizados do legado</CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleSyncRoteiros}
                                        disabled={syncingRoteiros}
                                    >
                                        <ArrowDownToLine className="mr-1.5 size-3.5" />
                                        {syncingRoteiros ? "Sincronizando..." : "Sync Roteiros"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <FilterSelect
                                        label="Situação"
                                        value={filters.roteiroSituacao}
                                        onChange={(v) => updateFilter("roteiroSituacao", v)}
                                        options={["ativo", "inativo", "suspenso"]}
                                    />
                                    <FilterSelect
                                        label="Base"
                                        value={filters.roteiroBase}
                                        onChange={(v) => updateFilter("roteiroBase", v)}
                                        options={filterOptions.bases}
                                    />
                                    <FilterSelect
                                        label="Turno"
                                        value={filters.roteiroTurno}
                                        onChange={(v) => updateFilter("roteiroTurno", v)}
                                        options={filterOptions.turnos}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Últimos Roteiros</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-auto rounded-lg border text-[0.68rem]">
                                    <table className="min-w-full divide-y divide-border text-left text-[0.8rem]">
                                        <thead className="bg-muted text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold">Código</th>
                                                <th className="px-3 py-2 font-semibold">Nome</th>
                                                <th className="px-3 py-2 font-semibold">Base</th>
                                                <th className="px-3 py-2 font-semibold">Turno</th>
                                                <th className="px-3 py-2 font-semibold">Periodicidade</th>
                                                <th className="px-3 py-2 font-semibold">Situação</th>
                                                <th className="px-3 py-2 font-semibold">Atualizado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={7} className="px-3 py-2 text-sm text-muted-foreground">
                                                        Carregando...
                                                    </td>
                                                </tr>
                                            ) : roteiros.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-3 py-2 text-sm text-muted-foreground">
                                                        Nenhum roteiro sincronizado
                                                    </td>
                                                </tr>
                                            ) : (
                                                roteiros.map((r) => (
                                                    <tr key={r.id} className="even:bg-muted">
                                                        <td className="px-3 py-2 align-top text-xs font-mono">{r.codigo}</td>
                                                        <td className="px-3 py-2 align-top text-xs">{r.nome}</td>
                                                        <td className="px-3 py-2 align-top text-xs">{r.base ?? "-"}</td>
                                                        <td className="px-3 py-2 align-top text-xs">{r.turno ?? "-"}</td>
                                                        <td className="px-3 py-2 align-top text-xs">{r.periodicidade ?? "-"}</td>
                                                        <td className="px-3 py-2 align-top text-xs">
                                                            <span
                                                                className={
                                                                    r.situacao === "ativo"
                                                                        ? "text-green-600"
                                                                        : r.situacao === "inativo"
                                                                          ? "text-red-500"
                                                                          : "text-yellow-600"
                                                                }
                                                            >
                                                                {r.situacao}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                                                            {r.atualizado_em}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="pesagens" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Filtros — Pesagens</CardTitle>
                                        <CardDescription>Filtre as pesagens sincronizadas do legado</CardDescription>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleSyncPesagens}
                                        disabled={syncingPesagens || !pesagemDataInicio || !pesagemDataFim}
                                        title={!pesagemDataInicio || !pesagemDataFim ? "Selecione o período (sync) para habilitar" : undefined}
                                    >
                                        <ArrowDownToLine className="mr-1.5 size-3.5" />
                                        {syncingPesagens ? "Sincronizando..." : "Sync Pesagens"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <FilterSelect
                                        label="Resíduo"
                                        value={filters.pesagemResiduo}
                                        onChange={(v) => updateFilter("pesagemResiduo", v)}
                                        options={filterOptions.residuos}
                                    />
                                    <FilterSelect
                                        label="Destino"
                                        value={filters.pesagemDestino}
                                        onChange={(v) => updateFilter("pesagemDestino", v)}
                                        options={filterOptions.destinos}
                                    />
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Período (sync)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="date"
                                                className="h-8 text-xs"
                                                value={pesagemDataInicio}
                                                onChange={(e) => setPesagemDataInicio(e.target.value)}
                                            />
                                            <Input
                                                type="date"
                                                className="h-8 text-xs"
                                                value={pesagemDataFim}
                                                onChange={(e) => setPesagemDataFim(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Filtro data pesagem — Início</Label>
                                        <Input
                                            type="date"
                                            className="h-8 text-xs"
                                            value={filters.pesagemDataInicio}
                                            onChange={(e) => updateFilter("pesagemDataInicio", e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Filtro data pesagem — Fim</Label>
                                        <Input
                                            type="date"
                                            className="h-8 text-xs"
                                            value={filters.pesagemDataFim}
                                            onChange={(e) => updateFilter("pesagemDataFim", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Últimas Pesagens</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-auto rounded-lg border text-[0.68rem]">
                                    <table className="min-w-full divide-y divide-border text-left text-[0.8rem]">
                                        <thead className="bg-muted text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                                            <tr>
                                                <th className="px-3 py-2 font-semibold">Balança</th>
                                                <th className="px-3 py-2 font-semibold">Despacho</th>
                                                <th className="px-3 py-2 font-semibold">Data Pesagem</th>
                                                <th className="px-3 py-2 font-semibold">Veículo</th>
                                                <th className="px-3 py-2 font-semibold">Resíduo</th>
                                                <th className="px-3 py-2 font-semibold">Origem</th>
                                                <th className="px-3 py-2 font-semibold">Destino</th>
                                                <th className="px-3 py-2 font-semibold">Peso (kg)</th>
                                                <th className="px-3 py-2 font-semibold">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={9} className="px-3 py-2 text-sm text-muted-foreground">
                                                        Carregando...
                                                    </td>
                                                </tr>
                                            ) : pesagens.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="px-3 py-2 text-sm text-muted-foreground">
                                                        Nenhuma pesagem sincronizada
                                                    </td>
                                                </tr>
                                            ) : (
                                                pesagens.map((p) => (
                                                    <tr key={p.id} className="even:bg-muted">
                                                        <td className="px-3 py-2 align-top text-xs font-mono">
                                                            {p.id_balanca ?? "-"}
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-xs font-mono">
                                                            {p.codigo_despacho ?? p.id_despacho ?? "-"}
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                                                            {p.data_pesagem ?? "-"}
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-xs">{p.veiculo ?? "-"}</td>
                                                        <td className="px-3 py-2 align-top text-xs">{p.residuo ?? "-"}</td>
                                                        <td className="px-3 py-2 align-top text-xs">{p.origem ?? "-"}</td>
                                                        <td className="px-3 py-2 align-top text-xs">{p.destino ?? "-"}</td>
                                                        <td className="px-3 py-2 align-top text-xs font-mono">
                                                            {p.peso_liquido != null ? p.peso_liquido.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "-"}
                                                        </td>
                                                        <td className="px-3 py-2 align-top text-xs">{p.status_despacho ?? "-"}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </ProtectedPage>
    );
}
