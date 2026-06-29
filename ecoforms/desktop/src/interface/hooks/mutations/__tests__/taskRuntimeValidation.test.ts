import { describe, expect, it } from 'vitest';
import type { KanbanTask } from '@/types';
import { requiresRuntimeForm, resolveKanbanMutationBehavior } from '../taskRuntimeValidation';

describe('taskRuntimeValidation', () => {
    const assignedActiveTask: Pick<KanbanTask, 'status' | 'atribuido_para' | 'form_registry_id'> = {
        status: 'a_fazer',
        atribuido_para: 'user-1',
        form_registry_id: undefined,
    };

    it('mantem validacao runtime ligada por padrao', () => {
        const behavior = resolveKanbanMutationBehavior();

        expect(requiresRuntimeForm(behavior, assignedActiveTask)).toBe(true);
    });

    it('nao exige formulario no modo standalone', () => {
        const behavior = resolveKanbanMutationBehavior({ runtimeValidation: false });

        expect(requiresRuntimeForm(behavior, assignedActiveTask)).toBe(false);
    });

    it('desliga auto sync quando solicitado pelo consumidor standalone', () => {
        expect(resolveKanbanMutationBehavior({ autoSync: false }).autoSync).toBe(false);
    });
});