import { useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

function isTauriContext(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (!isTauriContext()) {
        return Promise.reject(
            new Error(`[Tauri] invoke('${cmd}') chamado fora do contexto Tauri. Use "npm run start:tauri" ao invés de "npm run dev".`)
        );
    }
    return invoke<T>(cmd, args);
}

/**
 * Encapsula `invoke` do Tauri para a camada de UI.
 * Confina o import de `@tauri-apps/*` em src/interface/.
 *
 * Retorna um no-op com mensagem descritiva quando executado fora do webview Tauri
 * (ex: `npm run dev` no browser).
 *
 * Preferir hooks de domínio (useTaskUseCases, useClientUseCases, useSqlite, etc.)
 * antes de cair neste hook genérico — ele é a saída de emergência.
 */
export function useTauriInvoke() {
    return useMemo(() => safeInvoke, []);
}

/** Para event handlers (não-hooks) que precisam chamar invoke diretamente. */
export { safeInvoke as invoke };
