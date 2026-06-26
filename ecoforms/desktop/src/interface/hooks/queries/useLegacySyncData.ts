"use client";

import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useState, useCallback, useEffect } from "react";
import { fetchRoteirosFiltered, fetchPesagensFiltered, fetchLegacyFilterOptions, getSistemaConfig, saveSistemaConfig } from "@/src/interface/hooks/queries/lookups";

function isTauri() {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface RoteiroRow {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    periodicidade: string | null;
    turno: string | null;
    base: string | null;
    situacao: string;
    criado_em: string;
    atualizado_em: string;
}

export interface PesagemRow {
    id: string;
    id_balanca: number | null;
    id_despacho: number | null;
    codigo_despacho: string | null;
    data_pesagem: string | null;
    veiculo: string | null;
    residuo: string | null;
    origem: string | null;
    destino: string | null;
    tipo_coleta: string | null;
    peso_liquido: number | null;
    status_despacho: string | null;
}

export interface LegacySyncFilters {
    roteiroSituacao: string;
    roteiroBase: string;
    roteiroTurno: string;
    pesagemResiduo: string;
    pesagemDestino: string;
    pesagemDataInicio: string;
    pesagemDataFim: string;
}

export const DEFAULT_FILTERS: LegacySyncFilters = {
    roteiroSituacao: "",
    roteiroBase: "",
    roteiroTurno: "",
    pesagemResiduo: "",
    pesagemDestino: "",
    pesagemDataInicio: "",
    pesagemDataFim: "",
};

export interface PgLegacyConfig {
    pgHost: string;
    pgPort: number;
    pgDb: string;
    pgUser: string;
    pgPassword: string;
}

const PG_DEFAULTS: PgLegacyConfig = {
    pgHost: "172.16.76.202",
    pgPort: 5432,
    pgDb: "geo_fpolis",
    pgUser: "smma",
    pgPassword: "",
};

export function usePgLegacyConfig() {
    const [config, setConfig] = useState<PgLegacyConfig>(PG_DEFAULTS);
    const [loading, setLoading] = useState(() => isTauri());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isTauri()) return;
        (async () => {
            const [host, port, db, user, password] = await Promise.all([
                getSistemaConfig("pg_legacy_host"),
                getSistemaConfig("pg_legacy_port"),
                getSistemaConfig("pg_legacy_db"),
                getSistemaConfig("pg_legacy_user"),
                getSistemaConfig("pg_legacy_password"),
            ]);
            setConfig({
                pgHost: host ?? PG_DEFAULTS.pgHost,
                pgPort: port ? parseInt(port, 10) : PG_DEFAULTS.pgPort,
                pgDb: db ?? PG_DEFAULTS.pgDb,
                pgUser: user ?? PG_DEFAULTS.pgUser,
                pgPassword: password ?? PG_DEFAULTS.pgPassword,
            });
            setLoading(false);
        })();
    }, []);

    const saveConfig = useCallback(async (next: PgLegacyConfig) => {
        setSaving(true);
        try {
            await Promise.all([
                saveSistemaConfig("pg_legacy_host", next.pgHost),
                saveSistemaConfig("pg_legacy_port", String(next.pgPort)),
                saveSistemaConfig("pg_legacy_db", next.pgDb),
                saveSistemaConfig("pg_legacy_user", next.pgUser),
                saveSistemaConfig("pg_legacy_password", next.pgPassword),
            ]);
            setConfig(next);
        } finally {
            setSaving(false);
        }
    }, []);

    return { config, loading, saving, saveConfig };
}

export function useLegacySyncData(filters: LegacySyncFilters, limit = 10) {
    const roteirosQuery = useQuery<RoteiroRow[]>({
        queryKey: ["legacy-sync-roteiros", filters.roteiroSituacao, filters.roteiroBase, filters.roteiroTurno, limit],
        queryFn: () => fetchRoteirosFiltered({
            situacao: filters.roteiroSituacao,
            base: filters.roteiroBase,
            turno: filters.roteiroTurno,
            limit,
        }) as unknown as Promise<RoteiroRow[]>,
        enabled: isTauri(),
    });

    const pesagensQuery = useQuery<PesagemRow[]>({
        queryKey: [
            "legacy-sync-pesagens",
            filters.pesagemResiduo,
            filters.pesagemDestino,
            filters.pesagemDataInicio,
            filters.pesagemDataFim,
            limit,
        ],
        queryFn: () => fetchPesagensFiltered({
            residuo: filters.pesagemResiduo,
            destino: filters.pesagemDestino,
            dataInicio: filters.pesagemDataInicio,
            dataFim: filters.pesagemDataFim,
            limit,
        }) as unknown as Promise<PesagemRow[]>,
        enabled: isTauri(),
    });

    const filterOptionsQuery = useQuery({
        queryKey: ["legacy-sync-filter-options"],
        queryFn: fetchLegacyFilterOptions,
        enabled: isTauri(),
    });

    return {
        roteiros: roteirosQuery.data ?? [],
        pesagens: pesagensQuery.data ?? [],
        filterOptions: filterOptionsQuery.data ?? { bases: [], turnos: [], residuos: [], destinos: [] },
        loading: roteirosQuery.isLoading || pesagensQuery.isLoading || filterOptionsQuery.isLoading,
        refetch: () => {
            roteirosQuery.refetch();
            pesagensQuery.refetch();
            filterOptionsQuery.refetch();
        },
    };
}

export function useLegacySyncActions(config: PgLegacyConfig) {
    const [syncingRoteiros, setSyncingRoteiros] = useState(false);
    const [syncingPesagens, setSyncingPesagens] = useState(false);
    const [roteiroResult, setRoteiroResult] = useState<string | null>(null);
    const [pesagemResult, setPesagemResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const syncRoteiros = useCallback(async () => {
        setSyncingRoteiros(true);
        setError(null);
        try {
            const result = await invoke<{ inseridos: number; atualizados: number; erros: number; total_externo: number; mensagem: string }>(
                "sync_roteiros_externos",
                {
                    ...config,
                },
            );
            setRoteiroResult(result.mensagem);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSyncingRoteiros(false);
        }
    }, [config]);

    const syncPesagens = useCallback(async (dataInicio: string, dataFim: string) => {
        setSyncingPesagens(true);
        setError(null);
        try {
            const result = await invoke<{
                inseridos: number;
                atualizados: number;
                execucoes_criadas: number;
                erros: number;
                total_externo: number;
                mensagem: string;
                detalhes_erros: string[];
            }>("sync_pesagens_externas", { ...config, dataInicio, dataFim });
            setPesagemResult(
                result.detalhes_erros.length > 0
                    ? `${result.mensagem}\n${result.detalhes_erros.join("\n")}`
                    : result.mensagem,
            );
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSyncingPesagens(false);
        }
    }, [config]);

    return { syncingRoteiros, syncingPesagens, roteiroResult, pesagemResult, error, syncRoteiros, syncPesagens };
}
