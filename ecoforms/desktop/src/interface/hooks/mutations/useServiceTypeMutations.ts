"use client";

import { useState, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { CreateServiceTypeInput } from "@/src/application/service/CreateServiceTypeUseCase";
import type { UpdateServiceTypeInput } from "@/src/application/service/UpdateServiceTypeUseCase";

export function useServiceTypeMutations(userId?: string) {
    const [loading, setLoading] = useState(false);

    const createType = useCallback(async (input: CreateServiceTypeInput): Promise<string> => {
        setLoading(true);
        try {
            const container = await getContainerAsync();
            return await container.createServiceTypeUseCase.execute(input, userId!);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const updateType = useCallback(async (input: UpdateServiceTypeInput): Promise<void> => {
        setLoading(true);
        try {
            const container = await getContainerAsync();
            await container.updateServiceTypeUseCase.execute(input, userId!);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    return { createType, updateType, loading };
}
