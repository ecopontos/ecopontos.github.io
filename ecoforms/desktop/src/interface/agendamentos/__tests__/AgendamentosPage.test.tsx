import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgendamentosPage from '@/app/agendamentos/page';

const toastError = vi.fn();
vi.mock('sonner', () => ({
    toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}));

vi.mock('@/components/BookingWizardContent', () => ({
    BookingWizardContent: ({ onCancel }: { onCancel: () => void }) => (
        <div data-testid="wizard-content">
            <button onClick={onCancel}>mock-voltar-wizard</button>
        </div>
    ),
}));

let mockSlots: unknown[] = [];
const mockReload = vi.fn();

vi.mock('@/src/interface/hooks/catalog/service', () => ({
    useServiceSlots: () => ({ slots: mockSlots, loading: false, reload: mockReload }),
    useServiceTypes: () => ({ types: [{ id: 'tipo-1', nome: 'Coleta de óleo', icone: '🛢️' }] }),
    useBookingTasks: () => ({
        tasks: [],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: vi.fn(),
        reload: vi.fn(),
    }),
    useAgendamentoMutations: () => ({
        cancelarAgendamento: vi.fn(),
        findLinkWhatsApp: vi.fn(),
    }),
}));

function makeSlot(overrides: Record<string, unknown> = {}) {
    return {
        id: 'slot-1',
        serviceTypeId: 'tipo-1',
        titulo: 'Coleta Bairro Centro',
        dataInicio: '2026-07-10',
        dataFim: '2026-07-10',
        capacidade: 10,
        vagasOcupadas: 3,
        status: 'publicado',
        bairros: [],
        local: null,
        ...overrides,
    };
}

describe('AgendamentosPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSlots = [makeSlot()];
    });

    it('abre o Sheet em modo detalhes ao selecionar um slot', () => {
        render(<AgendamentosPage />);

        fireEvent.click(screen.getByText('Coleta Bairro Centro'));

        expect(screen.getByText('Registrar agendamento')).toBeTruthy();
    });

    it('deriva o slot selecionado a partir da lista mais recente apos reload', () => {
        const { rerender } = render(<AgendamentosPage />);
        fireEvent.click(screen.getByText('Coleta Bairro Centro'));

        expect(screen.getByText('3 / 10')).toBeTruthy();

        mockSlots = [makeSlot({ vagasOcupadas: 4 })];
        rerender(<AgendamentosPage />);

        expect(screen.getByText('4 / 10')).toBeTruthy();
    });

    it('fecha o Sheet e mostra toast quando o slot selecionado some da lista', async () => {
        const { rerender } = render(<AgendamentosPage />);
        fireEvent.click(screen.getByText('Coleta Bairro Centro'));
        expect(screen.getByText('Registrar agendamento')).toBeTruthy();

        mockSlots = [];
        rerender(<AgendamentosPage />);

        await waitFor(() => {
            expect(screen.queryByText('Registrar agendamento')).toBeNull();
        });
        expect(toastError).toHaveBeenCalledWith('Este slot não está mais disponível.');
    });

    it('alterna para o modo wizard e volta para detalhes sem fechar o Sheet', () => {
        render(<AgendamentosPage />);
        fireEvent.click(screen.getByText('Coleta Bairro Centro'));

        fireEvent.click(screen.getByText('Registrar agendamento'));
        expect(screen.getByTestId('wizard-content')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Registrar agendamento' })).toBeNull();

        fireEvent.click(screen.getByText('mock-voltar-wizard'));
        expect(screen.getByText('Registrar agendamento')).toBeTruthy();
    });
});
