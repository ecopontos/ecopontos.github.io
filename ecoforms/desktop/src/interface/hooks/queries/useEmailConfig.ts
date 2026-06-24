"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { EmailConfig } from "@/src/domain/email-config/EmailConfig";

export function useEmailConfig() {
    const [data, setData] = useState<EmailConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const config = await c.emailConfigRepository.get();
            setData(config);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
