/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { useUserUseCases } from "../domain/useUserUseCases";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@/types";
import type { CreateUserInput, UpdateUserInput, UserDto } from "@/src/application/user/dto/UserDto";

const USER_PROFILES: User["perfil"][] = ["gerente", "coordenador", "campo", "admin", "operador", "encarregado"];

type AdminUserFormData = Partial<User> & {
    email?: string;
    password_hash?: string;
};

function normalizePerfil(perfil: string): User["perfil"] {
    return USER_PROFILES.includes(perfil as User["perfil"]) ? (perfil as User["perfil"]) : "operador";
}

function normalizeUser(user: UserDto): User {
    return {
        id: user.id,
        username: user.username,
        nome: user.nome,
        perfil: normalizePerfil(user.perfil),
        ativo: Boolean(user.ativo),
        created_at: user.criadoEm ?? "",
        setores: user.setores,
    };
}

function toCreateUserInput(userData: AdminUserFormData): CreateUserInput {
    if (!userData.nome || !userData.username || !userData.perfil) {
        throw new Error("Dados obrigatórios do usuário não informados.");
    }

    return {
        nome: userData.nome,
        username: userData.username,
        email: userData.email,
        perfil: userData.perfil,
        passwordHash: userData.password_hash ?? "",
        setores: userData.setores ?? [],
    };
}

function toUpdateUserInput(userId: string, userData: AdminUserFormData): UpdateUserInput {
    return {
        id: userId,
        nome: userData.nome,
        username: userData.username,
        email: userData.email,
        perfil: userData.perfil,
        ativo: userData.ativo,
        setores: userData.setores,
    };
}

export function useAdminUsers() {
    const uc = useUserUseCases();
    const { user: authUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            const items = await uc.list.execute();
            setUsers(items.map(normalizeUser));
        } catch (error) {
            console.error("Erro ao carregar usuários:", error);
        } finally {
            setLoading(false);
        }
    }, [uc]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const toggleUserStatus = async (user: User) => {
        const updated = await uc.toggleStatus.execute(user.id);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ativo: updated.ativo } : u)));
    };

    const updateUser = async (userId: string, userData: AdminUserFormData) => {
        await uc.update.execute(toUpdateUserInput(userId, userData), authUser?.perfil ?? 'operador');
        setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, ...userData, ativo: userData.ativo !== undefined ? !!userData.ativo : u.ativo } : u))
        );
    };

    const createUser = async (userData: AdminUserFormData) => {
        await uc.create.execute(toCreateUserInput(userData), authUser?.perfil ?? 'operador');
        await loadUsers();
    };

    return {
        users,
        loading,
        loadUsers,
        toggleUserStatus,
        updateUser,
        createUser,
    };
}

export function useAllUsers() {
    const uc = useUserUseCases();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        uc.list.execute().then((items) => {
            if (!mounted) return;
            setUsers(items.map(normalizeUser));
            setLoading(false);
        }).catch(() => {
            if (!mounted) return;
            setUsers([]);
            setLoading(false);
        });
        return () => { mounted = false; };
    }, [uc]);

    return { users, loading };
}
