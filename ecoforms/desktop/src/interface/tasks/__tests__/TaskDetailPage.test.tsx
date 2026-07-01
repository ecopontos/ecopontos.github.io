import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskDetailPage from '@/app/tasks/[id]/TaskDetailPage';
import { fetchFormSchemasAtivos } from '@/src/interface/hooks/queries/lookups/forms';
import { fetchPacotesForTarefa } from '@/src/interface/hooks/queries/lookups/pacotes';
import { fetchTarefaById } from '@/src/interface/hooks/queries/lookups/tasks';

vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'task-1' }),
    useRouter: () => ({ back: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/contexts/AuthContext', () => {
    const user = { id: 'user-1' };
    return { useAuth: () => ({ user }) };
});

vi.mock('@/components/runtime/ReadOnlyFormRenderer', () => ({
    ReadOnlyFormRenderer: () => <div data-testid="readonly-form" />,
}));

vi.mock('@/src/interface/hooks/queries/lookups/forms', () => ({
    fetchFormSchemasAtivos: vi.fn(),
}));

vi.mock('@/src/interface/hooks/queries/lookups/pacotes', () => ({
    fetchPacotesForTarefa: vi.fn(),
}));

vi.mock('@/src/interface/hooks/queries/lookups/tasks', () => ({
    fetchTarefaById: vi.fn(),
}));

const mockedFetchTarefaById = vi.mocked(fetchTarefaById);
const mockedFetchFormSchemasAtivos = vi.mocked(fetchFormSchemasAtivos);
const mockedFetchPacotesForTarefa = vi.mocked(fetchPacotesForTarefa);

describe('TaskDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedFetchTarefaById.mockResolvedValue({
            id: 'task-1',
            projeto_id: 'project-1',
            titulo: 'Tarefa auditada',
            status: 'a_fazer',
            prioridade: 'media',
            atribuido_para: 'user-2',
            criado_em: '2026-06-01T10:00:00.000Z',
            prazo: null,
            setor_id: 'setor-1',
            demanda_id: null,
        });
        mockedFetchPacotesForTarefa.mockResolvedValue([]);
        mockedFetchFormSchemasAtivos.mockResolvedValue([]);
    });

    it('carrega apenas pacotes vinculados a tarefa aberta', async () => {
        render(<TaskDetailPage />);

        await waitFor(() => {
            expect(mockedFetchPacotesForTarefa).toHaveBeenCalledWith('task-1');
        });
    });
});
