"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, LayoutDashboard, Server, Edit, Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { ProtectedPage } from "@/components/auth/PermissionGuards"
import { useSyncStatus } from "@/contexts/SyncContext"
import { useSetores, type Setor } from "@/src/interface/hooks/queries/useSetores"

export default function SectorsPage() {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedSector, setSelectedSector] = useState<Setor | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const [formData, setFormData] = useState({ nome: "", descricao: "" })

    const router = useRouter()
    const { syncNow } = useSyncStatus()
    const { data: sectors, loading, create, update, remove } = useSetores(true)

    const handleCreate = () => {
        setSelectedSector(null)
        setFormData({ nome: "", descricao: "" })
        setDialogOpen(true)
    }

    const handleEdit = (sector: Setor) => {
        setSelectedSector(sector)
        setFormData({
            nome: sector.nome || "",
            descricao: sector.descricao || ""
        })
        setDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este setor? Isso pode afetar a visibilidade de registros associados.")) return;
        try {
            await remove(id)
            syncNow()
        } catch (error) {
            console.error("Erro ao excluir setor:", error)
            alert("Erro ao excluir setor.")
        }
    }

    const handleSave = async () => {
        if (!formData.nome) {
            alert("O nome do setor é obrigatório.")
            return
        }
        try {
            setIsSaving(true)
            if (selectedSector) {
                await update(selectedSector.id, formData.nome, formData.descricao)
            } else {
                await create(formData.nome, formData.descricao)
            }
            setDialogOpen(false)
            syncNow()
        } catch (error) {
            console.error("Erro ao salvar setor:", error)
            alert("Erro ao salvar setor.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <ProtectedPage permission="users.view_all">
            <div className="container mx-auto py-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Server className="h-8 w-8" />
                            Gestão de Setores
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Defina os grupos e setores para controle de acesso
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push('/admin')}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Voltar ao Admin
                        </Button>
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Setor
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Criado em</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                            <p className="mt-2 text-sm text-muted-foreground">Carregando setores...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : sectors.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                            Nenhum setor cadastrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sectors.map((sector) => (
                                        <TableRow key={sector.id}>
                                            <TableCell className="font-medium">{sector.nome}</TableCell>
                                            <TableCell>{sector.descricao || "—"}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {sector.criado_em ? new Date(sector.criado_em).toLocaleDateString() : "—"}
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(sector)}>
                                                    <Edit className="h-4 w-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(sector.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{selectedSector ? "Editar Setor" : "Novo Setor"}</DialogTitle>
                            <DialogDescription>
                                {selectedSector ? "Edite as informações do setor." : "Preencha os dados para criar um novo setor."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="nome">Nome do Setor</Label>
                                <Input
                                    id="nome"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    placeholder="Ex: Coleta Seletiva"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="descricao">Descrição</Label>
                                <Input
                                    id="descricao"
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    placeholder="Opcional"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedPage>
    )
}
