"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Play, RotateCcw, Eye, EyeOff, Copy, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { openInNewWindow } from "@/src/lib/window-utils";
import { FormRegistry } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFormRegistryData } from "@/src/interface/hooks/catalog/forms";

const PAGE_SIZE = 20;

export default function FormsPage() {
    const [showInactive, setShowInactive] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const { forms, loading, softDelete, restore, clone } = useFormRegistryData(showInactive);

    async function handleSoftDelete(formId: string, formTitle: string) {
        if (!confirm(`Deseja desativar o formulário "${formTitle}"?\n\nRegistros existentes ainda poderão ser visualizados.`)) return;
        try {
            await softDelete(formId);
            alert("Formulário desativado com sucesso!");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            alert("Erro ao desativar: " + message);
        }
    }

    async function handleRestore(formId: string) {
        try {
            await restore(formId);
            alert("Formulário reativado!");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            alert("Erro ao reativar: " + message);
        }
    }

    async function handleClone(originalId: string, originalTitle: string) {
        const newTitle = prompt(`Clonar "${originalTitle}"\n\nDigite o novo título:`, `${originalTitle} (Cópia)`);
        if (!newTitle) return;
        const suggestedId = newTitle.toLowerCase()
            .normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]/g, "_")
            .replace(/_+/g, "_");
        const newId = prompt(`Confirme o ID do novo formulário (único):`, suggestedId);
        if (!newId) return;
        try {
            await clone(originalId, newId, newTitle);
            alert(`Formulário clonado com sucesso!\nNovo ID: ${newId}`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("UNIQUE constraint failed")) {
                alert("Erro: Já existe um formulário com este ID.");
            } else {
                alert("Erro ao clonar: " + message);
            }
        }
    }

    const filteredForms = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return forms;
        return forms.filter(f =>
            f.titulo.toLowerCase().includes(q) ||
            f.form_id.toLowerCase().includes(q)
        );
    }, [forms, search]);

    const totalPages = Math.max(1, Math.ceil(filteredForms.length / PAGE_SIZE));
    const pagedForms = filteredForms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    useEffect(() => { setPage(1); }, [search, showInactive]);

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Formulários</h1>
                    <p className="text-muted-foreground">
                        Gerencie os modelos de formulários do sistema.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/forms/edit?id=new">
                        <Plus className="mr-2 h-4 w-4" /> Novo Formulário
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Todos os Formulários</CardTitle>
                            <CardDescription>
                                {filteredForms.length} formulário{filteredForms.length !== 1 ? 's' : ''} encontrado{filteredForms.length !== 1 ? 's' : ''}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar por título ou ID..."
                                    className="pl-8 h-9 w-56"
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                {showInactive ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                <Switch
                                    id="show-inactive"
                                    checked={showInactive}
                                    onCheckedChange={setShowInactive}
                                />
                                <Label htmlFor="show-inactive" className="text-sm">
                                    Inativos
                                </Label>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Versão</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Criado Em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10">Carregando...</TableCell>
                                </TableRow>
                            ) : forms.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                        Nenhum formulário encontrado.
                                    </TableCell>
                                </TableRow>
                            ) : filteredForms.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                        Nenhum formulário corresponde à busca.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pagedForms.map((form) => {
                                    const isActive = form.ativo === 1 || form.ativo === true;
                                    return (
                                        <TableRow key={form.form_id} className={!isActive ? "opacity-60" : ""}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{form.titulo}</span>
                                                    <span className="text-xs text-muted-foreground">{form.form_id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">v{form.versao}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {isActive ? (
                                                    <Badge className="bg-green-500">Ativo</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Inativo</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(form.criado_em).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right flex justify-end space-x-2">
                                                {isActive && (
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => openInNewWindow(`/run?id=${form.form_id}`, `run-${form.form_id}`, `Executar: ${form.titulo}`)}
                                                        title="Executar Formulário"
                                                    >
                                                        <Play className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleClone(form.form_id, form.titulo)}
                                                    title="Clonar Formulário"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" asChild>
                                                    <Link href={`/forms/edit?id=${form.form_id}`}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                {isActive ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => handleSoftDelete(form.form_id, form.titulo)}
                                                        title="Desativar formulário"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-green-500 hover:text-green-600 hover:bg-green-50"
                                                        onClick={() => handleRestore(form.form_id)}
                                                        title="Reativar formulário"
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                                Página {page} de {totalPages} · {filteredForms.length} resultados
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
