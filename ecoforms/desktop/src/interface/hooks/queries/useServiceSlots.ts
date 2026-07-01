"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "../utils/useContainer";
import type { ServiceSlot } from "@/src/domain/service/ServiceSlot";

export function useServiceSlots(filtros?: { status?: string; serviceTypeId?: string }) {
    const [slots, setSlots] = useState<ServiceSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const status = filtros?.status;
    const serviceTypeId = filtros?.serviceTypeId;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const data = await c.serviceSlotRepo.findAll({ status, serviceTypeId });
                if (!cancelled) setSlots(data);
            } catch (e) { if (!cancelled) setError(String(e)); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [status, serviceTypeId, tick]);

    const reload = useCallback(() => setTick(t => t + 1), []);

    return { slots, loading, error, reload };
}

export function useServiceSlotById(id: string | null) {
    const [slot, setSlot] = useState<ServiceSlot | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) { if (!cancelled) setSlot(null); return; }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const data = await c.serviceSlotRepo.findById(id);
                if (!cancelled) setSlot(data);
            } catch (e) { if (!cancelled) setError(String(e)); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [id, tick]);

    const reload = useCallback(() => setTick(t => t + 1), []);

    return { slot, loading, error, reload };
}
