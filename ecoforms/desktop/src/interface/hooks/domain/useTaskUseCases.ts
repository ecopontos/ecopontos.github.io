import { useMemo } from 'react';
import { getContainer } from '../../../infrastructure/container';

/**
 * Acesso direto aos use cases de Task para a camada de apresentação.
 * Hooks mais específicos (useKanbanTasks, useTaskMutations) podem ser construídos sobre este.
 */
export function useTaskUseCases() {
    return useMemo(() => getContainer().tasks, []);
}
