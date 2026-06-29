"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { ServiceType } from "@/src/domain/service/ServiceType";

export function useServiceTypes(userId?: string, ativo = true) {
    const [types, setTypes] = useState<ServiceType[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const data = userId
                    ? await c.listServiceTypesUseCase.execute(userId, ativo)
                    : await c.serviceTypeRepo.findAll(ativo);
                if (!cancelled) setTypes(data);
            } catch (e) { if (!cancelled) setError(String(e)); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [userId, ativo]);

    return { types, loading, error };
}

export function useServiceTypeById(id: string | null) {
    const [type, setType] = useState<ServiceType | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) { if (!cancelled) setType(null); return; }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const data = await c.serviceTypeRepo.findById(id);
                if (!cancelled) setType(data);
            } catch (e) { if (!cancelled) setError(String(e)); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [id, tick]);

    const reload = useCallback(() => setTick(t => t + 1), []);

    return { type, loading, error, reload };
}
