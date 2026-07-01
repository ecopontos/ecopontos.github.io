import { useMemo } from 'react';
import { useContainer } from '../utils/useContainer';

/**
 * Acesso direto aos use cases de Task para a camada de apresentação.
 * Hooks mais específicos (useKanbanTasks, useTaskMutations) podem ser construídos sobre este.
 */
export function useTaskUseCases() {
    const container = useContainer();
    return useMemo(() => container.tasks, [container]);
}
