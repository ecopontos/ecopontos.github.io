import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingWizardContent } from '@/components/BookingWizardContent';

vi.mock('@/components/clientes/ClientePhoneSearch', () => ({
    ClientePhoneSearch: () => <div data-testid="cliente-phone-search" />,
}));
vi.mock('@/components/clientes/QuickCreateClientForm', () => ({
    QuickCreateClientForm: () => <div data-testid="quick-create-client" />,
}));
vi.mock('@/components/runtime/FormRenderer', () => ({
    FormRenderer: () => <div data-testid="form-renderer" />,
}));
vi.mock('@/src/interface/hooks/catalog/forms', () => ({
    useFormTemplate: () => ({ template: null, loading: false }),
}));
vi.mock('@/src/interface/hooks/catalog/service', () => ({
    useServiceSlotById: () => ({
        slot: {
            id: 'slot-1',
            titulo: 'Coleta Bairro Centro',
            dataInicio: '2026-07-10',
            dataFim: '2026-07-10',
            capacidade: 10,
            vagasOcupadas: 3,
            serviceTypeId: 'tipo-1',
        },
        loading: false,
    }),
    useServiceTypes: () => ({
        types: [{ id: 'tipo-1', nome: 'Coleta de óleo', icone: '🛢️', formId: null }],
    }),
    useAgendamentoMutations: () => ({
        criarBooking: vi.fn(),
        findLinkWhatsApp: vi.fn(),
        loading: false,
        error: null,
    }),
}));
vi.mock('@/src/interface/hooks/catalog/auth', () => ({
    useAdminUsers: () => ({ users: [] }),
    useAuth: () => ({ user: { id: 'user-1' } }),
}));

describe('BookingWizardContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('chama onCancel ao clicar em Cancelar na etapa 1', () => {
        const onCancel = vi.fn();
        render(<BookingWizardContent slotId="slot-1" onCancel={onCancel} onCompleted={vi.fn()} />);

        fireEvent.click(screen.getByText('Cancelar'));

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('renderiza o nome do slot e do tipo de servico', () => {
        render(<BookingWizardContent slotId="slot-1" onCancel={vi.fn()} onCompleted={vi.fn()} />);

        expect(screen.getByText('Coleta de óleo')).toBeTruthy();
        expect(screen.getByText('Coleta Bairro Centro', { exact: false })).toBeTruthy();
    });
});
