import { useMemo } from "react";
import { getSupabaseClient } from "@/src/interface/gateways/supabase-client";

/**
 * Encapsula o client Supabase para a camada de UI.
 * Confina o import de `@supabase/*` em src/interface/.
 *
 * Preferir hooks específicos (useFileStorage, useTaskUseCases, etc.) antes deste —
 * ele é a saída de emergência para queries Supabase ad-hoc.
 */
export function getUiSupabaseClient() {
    return getSupabaseClient();
}

export function useSupabaseClient() {
    return useMemo(() => getUiSupabaseClient(), []);
}
