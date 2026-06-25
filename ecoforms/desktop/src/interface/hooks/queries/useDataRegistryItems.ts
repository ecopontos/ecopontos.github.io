"use client";

import { useState, useEffect, useCallback } from "react";
import { useDataRegistryUseCases } from "../domain/useDataRegistryUseCases";
import type { DataRegistryDto } from "@/src/application/data-registry/dto/DataRegistryDto";
import type { FormFieldValue } from "@/components/runtime/FormFieldRenderer";

export interface DataRegistryItemView extends Omit<DataRegistryDto, 'conteudo'> {
    conteudo: Record<string, FormFieldValue>;
    chave: string;
    versao: number;
    atualizado_em: string | undefined;
}

function toItemView(dto: DataRegistryDto): DataRegistryItemView {
    return {
        ...dto,
        conteudo: (dto.conteudo ?? {}) as Record<string, FormFieldValue>,
        chave: dto.id,
        versao: 1,
        atualizado_em: dto.atualizadoEm,
    };
}

export function useDataRegistryItemsNew(tipo: string | null): {
    items: DataRegistryItemView[];
    loading: boolean;
    refetch: () => void;
} {
    const dr = useDataRegistryUseCases();
    const [items, setItems] = useState<DataRegistryItemView[]>([]);
    const [loading, setLoading] = useState(false);
    const [tick, setTick] = useState(0);

    const refetch = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!tipo) { if (!cancelled) setItems([]); return; }
            if (!cancelled) setLoading(true);
            try {
                const dtos = await dr.listByType.execute(tipo);
                if (!cancelled) { setItems(dtos.map(toItemView)); setLoading(false); }
            } catch {
                if (!cancelled) { setItems([]); setLoading(false); }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [tipo, dr.listByType, tick]);

    return { items, loading, refetch };
}
