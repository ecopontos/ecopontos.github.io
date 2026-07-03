"use client";

import { useState, useEffect } from "react";
import { useDataRegistryUseCases } from "../domain/useDataRegistryUseCases";

export function useDataRegistryTypesNew(): { types: string[]; loading: boolean; refetch: () => void } {
    const dr = useDataRegistryUseCases();
    const [types, setTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [tick, setTick] = useState(0);
    const refetch = () => setTick(t => t + 1);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) setLoading(true);
            try {
                const result = await dr.listTypes.execute();
                if (!cancelled) { setTypes(result); setLoading(false); }
            } catch {
                if (!cancelled) { setTypes([]); setLoading(false); }
            }
        };
        load();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dr.listTypes, tick]);

    return { types, loading, refetch };
}

export function useDataRegistryTypeCountsNew(): { counts: Map<string, number>; loading: boolean } {
    const dr = useDataRegistryUseCases();
    const [counts, setCounts] = useState<Map<string, number>>(new Map());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) setLoading(true);
            try {
                const result = await dr.countByType.execute();
                if (!cancelled) { setCounts(result); setLoading(false); }
            } catch {
                if (!cancelled) { setCounts(new Map()); setLoading(false); }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [dr.countByType]);

    return { counts, loading };
}
