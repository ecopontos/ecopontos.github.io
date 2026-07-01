"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { cloneFormRegistry } from "@/src/interface/hooks/queries/lookups/forms";
import type { FormRegistry } from "@/types";
import { useSqlite } from "./useSqlite";
import {
    FORM_REGISTRY_LIST_ATIVOS,
    FORM_REGISTRY_LIST_ALL,
    FORM_REGISTRY_SOFT_DELETE,
    FORM_REGISTRY_RESTORE,
    FORM_REGISTRY_GET,
} from "@/src/infrastructure/persistence/sqlite/queries/forms";

export function useFormRegistryData(showInactive: boolean) {
    const sqlite = useSqlite();
    const [forms, setForms] = useState<FormRegistry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchForms = useCallback(async () => {
        setLoading(true);
        try {
            const qdef = showInactive ? FORM_REGISTRY_LIST_ALL : FORM_REGISTRY_LIST_ATIVOS;
            const rows = await sqlite.query<FormRegistry>(qdef.sql);
            setForms(rows);
        } catch (e) {
            console.error("[useFormRegistryData]", e);
        } finally {
            setLoading(false);
        }
    }, [showInactive, sqlite]);

    useEffect(() => { fetchForms(); }, [fetchForms]);

    const softDelete = useCallback(async (formId: string) => {
        await sqlite.execute(FORM_REGISTRY_SOFT_DELETE.sql, [formId]);
        await fetchForms();
    }, [fetchForms, sqlite]);

    const restore = useCallback(async (formId: string) => {
        await sqlite.execute(FORM_REGISTRY_RESTORE.sql, [formId]);
        await fetchForms();
    }, [fetchForms, sqlite]);

    const clone = useCallback(async (originalId: string, newId: string, newTitle: string) => {
        const origRows = await sqlite.query<Record<string, unknown>>(FORM_REGISTRY_GET.sql, [originalId]);
        if (!origRows[0]) throw new Error("Formulário original não encontrado");
        const orig = origRows[0];
        await cloneFormRegistry({
            new_form_id: newId,
            new_titulo: newTitle,
            new_slug: newId,
            conteudo: String(orig.conteudo ?? ""),
            versao: "1.0",
            autor: String(orig.autor || "system"),
            auto_aprovacao: Number(orig.auto_aprovacao || 0),
            ad_hoc: Number(orig.ad_hoc || 0),
        });
        await fetchForms();
    }, [fetchForms, sqlite]);

    return { forms, loading, softDelete, restore, clone, refetch: fetchForms };
}
