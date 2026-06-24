"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Loader2, Clock } from "lucide-react";
import { ProtectedPage } from "@/components/auth/PermissionGuards";
import { useEscalas, type Escala } from "@/src/interface/hooks/queries/useEscalas";
import { toast } from "sonner";

type EscalaForm = Omit<Escala, 'id' | 'criado_em' | 'atualizado_em'>;

const DEFAULT_FORM: EscalaForm = {
    nome: "",
    tipo: "12x36",
    referencia_inicio: "",
    duracao_minutos: 439,
    tolerancia_minutos: 10,
    ciclo_horas: 48,
};

function formatMinutes(min: number) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}m` : `${h}h`;
}

export default function EscalasPage() {
    const { data: escalas, loading, create, update, remove } = useEscalas();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Escala | null>(null);
    const [selected, setSelected] = useState<Escala | null>(null);
    const [form, setForm] = useState<EscalaForm>(DEFAULT_FORM);
    const [saving, setSaving] = useState(false);

    const openCreate = () => {
        setSelected(null);
        setForm(DEFAULT_FORM);
        setDialogOpen(true);
    };

    const openEdit = (e: Escala) => {
        setSelected(e);
        setForm({
            nome: e.nome,
            tipo: e.tipo,
            referencia_inicio: e.referencia_inicio,
            duracao_minutos: e.duracao_minutos,
            tolerancia_minutos: e.tolerancia_minutos,
            ciclo_horas: e.ciclo_horas,
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.nome.trim() || !form.referencia_inicio) {
            toast.error("Nome e Referência de Início são obrigatórios");
            return;
        }
        setSaving(true);
        try {
            if (selected) {
                await update(selected.id, form);
                toast.success("Escala atualizada");
            } else {
                await create(form);
                toast.success("Escala criada");
            }
            setDialogOpen(false);
        } catch {
            toast.error("Erro ao salvar escala");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await remove(deleteTarget.id);
            toast.success("Escala removida");
        } catch {
            toast.error("Erro ao remover escala. Verifique se há usuários atribuídos.");
        } finally {
            setDeleteTarget(null);
        }
    };

    const setNum = (field: keyof EscalaForm, val: string) =>
        setForm(f => ({ ...f, [field]: parseInt(val, 10) || 0 }));

    return (
        <ProtectedPage permission="system.config">
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Clock className="h-6 w-6" /> Escalas de Turno
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Gerencie escalas 12×36 e atribua a operadores de campo.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" /> Nova Escala
                    </Button>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Escalas cadastradas</CardTitle>
                        <CardDescription>
                            Cada escala define uma âncora de ciclo. Usuários com <code>escala_id</code> têm
                            login bloqueado fora do turno calculado.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : escalas.length === 0 ? (
                            <p className="text-center py-8 text-muted-foreground text-sm">
                                Nenhuma escala cadastrada. Clique em "Nova Escala" para começar.
                            </p>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Referência de Início</TableHead>
                                            <TableHead>Duração</TableHead>
                                            <TableHead>Tolerância</TableHead>
                                            <TableHead>Ciclo</TableHead>
                                            <TableHead className="w-24"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {escalas.map(e => (
                                            <TableRow key={e.id}>
                                                <TableCell className="font-medium">{e.nome}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{e.tipo}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm font-mono">
                                                    {new Date(e.referencia_inicio).toLocaleString('pt-BR', {
                                                        day: '2-digit', month: '2-digit', year: '2-digit',
                                                        hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </TableCell>
                                                <TableCell>{formatMinutes(e.duracao_minutos)}</TableCell>
                                                <TableCell>±{e.tolerancia_minutos} min</TableCell>
                                                <TableCell>{e.ciclo_horas}h</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(e)}>
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(e)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Dialog de criação/edição */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>{selected ? "Editar Escala" : "Nova Escala"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label>Nome *</Label>
                                <Input
                                    placeholder="Ex: 12×36 Turno A"
                                    value={form.nome}
                                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Tipo</Label>
                                    <Input
                                        placeholder="12x36"
                                        value={form.tipo}
                                        onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Ciclo (horas)</Label>
                                    <Input
                                        type="number" min={1}
                                        value={form.ciclo_horas}
                                        onChange={e => setNum('ciclo_horas', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Referência de Início *</Label>
                                <Input
                                    type="datetime-local"
                                    value={form.referencia_inicio.slice(0, 16)}
                                    onChange={e => setForm(f => ({ ...f, referencia_inicio: e.target.value + ':00' }))}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Âncora de um turno real. O sistema calcula todos os turnos por aritmética modular.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label>Duração (min)</Label>
                                    <Input
                                        type="number" min={1}
                                        value={form.duracao_minutos}
                                        onChange={e => setNum('duracao_minutos', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">439 = 7h19m</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tolerância (min)</Label>
                                    <Input
                                        type="number" min={0}
                                        value={form.tolerancia_minutos}
                                        onChange={e => setNum('tolerancia_minutos', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">±min no login</p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Confirmação de exclusão */}
                <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remover escala "{deleteTarget?.nome}"?</AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </ProtectedPage>
    );
}
