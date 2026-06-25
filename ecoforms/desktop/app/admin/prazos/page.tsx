"use client"

import { useState } from "react"
import { uuidv7 } from "ecoforms-core"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, LayoutDashboard, Clock, Edit, Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { ProtectedPage } from "@/components/auth/PermissionGuards"
import { useTiposPrazo } from "@/src/interface/hooks/queries/useTiposPrazo"
import { useSaveTipoPrazo, useDeleteTipoPrazo } from "@/src/interface/hooks/mutations/useSaveTipoPrazo"
import { TipoPrazo } from "@/src/domain/tipo-prazo/TipoPrazo"
import { toast } from "sonner"

export default function TiposPrazoPage() {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedTipo, setSelectedTipo] = useState<TipoPrazo | null>(null)

    const [formData, setFormData] = useState({ nome: "", diasPadrao: "", ativo: true })

    const router = useRouter()
    const { data: tipos, loading, refetch } = useTiposPrazo()
    const { save, saving } = useSaveTipoPrazo()
    const { remove, deleting } = useDeleteTipoPrazo()

    const handleCreate = () => {
        setSelectedTipo(null)
        setFormData({ nome: "", diasPadrao: "", ativo: true })
        setDialogOpen(true)
    }

    const handleEdit = (tipo: TipoPrazo) => {
        setSelectedTipo(tipo)
        setFormData({
            nome: tipo.nome,
            diasPadrao: tipo.diasPadrao?.toString() || "",
            ativo: tipo.ativo
        })
        setDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este tipo de prazo? Isso pode afetar manifestações associadas.")) return
        try {
            await remove(id)
            await refetch()
            toast.success("Tipo de prazo excluído")
        } catch {
            toast.error("Erro ao excluir tipo de prazo")
        }
    }

    const handleSave = async () => {
        if (!formData.nome.trim()) {
            toast.error("O nome é obrigatório")
            return
        }
        try {
            const tipo = TipoPrazo.fromProps({
                id: selectedTipo?.id || uuidv7(),
                nome: formData.nome.trim(),
                diasPadrao: formData.diasPadrao ? parseInt(formData.diasPadrao) : null,
                ativo: formData.ativo,
                criadoEm: selectedTipo?.criadoEm || new Date().toISOString(),
            })
            await save(tipo)
            await refetch()
            setDialogOpen(false)
            toast.success(selectedTipo ? "Tipo de prazo atualizado" : "Tipo de prazo criado")
        } catch {
            toast.error("Erro ao salvar tipo de prazo")
        }
    }

    return (
        <ProtectedPage permission="users.view_all">
            <div className="container mx-auto py-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Clock className="h-8 w-8" />
                            Tipos de Prazo
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Configure os tipos de prazo para manifestações da ouvidoria
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push('/admin')}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Voltar ao Admin
                        </Button>
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Tipo
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Dias Padrão</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Criado em</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                                            <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : tipos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            Nenhum tipo de prazo cadastrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tipos.map((tipo) => (
                                        <TableRow key={tipo.id}>
                                            <TableCell className="font-medium">{tipo.nome}</TableCell>
                                            <TableCell>{tipo.diasPadrao ? `${tipo.diasPadrao} dias` : "—"}</TableCell>
                                            <TableCell>
                                                <Badge variant={tipo.ativo ? "default" : "secondary"}>
                                                    {tipo.ativo ? "Ativo" : "Inativo"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {tipo.criadoEm ? new Date(tipo.criadoEm).toLocaleDateString() : "—"}
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(tipo)}>
                                                    <Edit className="h-4 w-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(tipo.id)} disabled={deleting}>
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
                            <DialogTitle>{selectedTipo ? "Editar Tipo de Prazo" : "Novo Tipo de Prazo"}</DialogTitle>
                            <DialogDescription>
                                {selectedTipo ? "Edite as informações do tipo de prazo." : "Preencha os dados para criar um novo tipo de prazo."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="nome">Nome</Label>
                                <Input
                                    id="nome"
                                    value={formData.nome}
                                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                    placeholder="Ex: Resposta Inicial, Conclusão"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="diasPadrao">Dias Padrão</Label>
                                <Input
                                    id="diasPadrao"
                                    type="number"
                                    value={formData.diasPadrao}
                                    onChange={(e) => setFormData({ ...formData, diasPadrao: e.target.value })}
                                    placeholder="Ex: 15 (deixe vazio para sem prazo)"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Número de dias padrão para este tipo de prazo. Deixe vazio se não houver prazo definido.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="ativo"
                                    checked={formData.ativo}
                                    onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
                                />
                                <Label htmlFor="ativo">Ativo</Label>
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
