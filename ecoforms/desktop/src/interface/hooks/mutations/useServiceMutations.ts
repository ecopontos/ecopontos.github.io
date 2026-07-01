"use client";

import { useState, useCallback } from "react";
import { getContainerAsync } from "../utils/useContainer";
import type { UpdateServiceSlotInput } from "@/src/application/service/UpdateServiceSlotUseCase";

export function useServiceMutations() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createBooking = useCallback(async (input: {
        slotId: string;
        clienteId: string;
        clienteNome: string;
        dadosFormulario: Record<string, unknown>;
        vagasSolicitadas?: number;
        bairro?: string;
        responsavelId?: string;
        userId: string;
    }) => {
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            return await container.createBookingUseCase.execute(input);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    const createSlot = useCallback(async (input: {
        serviceTypeId: string;
        titulo: string;
        descricao?: string;
        dataInicio: string;
        dataFim: string;
        tipoPrazo?: 'unico' | 'periodo' | 'recorrente';
        recorrencia?: string;
        aberturaEm?: string;
        horarioInicio?: string;
        horarioFim?: string;
        capacidade?: number;
        bairros?: string[];
        local?: string;
        userId: string;
    }) => {
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            return await container.createServiceSlotUseCase.execute(input);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    const publishSlot = useCallback(async (slotId: string) => {
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            await container.publishServiceSlotUseCase.execute(slotId);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    const cancelSlot = useCallback(async (slotId: string) => {
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            await container.cancelServiceSlotUseCase.execute(slotId);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    const encerrarSlot = useCallback(async (slotId: string) => {
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            await container.encerrarServiceSlotUseCase.execute(slotId);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateSlot = useCallback(async (input: UpdateServiceSlotInput) => {
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            await container.updateServiceSlotUseCase.execute(input);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    return { createBooking, createSlot, updateSlot, publishSlot, cancelSlot, encerrarSlot, loading, error };
}
