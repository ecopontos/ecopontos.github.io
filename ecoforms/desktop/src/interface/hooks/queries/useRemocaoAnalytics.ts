"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchRegistroDadosByTipoEcoponto } from "@/src/interface/hooks/queries/lookups/geo";

interface HistoricoEntry {
    timestamp: string;
    caixaId: string;
    tipo: string;
    ocupacao: number;
    removida: boolean;
}

interface VisitasHoraEntry {
    hora: string;
    visitas: number;
}

interface VeiculoMediaEntry {
    tipo: string;
    totalVisitas: number;
    veiculosDistintos: number;
    mediaPorVeiculo: number;
    inicioCiclo: string;
    fimCiclo: string;
}

export interface RemocaoAnalytics {
    historico: HistoricoEntry[];
    visitasPorHora: VisitasHoraEntry[];
    mediaPorVeiculo: VeiculoMediaEntry[];
    loading: boolean;
    error: string | null;
}

const RESIDUO_TO_CAIXA: Record<string, string> = {
    'entulhos': 'Entulho',
    'madeiras': 'Madeira',
    'podas': 'Poda',
    'reciclavel': 'Reciclável',
    'sucata-metal': 'Sucata',
    'vidros': 'Vidro',
};

const CAIXA_IDS = ['1', '2', '3', '4', '5', '6', '7'];
const CAIXA_TYPES: Record<string, string> = {
    '1': 'Entulho', '2': 'Madeira', '3': 'Poda',
    '4': 'Reciclável', '5': 'Rejeito', '6': 'Sucata', '7': 'Vidro',
};

export function useRemocaoAnalytics(ecopontoId: string | null) {
    const [analytics, setAnalytics] = useState<RemocaoAnalytics>({
        historico: [],
        visitasPorHora: [],
        mediaPorVeiculo: [],
        loading: false,
        error: null,
    });

    const fetch = useCallback(async () => {
        if (!ecopontoId) {
            setAnalytics(prev => ({ ...prev, historico: [], visitasPorHora: [], mediaPorVeiculo: [], loading: false, error: null }));
            return;
        }

        setAnalytics(prev => ({ ...prev, loading: true, error: null }));

        try {
            const [historicoRows, formRows] = await Promise.all([
                fetchRegistroDadosByTipoEcoponto('ecopontoCaixasForm', ecopontoId),
                fetchRegistroDadosByTipoEcoponto('ecopontoForm', ecopontoId),
            ]);

            const historico = parseHistorico(historicoRows);
            const visitasPorHora = computeVisitasPorHora(formRows);
            const mediaPorVeiculo = computeMediaPorVeiculo(formRows);

            setAnalytics({ historico, visitasPorHora, mediaPorVeiculo, loading: false, error: null });
        } catch (e) {
            setAnalytics(prev => ({
                ...prev,
                loading: false,
                error: e instanceof Error ? e.message : 'Falha ao carregar analytics',
            }));
        }
    }, [ecopontoId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { ...analytics, refetch: fetch };
}

function parseHistorico(rows: { conteudo: string; criado_em: string }[]): HistoricoEntry[] {
    const entries: HistoricoEntry[] = [];
    for (const row of rows) {
        try {
            const data = typeof row.conteudo === 'string' ? JSON.parse(row.conteudo) : row.conteudo;
            const caixasList = data.caixas_list || {};
            const ocupacao = caixasList.ocupacao || {};
            const removidas = caixasList.removidas || {};

            for (const caixaId of CAIXA_IDS) {
                const nivel = ocupacao[caixaId];
                if (nivel !== undefined && nivel !== null && nivel !== '') {
                    entries.push({
                        timestamp: row.criado_em,
                        caixaId,
                        tipo: CAIXA_TYPES[caixaId] || `Caixa ${caixaId}`,
                        ocupacao: parseInt(String(nivel), 10) || 0,
                        removida: removidas[caixaId] === true || removidas[caixaId] === 'true',
                    });
                }
            }
        } catch { /* skip malformed */ }
    }
    return entries;
}

function computeVisitasPorHora(rows: { conteudo: string; criado_em: string }[]): VisitasHoraEntry[] {
    const buckets: Record<string, Record<string, number>> = {};
    for (let h = 0; h < 24; h++) {
        const key = String(h).padStart(2, '0');
        buckets[key] = {};
    }

    for (const row of rows) {
        try {
            const data = typeof row.conteudo === 'string' ? JSON.parse(row.conteudo) : row.conteudo;
            const hora = extractHour(data);
            if (hora === null) continue;

            const residuos: string[] = Array.isArray(data.residuos) ? data.residuos : [];
            for (const r of residuos) {
                const caixa = RESIDUO_TO_CAIXA[r];
                if (caixa) {
                    buckets[hora][caixa] = (buckets[hora][caixa] || 0) + 1;
                }
            }
            buckets[hora]['Rejeito'] = (buckets[hora]['Rejeito'] || 0) + 1;
        } catch { /* skip */ }
    }

    const result: VisitasHoraEntry[] = [];
    for (let h = 0; h < 24; h++) {
        const key = String(h).padStart(2, '0');
        Object.entries(buckets[key]).forEach(([_tipo, count]) => {
            result.push({ hora: key, visitas: count });
        });
    }
    return result;
}

function extractHour(data: Record<string, unknown>): string | null {
    const horaField = (data.hora || data.timestamp || data.criado_em) as string | undefined;
    if (!horaField) return null;
    const hourMatch = horaField.match(/T?(\d{2}):/);
    if (hourMatch) return hourMatch[1];
    const num = parseInt(horaField, 10);
    if (!isNaN(num) && num >= 0 && num <= 23) return String(num).padStart(2, '0');
    return null;
}

function computeMediaPorVeiculo(rows: { conteudo: string; criado_em: string }[]): VeiculoMediaEntry[] {
    const byCaixa: Record<string, { placas: Set<string>; total: number }> = {};
    for (const key of Object.values(CAIXA_TYPES)) {
        byCaixa[key] = { placas: new Set(), total: 0 };
    }

    let minTs = '';
    let maxTs = '';

    for (const row of rows) {
        try {
            const data = typeof row.conteudo === 'string' ? JSON.parse(row.conteudo) : row.conteudo;
            const placa = (data.placa || '') as string;
            const residuos: string[] = Array.isArray(data.residuos) ? data.residuos : [];
            const ts = row.criado_em || '';

            if (!minTs || ts < minTs) minTs = ts;
            if (!maxTs || ts > maxTs) maxTs = ts;

            for (const r of residuos) {
                const caixa = RESIDUO_TO_CAIXA[r];
                if (caixa && placa) {
                    byCaixa[caixa].placas.add(placa);
                    byCaixa[caixa].total++;
                }
            }
            if (placa) {
                byCaixa['Rejeito'].placas.add(placa);
                byCaixa['Rejeito'].total++;
            }
        } catch { /* skip */ }
    }

    return Object.entries(byCaixa)
        .filter(([, v]) => v.total > 0)
        .map(([tipo, v]) => ({
            tipo,
            totalVisitas: v.total,
            veiculosDistintos: v.placas.size,
            mediaPorVeiculo: v.placas.size > 0 ? v.total / v.placas.size : 0,
            inicioCiclo: minTs,
            fimCiclo: maxTs,
        }));
}
