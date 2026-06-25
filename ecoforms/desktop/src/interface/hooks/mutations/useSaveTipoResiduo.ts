"use client";

import { useState, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import { TipoResiduo } from "@/src/domain/tipo-residuo/TipoResiduo";

export function useSaveTipoResiduo() {
    const [saving, setSaving] = useState(false);

    const save = useCallback(async (tipo: TipoResiduo) => {
        setSaving(true);
        try {
            const c = await getContainerAsync();
            await c.tipoResiduoRepository.save(tipo);
        } finally {
            setSaving(false);
        }
    }, []);

    return { save, saving };
}

export function useDeleteTipoResiduo() {
    const [deleting, setDeleting] = useState(false);

    const remove = useCallback(async (id: string) => {
        setDeleting(true);
        try {
            const c = await getContainerAsync();
            await c.tipoResiduoRepository.delete(id);
        } finally {
            setDeleting(false);
        }
    }, []);

    return { remove, deleting };
}
