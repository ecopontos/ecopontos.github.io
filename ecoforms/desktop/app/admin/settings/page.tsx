"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Monitor, Save, RefreshCw, History, Trash2, FolderOpen, CheckCircle2, XCircle, AlertTriangle, FileArchive, List, Network } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSyncStatus } from '@/contexts/SyncContext';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useDeviceConfig } from "@/src/interface/hooks/catalog/sync";
import { useSyncSettings } from "@/src/interface/hooks/catalog/sync";
import { useNetworkParquet } from "@/src/interface/hooks/catalog/utils";
import { StorageStatusCard } from "@/components/admin/StorageStatusCard";
import { Badge } from "@/components/ui/badge";
import { getSistemaConfig, saveSistemaConfig } from '@/src/interface/hooks/queries/lookups';

const SYNC_INTERVALS = [
    { value: '60000', label: '1 minuto' },
    { value: '300000', label: '5 minutos' },
    { value: '600000', label: '10 minutos' },
    { value: '1800000', label: '30 minutos' },
    { value: '3600000', label: '1 hora' },
];

type HistoryFilter = 'all' | 'success' | 'error';

export default function SettingsPage() {
    const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

    const {
        deviceConfig,
        deviceName,
        setDeviceName,
        isLoading,
        isSaving,
        save: saveDevice,
        regenerateId,
    } = useDeviceConfig();

    const {
        syncInterval,
        setSyncInterval,
        syncOnFocus,
        setSyncOnFocus,
        notifyOnSuccess,
        setNotifyOnSuccess,
        notifyOnError,
        setNotifyOnError,
        save: saveSyncSettings,
    } = useSyncSettings();

    const {
        path: networkPath,
        setPath: setNetworkPath,
        probeResult,
        parquetFiles,
        isProbing,
        isSaving: isSavingNetwork,
        isListing,
        probe,
        save: saveNetworkPath,
        listFiles,
    } = useNetworkParquet();

    const {
        autoSyncEnabled,
        enableAutoSync,
        disableAutoSync,
        history,
        clearHistory,
        resetStats,
        stats,
    } = useSyncStatus();

    if (isLoading) {
        return (
            <div className="space-y-6 text-center py-20">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                <p className="text-muted-foreground mt-4">Carregando configurações...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configurações do Sistema</h1>
                <p className="text-muted-foreground">
                    Gerencie os parâmetros do dispositivo e o comportamento da sincronização.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Coluna 1: Dispositivo e Cloud Status */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Monitor className="h-5 w-5" />
                                Dispositivo
                            </CardTitle>
                            <CardDescription>
                                Identificação única deste terminal no sistema.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="device-name">Nome do Dispositivo</Label>
                                <Input
                                    id="device-name"
                                    value={deviceName}
                                    onChange={(e) => setDeviceName(e.target.value)}
                                    placeholder="Digite o nome do dispositivo"
                                    maxLength={50}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>ID do Dispositivo</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={deviceConfig?.deviceId || ""}
                                        readOnly
                                        className="font-mono text-xs bg-muted"
                                    />
                                    <Button variant="outline" size="sm" onClick={regenerateId} title="Gerar novo ID">
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={saveDevice} disabled={isSaving} size="sm">
                                    {isSaving ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Salvar Dispositivo
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <StorageStatusCard />

                    {/* Exportação de dados Parquet para rede local */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FolderOpen className="h-5 w-5" />
                                Exportação de Dados — Parquet
                            </CardTitle>
                            <CardDescription>
                                Pasta de rede ou local para exportar arquivos JSON/Parquet (análise, backup, inspeção).
                                Exemplo: <span className="font-mono text-xs">\\servidor\analise</span> ou <span className="font-mono text-xs">Z:\ecoforms\exports</span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Campo de caminho */}
                            <div className="grid gap-2">
                                <Label htmlFor="network-path">Caminho da Pasta</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="network-path"
                                        value={networkPath}
                                        onChange={(e) => setNetworkPath(e.target.value)}
                                        placeholder="\\servidor\compartilhamento ou C:\pasta"
                                        className="font-mono text-sm"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => probe()}
                                        disabled={isProbing || !networkPath.trim()}
                                        title="Testar acessibilidade da pasta"
                                    >
                                        {isProbing
                                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                                            : <CheckCircle2 className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>

                            {/* Resultado do probe */}
                            {probeResult && (
                                <div className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
                                    probeResult.accessible && probeResult.writable
                                        ? 'border-green-200 bg-green-50 text-green-800'
                                        : probeResult.accessible
                                        ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
                                        : 'border-red-200 bg-red-50 text-red-800'
                                }`}>
                                    {probeResult.accessible && probeResult.writable
                                        ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                                        : probeResult.accessible
                                        ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                        : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                                    <div className="space-y-0.5">
                                        <p className="font-medium leading-none">
                                            {probeResult.accessible && probeResult.writable
                                                ? 'Pasta acessível e gravável'
                                                : probeResult.accessible
                                                ? 'Pasta acessível — sem permissão de escrita'
                                                : 'Pasta inacessível'}
                                        </p>
                                        {probeResult.error && (
                                            <p className="text-xs opacity-80">{probeResult.error}</p>
                                        )}
                                        <div className="flex gap-3 text-xs pt-1 opacity-70">
                                            <span>Leitura: {probeResult.readable ? 'sim' : 'não'}</span>
                                            <span>Escrita: {probeResult.writable ? 'sim' : 'não'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Ações */}
                            <div className="flex justify-between items-center pt-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={listFiles}
                                    disabled={isListing || !networkPath.trim()}
                                >
                                    {isListing
                                        ? <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                        : <List className="h-4 w-4 mr-2" />}
                                    Listar Parquet
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={saveNetworkPath}
                                    disabled={isSavingNetwork || !networkPath.trim()}
                                >
                                    {isSavingNetwork
                                        ? <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                        : <Save className="h-4 w-4 mr-2" />}
                                    Salvar Pasta
                                </Button>
                            </div>

                            {/* Lista de arquivos Parquet */}
                            {parquetFiles.length > 0 && (
                                <div className="border rounded-md overflow-hidden">
                                    <div className="bg-muted/50 px-3 py-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        <FileArchive className="h-3.5 w-3.5" />
                                        {parquetFiles.length} arquivo{parquetFiles.length !== 1 ? 's' : ''} encontrado{parquetFiles.length !== 1 ? 's' : ''}
                                    </div>
                                    <div className="max-h-48 overflow-y-auto divide-y">
                                        {parquetFiles.map((f) => (
                                            <div key={f.full_path} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30">
                                                <span className="font-mono truncate max-w-[60%]">{f.name}</span>
                                                <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                                        {f.size < 1024
                                                            ? `${f.size} B`
                                                            : f.size < 1024 * 1024
                                                            ? `${(f.size / 1024).toFixed(1)} KB`
                                                            : `${(f.size / 1024 / 1024).toFixed(1)} MB`}
                                                    </Badge>
                                                    {f.modified && (
                                                        <span className="hidden sm:inline">{f.modified.replace('T', ' ').replace('Z', '')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    {/* ── Sincronização LAN (ADR-020) ─────────────────────── */}
                    <LanSyncSection />
                </div>

                {/* Coluna 2: Sincronização */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <RefreshCw className="h-5 w-5" />
                                Sincronização
                            </CardTitle>
                            <CardDescription>
                                Controle o fluxo automático de dados.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="auto-sync" className="text-sm">Auto-Sync Habilitado</Label>
                                <Switch
                                    id="auto-sync"
                                    checked={autoSyncEnabled}
                                    onCheckedChange={(checked) => checked ? enableAutoSync() : disableAutoSync()}
                                />
                            </div>
                            {autoSyncEnabled && (
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="sync-interval" className="text-sm">Intervalo</Label>
                                    <Select value={syncInterval} onValueChange={setSyncInterval}>
                                        <SelectTrigger id="sync-interval" className="w-32 h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SYNC_INTERVALS.map(interval => (
                                                <SelectItem key={interval.value} value={interval.value}>
                                                    {interval.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <Label htmlFor="sync-on-focus" className="text-sm">Sync ao Ativar Janela</Label>
                                <Switch id="sync-on-focus" checked={syncOnFocus} onCheckedChange={setSyncOnFocus} />
                            </div>
                            <div className="pt-4 border-t space-y-3">
                                <h3 className="text-xs font-semibold uppercase text-gray-400">Notificações</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs">Banner de sucesso</span>
                                    <Switch id="notify-success" checked={notifyOnSuccess} onCheckedChange={setNotifyOnSuccess} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs">Alertas de erro</span>
                                    <Switch id="notify-error" checked={notifyOnError} onCheckedChange={setNotifyOnError} />
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button variant="outline" size="sm" onClick={saveSyncSettings} disabled={isSaving}>
                                    Aplicar Configurações
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <History className="h-4 w-4" /> Histórico & Sessão
                            </CardTitle>
                            <div className="flex gap-1">
                                <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as HistoryFilter)}>
                                    <SelectTrigger className="w-24 h-6 text-[10px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="success">OK</SelectItem>
                                        <SelectItem value="error">Erros</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearHistory} title="Limpar Histórico">
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-48 overflow-y-auto space-y-2 mb-4 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                                {history.filter(e => historyFilter === 'all' || e.status === historyFilter).length === 0 ? (
                                    <p className="text-center py-6 text-xs text-gray-400 font-mono">SEM REGISTROS</p>
                                ) : (
                                    history.filter(e => historyFilter === 'all' || e.status === historyFilter).map((entry, idx) => (
                                        <div key={idx} className="p-2 border rounded bg-gray-50/30 text-[10px]">
                                            <div className="flex justify-between font-bold mb-1">
                                                <span className={entry.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                                                    {entry.status === 'success' ? 'SYNC OK' : 'SYNC FALHA'}
                                                </span>
                                                <span className="text-gray-400 font-normal">
                                                    {formatDistanceToNow(entry.timestamp, { addSuffix: true, locale: ptBR })}
                                                </span>
                                            </div>
                                            {entry.status === 'success' ? (
                                                <p className="text-gray-600">Pushed: {entry.pushed} | Pulled: {entry.pulled} | {entry.duration}ms</p>
                                            ) : (
                                                <p className="text-red-500 truncate">{entry.error}</p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 bg-muted/50 rounded-lg p-3">
                                <div className="text-center">
                                    <div className="text-lg font-bold text-blue-600 leading-none">{stats.pushed}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">Sessão 📤</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-green-600 leading-none">{stats.pulled}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">Sessão 📥</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-red-600 leading-none">{stats.errors}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">Falhas ⚠️</div>
                                </div>
                            </div>
                            <div className="flex justify-center mt-3">
                                <Button variant="link" size="sm" onClick={resetStats} className="text-[10px] text-gray-400 h-auto p-0 hover:text-red-400">
                                    RESETAR ESTATÍSTICAS
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function LanSyncSection() {
    const [lanPath, setLanPath] = useState("");
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [loading, setLoading] = useState(false);

    // Carrega o valor atual ao montar
    useEffect(() => {
        getSistemaConfig('lan_sync_path')
            .then((valor) => setLanPath(valor ?? ""))
            .catch(() => { /* tabela pode não existir em boots antigos */ });
    }, []);

    const handleSave = async () => {
        setLoading(true);
        setSaved(false);
        try {
            await saveSistemaConfig('lan_sync_path', lanPath.trim());
            setSaved(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const { LanFileStorage } = await import("@/src/infrastructure/storage/LanFileStorage");
            const { getContainerAsync } = await import("@/src/infrastructure/container");
            const c = await getContainerAsync();
            const lan = new LanFileStorage(c.sqlite);
            const result = await lan.testConnection();
            setTestResult(result);
        } catch (e) {
            setTestResult({ ok: false, message: String(e) });
        } finally {
            setTesting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Sincronização LAN (estações)
                </CardTitle>
                <CardDescription>
                    Pasta compartilhada para troca de dados entre estações sem depender da nuvem
                    (sincronização de CRM, usuários e domínios). Diferente da exportação Parquet acima.
                    Deixe em branco para usar apenas o Supabase.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="lan_path">Caminho da pasta LAN</Label>
                    <Input
                        id="lan_path"
                        value={lanPath}
                        onChange={e => { setLanPath(e.target.value); setSaved(false); setTestResult(null); }}
                        placeholder={`Ex: \\\\servidor\\compartilhado\\ecoforms`}
                        className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                        Windows: <code>\\servidor\pasta</code> · Linux/macOS: <code>/mnt/nas/ecoforms</code>
                    </p>
                </div>

                {testResult && (
                    <div className={`flex items-center gap-2 text-sm rounded-md p-2 ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {testResult.ok
                            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                            : <XCircle className="h-4 w-4 shrink-0" />
                        }
                        {testResult.message}
                    </div>
                )}

                <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {saved ? "Salvo!" : "Salvar"}
                    </Button>
                    <Button variant="outline" onClick={handleTest} disabled={testing || !lanPath.trim()}>
                        {testing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Network className="mr-2 h-4 w-4" />}
                        Testar conexão
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
