"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { ServiceSlot } from "@/src/domain/service/ServiceSlot";

export function useServiceSlots(filtros?: { status?: string; serviceTypeId?: string }) {
    const [slots, setSlots] = useState<ServiceSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [tick, setTick] = useState(0);

    // Extrai os primitivos para o array de dependências — assim o efeito reage à mudança
    // de valor, não à identidade do objeto `filtros` (que muda a cada render). Sem eslint-disable.
    const status = filtros?.status;
    const serviceTypeId = filtros?.serviceTypeId;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const data = await c.serviceSlotRepo.findAll({ status, serviceTypeId });
                if (!cancelled) setSlots(data);
            } catch (e) { console.error(e); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [status, serviceTypeId, tick]);

    const reload = useCallback(() => setTick(t => t + 1), []);

    return { slots, loading, reload };
}

export function useServiceSlotById(id: string | null) {
    const [slot, setSlot] = useState<ServiceSlot | null>(null);
    const [loading, setLoading] = useState(false);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) { if (!cancelled) setSlot(null); return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const data = await c.serviceSlotRepo.findById(id);
                if (!cancelled) setSlot(data);
            } catch (e) { console.error(e); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [id, tick]);

    const reload = useCallback(() => setTick(t => t + 1), []);

    return { slot, loading, reload };
}
