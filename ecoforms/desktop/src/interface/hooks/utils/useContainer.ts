import { useMemo, useRef, useCallback } from 'react';
import { getContainer, getContainerAsync } from '@/src/infrastructure/container';
import type { Container } from '@/src/infrastructure/container';

export function useContainer(): Container {
    return useMemo(() => getContainer(), []);
}

export async function initializeContainer(): Promise<Container> {
    return getContainerAsync();
}

/**
 * ADR-041 Gap 6 — Retorna um getter que resolve o container (com init de DB garantido)
 * uma única vez por instância de hook e memoiza a Promise. Evita o ruído de chamar
 * `getContainerAsync()` em cada callback. Sempre aguarda a Promise (sem race de ref nula).
 */
export function useContainerAsync(): () => Promise<Container> {
    const ref = useRef<Promise<Container> | null>(null);
    return useCallback(() => {
        if (!ref.current) {
            ref.current = getContainerAsync();
        }
        return ref.current;
    }, []);
}
