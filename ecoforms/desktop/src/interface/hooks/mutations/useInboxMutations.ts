"use client";

import { useCallback, useState } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { SuiteStatus } from "@/types";

export function useInboxMutations() {
    const [processing, setProcessing] = useState(false);

    const updateStatus = useCallback(async (
        packageId: string,
        newStatus: SuiteStatus,
        opts?: {
            revisorId?: string;
            motivo?: string;
            notes?: string;
            payloadPatch?: Record<string, unknown>;
        }
    ) => {
        try {
            setProcessing(true);
            const container = await getContainerAsync();
            await container.suites.updateStatus.execute({
                packageId,
                newStatus,
                revisorId: opts?.revisorId,
                motivo: opts?.motivo,
                notes: opts?.notes,
                payloadPatch: opts?.payloadPatch,
            });
            console.log(`✅ Pacote ${packageId}: status atualizado para ${newStatus}`);
            return true;
        } catch (e) {
            console.error("Erro ao atualizar status do pacote:", e);
            return false;
        } finally {
            setProcessing(false);
        }
    }, []);

    return { updateStatus, processing };
}
