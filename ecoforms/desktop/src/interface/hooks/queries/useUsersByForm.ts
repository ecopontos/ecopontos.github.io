/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from "react";
import { getContainerAsync } from "../utils/useContainer";
import { USUARIOS_COM_ACESSO_FORM } from "@/src/application/persistence/sqlite/queries/usuarios";

interface UserAccessInfoRow {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    acesso_explicito: boolean | number;
}

export interface UserAccessInfo {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    explicit_grant: boolean;
}

export function useUsersByForm(formId?: string) {
    const [users, setUsers] = useState<UserAccessInfo[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchUsers = useCallback(async (currentFormId: string) => {
        if (!currentFormId) {
            setUsers([]);
            return;
        }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.sqlite.query<UserAccessInfoRow>(
                USUARIOS_COM_ACESSO_FORM.sql,
                [currentFormId],
            );
            setUsers(rows.map(r => ({
                id: r.id,
                nome: r.nome,
                email: r.email,
                perfil: r.perfil,
                explicit_grant: Boolean(r.acesso_explicito),
            })));
        } catch (error) {
            console.error("Error fetching users by form access:", error);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (formId) {
            fetchUsers(formId);
        } else {
            setUsers([]);
            setLoading(false);
        }
    }, [formId, fetchUsers]);

    return { users, loading, refetch: () => formId && fetchUsers(formId) };
}
