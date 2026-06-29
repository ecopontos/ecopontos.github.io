"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import type { PgLegacyConfig, PgLegacyConfigInput } from "@/src/interface/hooks/catalog/logistica";

type PgLegacyConfigDraft = PgLegacyConfig & { pgPassword: string };

export function PgConfigCard({
    config,
    loading = false,
    saving,
    onSave,
}: {
    config: PgLegacyConfig;
    loading?: boolean;
    saving: boolean;
    onSave: (c: PgLegacyConfigInput) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<PgLegacyConfigDraft>({ ...config, pgPassword: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const handleOpen = () => {
        if (loading) return;
        setDraft({ ...config, pgPassword: "" });
        setOpen(true);
        setSaved(false);
        setSaveError(null);
        setShowPassword(false);
    };

    const handleSave = async () => {
        try {
            setSaveError(null);
            await onSave({
                pgHost: draft.pgHost,
                pgPort: draft.pgPort,
                pgDb: draft.pgDb,
                pgUser: draft.pgUser,
                pgPassword: draft.pgPassword,
            });
            setSaved(true);
            window.setTimeout(() => setOpen(false), 800);
        } catch (e: unknown) {
            setSaveError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Settings className="size-4 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-sm">Conexão PostgreSQL</CardTitle>
                            <CardDescription className="text-xs">
                                {loading
                                    ? "Carregando configuração..."
                                    : `${config.pgUser}@${config.pgHost}:${config.pgPort}/${config.pgDb}`}
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={open ? () => setOpen(false) : handleOpen} disabled={loading}>
                        {open ? "Cancelar" : "Editar"}
                    </Button>
                </div>
            </CardHeader>
            {open && (
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Host</Label>
                            <Input
                                className="h-8 text-xs font-mono"
                                value={draft.pgHost}
                                onChange={(e) => setDraft((prev) => ({ ...prev, pgHost: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Porta</Label>
                            <Input
                                className="h-8 text-xs font-mono"
                                type="number"
                                min={1}
                                step={1}
                                value={draft.pgPort}
                                onChange={(e) =>
                                    setDraft((prev) => ({
                                        ...prev,
                                        pgPort: e.target.value ? Number.parseInt(e.target.value, 10) || 0 : 0,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Banco</Label>
                            <Input
                                className="h-8 text-xs font-mono"
                                value={draft.pgDb}
                                onChange={(e) => setDraft((prev) => ({ ...prev, pgDb: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Usuário</Label>
                            <Input
                                className="h-8 text-xs font-mono"
                                value={draft.pgUser}
                                onChange={(e) => setDraft((prev) => ({ ...prev, pgUser: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Senha</Label>
                        <div className="flex gap-2">
                            <Input
                                className="h-8 flex-1 text-xs font-mono"
                                type={showPassword ? "text" : "password"}
                                placeholder={config.hasPassword ? "Deixe em branco para manter a senha atual" : "Senha obrigatória"}
                                value={draft.pgPassword}
                                onChange={(e) => setDraft((prev) => ({ ...prev, pgPassword: e.target.value }))}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => setShowPassword((v) => !v)}
                            >
                                {showPassword ? "Ocultar" : "Mostrar"}
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {config.hasPassword
                                ? "Senha já cadastrada. Deixe em branco para manter o valor atual."
                                : "Informe uma senha para salvar a configuração."}
                        </p>
                    </div>
                    {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                    <div className="flex justify-end">
                        <Button size="sm" onClick={handleSave} disabled={saving || loading}>
                            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
