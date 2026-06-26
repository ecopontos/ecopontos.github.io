"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getContainerAsync } from "@/src/interface/hooks/utils/useContainer";
import type { ModuleRegistry } from "@/src/domain/module/ModuleRegistry";

export default function EditModuleClient() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mod, setMod] = useState<ModuleRegistry | null>(null);
    const [form, setForm] = useState({
        name: "",
        description: "",
        icon: "",
        color: "",
        prefix: "",
        ordem: "0",
    });

    useEffect(() => {
        async function load() {
            try {
                const c = await getContainerAsync();
                const all = await c.modules.list.execute();
                const found = all.find(m => m.id === id);
                if (!found) { toast.error("Módulo não encontrado"); return; }
                setMod(found);
                setForm({
                    name: found.name,
                    description: found.description ?? "",
                    icon: found.icon ?? "",
                    color: found.color ?? "",
                    prefix: found.prefix ?? "",
                    ordem: String(found.ordem ?? 0),
                });
            } catch {
                toast.error("Erro ao carregar módulo");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
        setSaving(true);
        try {
            const c = await getContainerAsync();
            await c.modules.updateConfig.execute({
                id,
                name: form.name.trim(),
                description: form.description.trim() || null,
                icon: form.icon.trim() || null,
                color: form.color.trim() || null,
                prefix: form.prefix.trim(),
                ordem: parseInt(form.ordem, 10) || 0,
            });
            toast.success("Módulo atualizado");
            router.push("/admin/modules");
        } catch {
            toast.error("Erro ao salvar módulo");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!mod) {
        return (
            <div className="container mx-auto p-6">
                <p className="text-muted-foreground">Módulo não encontrado.</p>
                <Link href="/admin/modules" className="text-sm text-primary underline mt-2 block">Voltar</Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-xl space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/admin/modules">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Editar Módulo</h1>
                    <p className="text-sm text-muted-foreground">/{mod.slug} — {mod.entity_type}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Metadados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Nome *</Label>
                        <Input
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Ex: Fiscalização Ambiental"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Descrição</Label>
                        <Input
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Descrição curta do módulo"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Ícone</Label>
                            <Input
                                value={form.icon}
                                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                                placeholder="Ex: ClipboardList"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Cor</Label>
                            <Input
                                value={form.color}
                                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                                placeholder="Ex: #3b82f6"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Prefix</Label>
                            <Input
                                value={form.prefix}
                                onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
                                placeholder="Ex: FSC"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Ordem</Label>
                            <Input
                                type="number"
                                min={0}
                                value={form.ordem}
                                onChange={e => setForm(f => ({ ...f, ordem: e.target.value }))}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                <Link href="/admin/modules">
                    <Button variant="outline">Cancelar</Button>
                </Link>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar
                </Button>
            </div>
        </div>
    );
}
