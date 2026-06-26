"use client"

import { useState } from "react"
import { User } from "@/types"
import { UserList } from "@/components/users/UserList"
import { UserDialog } from "@/components/users/UserDialog"
import { Button } from "@/components/ui/button"
import { Plus, LayoutDashboard, Users, RefreshCw } from "lucide-react"
import { useSupabaseAdmin } from "@/src/interface/hooks/catalog/auth"
import type { UserRole } from "@/src/interface/hooks/utils/usePermissions"
import type { ProfileSyncResult } from "@/src/interface/hooks/queries/useSupabaseAdmin"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { ProtectedPage, RequirePermission } from "@/components/auth/PermissionGuards"
import { useSyncStatus } from "@/contexts/SyncContext"
import { useAdminUsers } from "@/src/interface/hooks/catalog/auth"
import { toast } from "sonner"

export default function UsersPage() {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [syncResult, setSyncResult] = useState<ProfileSyncResult | null>(null)
    const [syncError, setSyncError] = useState<string | null>(null)

    const router = useRouter()
    const { permissions } = useAuth()
    const { syncNow } = useSyncStatus()
    const { users, loading, loadUsers, toggleUserStatus, updateUser, createUser } = useAdminUsers()
    const { syncing, syncFromSupabase } = useSupabaseAdmin()

    const handleSync = async () => {
        setSyncResult(null)
        setSyncError(null)
        try {
            const result = await syncFromSupabase()
            setSyncResult(result)
            await loadUsers()
        } catch (err) {
            setSyncError(String(err))
        }
    }

    const handleCreate = () => {
        if (!permissions.hasPermission("users.create")) {
            toast.error("Sem permissão para criar usuários")
            return
        }
        setSelectedUser(null)
        setDialogOpen(true)
    }

    const handleEdit = (user: User) => {
        if (!permissions.canEditUser(user)) {
            toast.error("Sem permissão para editar este usuário")
            return
        }
        setSelectedUser(user)
        setDialogOpen(true)
    }

    const handleToggleStatus = async (user: User) => {
        if (!permissions.hasPermission("users.edit")) {
            toast.error("Sem permissão para alterar status de usuários")
            return
        }
        try {
            await toggleUserStatus(user)
            syncNow()
        } catch (error) {
            console.error("Erro ao alterar status:", error)
            toast.error("Erro ao alterar status do usuário")
        }
    }

    const handleSave = async (userData: Partial<User>) => {
        if (selectedUser) {
            if (!permissions.hasPermission("users.edit")) {
                throw new Error("Você não tem permissão para editar usuários")
            }

            // Validação: apenas admin pode elevar para admin/gerente
            if (userData.perfil && userData.perfil !== selectedUser.perfil) {
                const newRole: string = userData.perfil;
                const isElevation = ['admin', 'gerente'].includes(newRole);
                const isAdmin = permissions.isAdmin?.() ?? false;
                const isManager = permissions.isManager?.() ?? false;

                if (isElevation && !isAdmin) {
                    throw new Error(
                        "Apenas administradores podem elevar usuários para Admin ou Gerente."
                    );
                }

                if (isManager && !isAdmin && newRole === 'gerente') {
                    throw new Error(
                        "Gerentes não podem elevar para Gerente. Apenas administradores podem."
                    );
                }
            }

            await updateUser(selectedUser.id, userData)
        } else {
            if (!permissions.hasPermission("users.create")) {
                throw new Error("Você não tem permissão para criar usuários")
            }
            if (userData.perfil && !permissions.canCreateUserWithRole(userData.perfil as UserRole)) {
                throw new Error(
                    "Você não tem permissão para criar usuários com este perfil. " +
                    "Gerentes só podem criar coordenadores, campo e operadores."
                )
            }
            await createUser(userData)
        }

        await loadUsers()
        syncNow()
    }

    return (
        <ProtectedPage permission="users.view_all">
            <div className="container mx-auto py-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Users className="h-8 w-8" />
                            Gestão de Usuários
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Gerencie acesso e permissões dos usuários do sistema
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push('/admin')}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            Voltar ao Admin
                        </Button>
                        <RequirePermission permission="users.edit">
                            <Button variant="outline" onClick={handleSync} disabled={syncing}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Sincronizando...' : 'Sincronizar Supabase'}
                            </Button>
                        </RequirePermission>
                        <RequirePermission permission="users.create">
                            <Button onClick={handleCreate}>
                                <Plus className="mr-2 h-4 w-4" />
                                Novo Usuário
                            </Button>
                        </RequirePermission>
                    </div>
                </div>

                {syncResult && (
                    <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        Sincronização concluída: {syncResult.synced} processados, {syncResult.created} criados, {syncResult.updated} atualizados.
                        {syncResult.errors.length > 0 && (
                            <span className="ml-2 text-yellow-700">({syncResult.errors.length} erro(s))</span>
                        )}
                    </div>
                )}
                {syncError && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        Erro na sincronização: {syncError}
                    </div>
                )}

                <UserList
                    users={users}
                    onEdit={handleEdit}
                    onToggleStatus={handleToggleStatus}
                    loading={loading}
                />

                <UserDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    user={selectedUser}
                    onSave={handleSave}
                />
            </div>
        </ProtectedPage>
    )
}
