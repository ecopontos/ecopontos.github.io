"use client";

import { useState, useCallback } from "react";
import { useDataRegistryUseCases } from "../domain/useDataRegistryUseCases";
import type { BulkInsertItem, BulkInsertResult } from "@/src/application/data-registry/BulkInsertDataRegistryUseCase";

export function useDataRegistryBulkInsert() {
    const dr = useDataRegistryUseCases();
    const [loading, setLoading] = useState(false);

    const bulkInsert = useCallback(
        async (tipo: string, items: BulkInsertItem[]): Promise<BulkInsertResult> => {
            setLoading(true);
            try {
                return await dr.bulkInsert.execute(tipo, items);
            } finally {
                setLoading(false);
            }
        },
        [dr.bulkInsert],
    );

    return { bulkInsert, loading };
}
