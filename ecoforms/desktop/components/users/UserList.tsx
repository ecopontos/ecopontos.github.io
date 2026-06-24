"use client"

import { useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit2, Ban, CheckCircle, Download, Trash2 } from "lucide-react"
import { User } from "@/types"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"

interface UserListProps {
    users: User[]
    onEdit: (user: User) => void
    onToggleStatus: (user: User) => void
    loading?: boolean
}

export function UserList({ users, onEdit, onToggleStatus, loading }: UserListProps) {
    const { permissions } = useAuth();

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando usuários...</div>
    }

    if (users.length === 0) {
        return <div className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</div>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => {
                        // ✅ Verificar permissões para cada usuário
                        const canEdit = permissions.canEditUser(user);
                        const canToggleStatus = permissions.hasPermission("users.edit");

                        return (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.nome}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>
                                    <Badge variant={user.perfil === 'gerente' ? 'default' : 'secondary'}>
                                        {user.perfil}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {user.ativo ? (
                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                            Ativo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                                            Inativo
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {canEdit && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onEdit(user)}
                                                title="Editar"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {canToggleStatus && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onToggleStatus(user)}
                                                title={user.ativo ? "Desativar" : "Ativar"}
                                                className={user.ativo ? "text-red-500 hover:text-red-600" : "text-green-500 hover:text-green-600"}
                                            >
                                                {user.ativo ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                            </Button>
                                        )}
                                        {canEdit && (
                                            <>
                                                <Button variant="ghost" size="icon" asChild title="Exportar dados (LGPD)">
                                                    <Link href={`/admin/users/${user.id}/exportar`}>
                                                        <Download className="h-4 w-4 text-muted-foreground" />
                                                    </Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" asChild title="Eliminar dados (LGPD)">
                                                    <Link href={`/admin/users/${user.id}/eliminar`}>
                                                        <Trash2 className="h-4 w-4 text-red-400" />
                                                    </Link>
                                                </Button>
                                            </>
                                        )}
                                        {!canEdit && !canToggleStatus && (
                                            <span className="text-sm text-gray-400">Sem ações</span>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
