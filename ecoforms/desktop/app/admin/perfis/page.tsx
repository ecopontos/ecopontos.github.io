"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, LayoutDashboard, Shield, Edit, Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { ProtectedPage } from "@/components/auth/PermissionGuards"
import { useHierarquiaPerfis } from "@/src/interface/hooks/queries/useHierarquiaPerfis"
import { useSaveHierarquiaPerfil, useDeleteHierarquiaPerfil } from "@/src/interface/hooks/mutations/useSaveHierarquiaPerfil"
import { HierarquiaPerfil } from "@/src/domain/hierarquia-perfil/HierarquiaPerfil"
import { toast } from "sonner"

const NIVEL_LABELS: Record<number, string> = {
    0: "Administrador",
    1: "Gerente",
    2: "Coordenador",
    3: "Encarregado",
    4: "Operador/Campo",
}

export default function HierarquiaPerfisPage() {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedPerfil, setSelectedPerfil] = useState<HierarquiaPerfil | null>(null)

    const [formData, setFormData] = useState({ perfil: "", nivel: "4", descricao: "" })

    const router = useRouter()
    const { data: perfis, loading, refetch } = useHierarquiaPerfis()
    const { save, saving } = useSaveHierarquiaPerfil()
    const { remove, deleting } = useDeleteHierarquiaPerfil()

    const handleCreate = () => {
        setSelectedPerfil(null)
        setFormData({ perfil: "", nivel: "4", descricao: "" })
        setDialogOpen(true)
    }

    const handleEdit = (perfil: HierarquiaPerfil) => {
        setSelectedPerfil(perfil)
        setFormData({
            perfil: perfil.perfil,
            nivel: perfil.nivel.toString(),
            descricao: perfil.descricao || ""
        })
        setDialogOpen(true)
    }

    const handleDelete = async (perfil: string) => {
        if (!confirm(`Deseja realmente excluir o perfil "${perfil}"? Isso pode afetar usuários associados.`)) return
        try {
            await remove(perfil)
            await refetch()
            toast.success("Perfil excluído")
        } catch {
            toast.error("Erro ao excluir perfil")
        }
    }

    const handleSave = async () => {
        if (!formData.perfil.trim()) {
            toast.error("O nome do perfil é obrigatório")
            return
        }
        try {
            const nivel = parseInt(formData.nivel)
            const hierarquia = HierarquiaPerfil.fromProps({
                perfil: formData.perfil.trim().toLowerCase(),
                nivel,
                descricao: formData.descricao.trim() || NIVEL_LABELS[nivel] || null,
            })
            await save(hierarquia)
            await refetch()
            setDialogOpen(false)
            toast.success(selectedPerfil ? "Perfil atualizado" : "Perfil criado")
        } catch {
            toast.error("Erro ao salvar perfil")
        }
    }

    return (
        <ProtectedPage permission="users.view_all">
            <div className="container mx-auto py-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Shield className="h-8 w-8" />
                            Hierarquia de Perfis
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Configure os níveis hierárquicos para controle de acesso
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push('/admin')}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Voltar ao Admin
                        </Button>
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Perfil
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Perfil</TableHead>
                                    <TableHead>Nível</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                            <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : perfis.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                            Nenhum perfil cadastrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    perfis.map((perfil) => (
                                        <TableRow key={perfil.perfil}>
                                            <TableCell className="font-medium font-mono">{perfil.perfil}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono">
                                                    {perfil.nivel}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{perfil.descricao || "—"}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(perfil)}>
                                                    <Edit className="h-4 w-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(perfil.perfil)} disabled={deleting}>
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
                            <DialogTitle>{selectedPerfil ? "Editar Perfil" : "Novo Perfil"}</DialogTitle>
                            <DialogDescription>
                                {selectedPerfil ? "Edite as informações do perfil." : "Preencha os dados para criar um novo perfil."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="perfil">Nome do Perfil</Label>
                                <Input
                                    id="perfil"
                                    value={formData.perfil}
                                    onChange={(e) => setFormData({ ...formData, perfil: e.target.value })}
                                    placeholder="Ex: admin, gerente, operador"
                                    disabled={!!selectedPerfil}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use letras minúsculas, sem espaços. Este é o identificador único do perfil.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="nivel">Nível Hierárquico</Label>
                                <Input
                                    id="nivel"
                                    type="number"
                                    min="0"
                                    max="10"
                                    value={formData.nivel}
                                    onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
                                    placeholder="0-10"
                                />
                                <p className="text-xs text-muted-foreground">
                                    0 = mais alto (admin), números maiores = menor privilégio.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="descricao">Descrição</Label>
                                <Input
                                    id="descricao"
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                    placeholder="Ex: Administrador do sistema"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedPage>
    )
}
