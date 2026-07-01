"use client";

import { useState, useCallback } from "react";
import { getContainerAsync } from "../utils/useContainer";
import { TipoPrazo } from "@/src/domain/tipo-prazo/TipoPrazo";

export function useSaveTipoPrazo() {
    const [saving, setSaving] = useState(false);

    const save = useCallback(async (tipo: TipoPrazo) => {
        setSaving(true);
        try {
            const c = await getContainerAsync();
            await c.tipoPrazoRepository.save(tipo);
        } finally {
            setSaving(false);
        }
    }, []);

    return { save, saving };
}

export function useDeleteTipoPrazo() {
    const [deleting, setDeleting] = useState(false);

    const remove = useCallback(async (id: string) => {
        setDeleting(true);
        try {
            const c = await getContainerAsync();
            await c.tipoPrazoRepository.delete(id);
        } finally {
            setDeleting(false);
        }
    }, []);

    return { remove, deleting };
}
