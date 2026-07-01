import { useState, useEffect } from 'react';
import { useSqlite } from '../queries/useSqlite';
import { CEP_LOOKUP } from '@/src/application/persistence/sqlite/queries/system';

interface CEPData {
    CEP: string;
    logradouro?: string;
    bairro?: string;
    complemento?: string;
}

export function useCEP(cep: number | string) {
    const sqlite = useSqlite();
    const cleanCep = String(cep).replace(/\D/g, '');
    const [cepData, setCepData] = useState<CEPData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (cleanCep.length !== 8) { if (!cancelled) setCepData(null); return; }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const rows = await sqlite.query<CEPData>(CEP_LOOKUP.sql, [Number(cleanCep)]);
                if (!cancelled) setCepData(rows[0] ?? null);
            } catch (e) {
                if (!cancelled) setError(String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [sqlite, cleanCep]);

    return { cepData, loading, error };
}
