"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import type { PgLegacyConfig } from "@/src/interface/hooks/catalog/logistica";

export function PgConfigCard({
    config,
    saving,
    onSave,
}: {
    config: PgLegacyConfig;
    saving: boolean;
    onSave: (c: PgLegacyConfig) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<PgLegacyConfig>(config);
    const [showPassword, setShowPassword] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleOpen = () => {
        setDraft(config);
        setOpen(true);
        setSaved(false);
    };

    const handleSave = async () => {
        await onSave(draft);
        setSaved(true);
        setTimeout(() => setOpen(false), 800);
    };

    const field = (key: keyof PgLegacyConfig, label: string, type = "text") => (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <Input
                className="h-8 text-xs font-mono"
                type={key === "pgPassword" ? (showPassword ? "text" : "password") : type}
                value={key === "pgPort" ? String(draft[key]) : (draft[key] as string)}
                onChange={(e) =>
                    setDraft((prev) => ({
                        ...prev,
                        [key]: key === "pgPort" ? parseInt(e.target.value || "5432", 10) : e.target.value,
                    }))
                }
            />
        </div>
    );

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Settings className="size-4 text-muted-foreground" />
                        <div>
                            <CardTitle className="text-sm">Conexão PostgreSQL</CardTitle>
                            <CardDescription className="text-xs">
                                {config.pgUser}@{config.pgHost}:{config.pgPort}/{config.pgDb}
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={open ? () => setOpen(false) : handleOpen}>
                        {open ? "Cancelar" : "Editar"}
                    </Button>
                </div>
            </CardHeader>
            {open && (
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {field("pgHost", "Host")}
                        {field("pgPort", "Porta", "number")}
                        {field("pgDb", "Banco")}
                        {field("pgUser", "Usuário")}
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Senha</Label>
                        <div className="flex gap-2">
                            <Input
                                className="h-8 flex-1 text-xs font-mono"
                                type={showPassword ? "text" : "password"}
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
                    </div>
                    <div className="flex justify-end">
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
