"use client";
import { useTauriQuery } from "@/src/interface/hooks/catalog/tauri";
import { PACOTES_ECOPONTO_CAIXAS_ATUAIS } from "@/src/infrastructure/persistence/sqlite/queries/pacotes";

interface CaixasRow {
    id: string;
    criado_em: string;
    dados: string;
    user_id: string;
}

export function useCaixasData() {
    const { data, isPending, refetch } = useTauriQuery<CaixasRow>(
        PACOTES_ECOPONTO_CAIXAS_ATUAIS.sql,
        [],
    );

    return {
        rawData: data ?? [],
        loading: isPending,
        refetch,
    };
}
