"use client";

import { useState, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import { HierarquiaPerfil } from "@/src/domain/hierarquia-perfil/HierarquiaPerfil";

export function useSaveHierarquiaPerfil() {
    const [saving, setSaving] = useState(false);

    const save = useCallback(async (perfil: HierarquiaPerfil) => {
        setSaving(true);
        try {
            const c = await getContainerAsync();
            await c.hierarquiaPerfilRepository.save(perfil);
        } finally {
            setSaving(false);
        }
    }, []);

    return { save, saving };
}

export function useDeleteHierarquiaPerfil() {
    const [deleting, setDeleting] = useState(false);

    const remove = useCallback(async (perfil: string) => {
        setDeleting(true);
        try {
            const c = await getContainerAsync();
            await c.hierarquiaPerfilRepository.delete(perfil);
        } finally {
            setDeleting(false);
        }
    }, []);

    return { remove, deleting };
}
