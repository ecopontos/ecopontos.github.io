import { useMemo } from 'react';
import { useContainer } from '../utils/useContainer';

/**
 * Acesso direto aos use cases de Suite para a camada de apresentação.
 * Hooks mais específicos (useInbox, useSuiteEditor) podem ser construídos sobre este.
 */
export function useSuiteUseCases() {
    const container = useContainer();
    return useMemo(() => container.suites, [container]);
}
