import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBookingTasks } from '../useBookingTasks';
import { getContainerAsync } from '../../utils/useContainer';

vi.mock('../../utils/useContainer', () => ({
    getContainerAsync: vi.fn(),
}));

describe('useBookingTasks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mapeia telefone, email, bairro, vagas e dados do formulario', async () => {
        const execute = vi.fn().mockResolvedValue([
            {
                id: 'ag-1',
                clienteNome: 'Maria Souza',
                status: 'confirmado',
                criadoEm: '2026-06-01T10:00:00.000Z',
                responsavelId: null,
                clienteTelefone: '11999999999',
                clienteEmail: 'maria@example.com',
                bairro: 'Centro',
                vagasSolicitadas: 2,
                dadosFormulario: { endereco: 'Rua das Flores, 123' },
            },
        ]);
        vi.mocked(getContainerAsync).mockResolvedValue({
            listAgendamentosUseCase: { execute },
        } as never);

        const { result } = renderHook(() => useBookingTasks('slot-1'));

        await waitFor(() => {
            expect(result.current.tasks).toHaveLength(1);
        });

        expect(result.current.tasks[0]).toEqual({
            id: 'ag-1',
            titulo: 'Maria Souza',
            status: 'confirmado',
            criadoEm: '2026-06-01T10:00:00.000Z',
            atribuidoPara: null,
            clienteTelefone: '11999999999',
            clienteEmail: 'maria@example.com',
            bairro: 'Centro',
            vagasSolicitadas: 2,
            dadosFormulario: { endereco: 'Rua das Flores, 123' },
        });
        expect(execute).toHaveBeenCalledWith({ slotId: 'slot-1', limit: 26, offset: 0 });
    });

    it('usa null para campos opcionais ausentes', async () => {
        const execute = vi.fn().mockResolvedValue([
            {
                id: 'ag-2',
                clienteNome: 'Joao',
                status: 'pendente',
                criadoEm: '2026-06-02T10:00:00.000Z',
                vagasSolicitadas: 1,
                dadosFormulario: {},
            },
        ]);
        vi.mocked(getContainerAsync).mockResolvedValue({
            listAgendamentosUseCase: { execute },
        } as never);

        const { result } = renderHook(() => useBookingTasks('slot-1'));

        await waitFor(() => {
            expect(result.current.tasks).toHaveLength(1);
        });

        expect(result.current.tasks[0].clienteTelefone).toBeNull();
        expect(result.current.tasks[0].clienteEmail).toBeNull();
        expect(result.current.tasks[0].bairro).toBeNull();
        expect(result.current.tasks[0].atribuidoPara).toBeNull();
    });
});
