"use client";

import { useState, useCallback } from "react";
import { getContainerAsync } from "../utils/useContainer";
import { EmailConfig } from "@/src/domain/email-config/EmailConfig";

export function useSaveEmailConfig() {
    const [saving, setSaving] = useState(false);

    const save = useCallback(async (config: EmailConfig) => {
        setSaving(true);
        try {
            const c = await getContainerAsync();
            await c.emailConfigRepository.save(config);
        } finally {
            setSaving(false);
        }
    }, []);

    return { save, saving };
}
