"use client"
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { invoke } from "@/src/interface/hooks/tauri/useTauriInvoke"
import { fetchSetoresAll, fetchEscalas } from "@/src/interface/hooks/queries/lookups"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { User } from "@/types"
import { Loader2 } from "lucide-react"

type UserPerfil = User["perfil"]

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message
    }

    if (typeof error === "string") {
        return error
    }

    try {
        return JSON.stringify(error)
    } catch {
        return "Erro desconhecido"
    }
}


interface UserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: User | null // null = create mode
    onSave: (user: Partial<User>) => Promise<void>
}

export function UserDialog({ open, onOpenChange, user, onSave }: UserDialogProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<Partial<User>>({
        username: "",
        nome: "",
        perfil: "operador",
        ativo: true,
        password: "",
        setores: []
    })
    const [availableSectors, setAvailableSectors] = useState<{ id: string, nome: string }[]>([])
    const [availableEscalas, setAvailableEscalas] = useState<{ id: string, nome: string }[]>([])

    // Reset form and load sectors
    useEffect(() => {
        const loadSectors = async () => {
            try {
                const sectorData = await fetchSetoresAll();
                setAvailableSectors(sectorData);
            } catch (error) {
                console.error("Erro ao carregar setores no dialog:", error);
            }

            try {
                const escResult = await fetchEscalas();
                setAvailableEscalas(escResult);
            } catch {
                setAvailableEscalas([]);
            }
        };

        if (open) {
            loadSectors();
            if (user) {
                setFormData({
                    ...user,
                    password: "",
                    setores: user.setores || [],
                    escala_id: user.escala_id ?? null,
                })
            } else {
                setFormData({
                    username: "",
                    nome: "",
                    perfil: "operador",
                    ativo: true,
                    password: "",
                    setores: [],
                    escala_id: null,
                })
            }
        }
    }, [user, open])

    const handleSave = async () => {
        try {
            setLoading(true)

            const dataToSave: Partial<User> = { ...formData }

            // Basic validation
            if (!dataToSave.username || !dataToSave.nome) {
                toast.error("Preencha campos obrigatórios (Nome, Usuário)")
                return
            }

            // Hash password if provided and store in password_hash field
            if (dataToSave.password) {
                // Hash the password using bcrypt via Rust backend
                const hashedPassword = await invoke<string>('hash_password', { password: dataToSave.password })
                dataToSave.password_hash = hashedPassword
                // Remove the password field as it doesn't exist in the database
                delete dataToSave.password
            } else {
                // If editing and no password provided, remove both fields so we don't overwrite
                delete dataToSave.password
                delete dataToSave.password_hash
            }


            // Remove any undefined or null values to prevent database errors
            Object.keys(dataToSave).forEach(key => {
                if (dataToSave[key as keyof typeof dataToSave] === undefined ||
                    dataToSave[key as keyof typeof dataToSave] === null) {
                    delete dataToSave[key as keyof typeof dataToSave]
                }
            })

            await onSave(dataToSave)
            onOpenChange(false)
        } catch (error: unknown) {
            console.error("Erro ao salvar usuário:", error);
            console.error("Erro completo:", JSON.stringify(error, null, 2));
            const errorMessage = getErrorMessage(error)
            toast.error(`Erro ao salvar usuário: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    }

    const toggleSectorAssignment = (sectorId: string) => {
        const current = formData.setores || []
        if (current.includes(sectorId)) {
            setFormData({ ...formData, setores: current.filter(id => id !== sectorId) })
        } else {
            setFormData({ ...formData, setores: [...current, sectorId] })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{user ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nome">Nome Completo</Label>
                            <Input
                                id="nome"
                                value={formData.nome || ""}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="username">Usuário (Login)</Label>
                            <Input
                                id="username"
                                value={formData.username || ""}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                disabled={!!user} // Disable username editing if existing user (optional, prevents ID issues)
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Senha {user && "(deixe em branco para manter)"}</Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password || ""}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="perfil">Perfil</Label>
                            <Select
                                value={formData.perfil || "operador"}
                                onValueChange={(val: UserPerfil) => setFormData({ ...formData, perfil: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o perfil" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="operador">Operador</SelectItem>
                                    <SelectItem value="campo">Campo</SelectItem>
                                    <SelectItem value="encarregado">Encarregado</SelectItem>
                                    <SelectItem value="coordenador">Coordenador</SelectItem>
                                    <SelectItem value="gerente">Gerente</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="grid gap-2">
                            <Label>Setores / Grupos de Acesso</Label>
                            <div className="border rounded-md p-3 bg-gray-50/50">
                                <ScrollArea className="h-[120px]">
                                    {availableSectors.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">Nenhum setor cadastrado. Vá em Administração {">"} Setores.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {availableSectors.map((s) => (
                                                <div key={s.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`sector-${s.id}`}
                                                        checked={(formData.setores || []).includes(s.id)}
                                                        onCheckedChange={() => toggleSectorAssignment(s.id)}
                                                    />
                                                    <Label htmlFor={`sector-${s.id}`} className="text-xs font-normal cursor-pointer truncate">
                                                        {s.nome}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    </div>

                    {/* Escala de turno — apenas para perfis de campo/operador */}
                    {(formData.perfil === 'operador' || formData.perfil === 'campo') && (
                        <div className="grid gap-2">
                            <Label htmlFor="escala_id">
                                Escala de Turno
                                <span className="text-xs text-muted-foreground ml-1">(opcional — bloqueia login fora do turno)</span>
                            </Label>
                            <Select
                                value={formData.escala_id ?? "__none__"}
                                onValueChange={val => setFormData({ ...formData, escala_id: val === "__none__" ? null : val })}
                            >
                                <SelectTrigger id="escala_id">
                                    <SelectValue placeholder="Sem restrição de horário" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Sem restrição de horário</SelectItem>
                                    {availableEscalas.map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                    ))}
                                    {availableEscalas.length === 0 && (
                                        <SelectItem value="__empty__" disabled>
                                            Nenhuma escala cadastrada
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="ativo"
                            checked={formData.ativo}
                            onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                        />
                        <Label htmlFor="ativo">Usuário Ativo</Label>
                    </div>

                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
