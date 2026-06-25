import { useMemo } from 'react';
import { getContainer } from '../../../infrastructure/container';

/**
 * Acesso direto aos use cases de Suite para a camada de apresentação.
 * Hooks mais específicos (useInbox, useSuiteEditor) podem ser construídos sobre este.
 */
export function useSuiteUseCases() {
    return useMemo(() => getContainer().suites, []);
}
