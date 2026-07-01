import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgendamentoRow } from '@/components/agendamentos/AgendamentoRow';
import type { BookingRow } from '@/src/interface/hooks/queries/useBookingTasks';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

const baseRow: BookingRow = {
    id: 'ag-1',
    titulo: 'Maria Souza',
    status: 'confirmado',
    criadoEm: '2026-06-01T10:00:00.000Z',
    atribuidoPara: null,
    clienteTelefone: '11999999999',
    clienteEmail: 'maria@example.com',
    bairro: 'Centro',
    vagasSolicitadas: 1,
    dadosFormulario: { endereco: 'Rua das Flores, 123' },
};

describe('AgendamentoRow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mostra o botao Cancelar quando o status permite cancelamento', () => {
        render(<AgendamentoRow row={baseRow} onCancelar={vi.fn()} onReenviarWhatsapp={vi.fn()} />);
        expect(screen.getByText('Cancelar')).toBeTruthy();
    });

    it('esconde o botao Cancelar quando o agendamento ja foi cancelado', () => {
        render(
            <AgendamentoRow
                row={{ ...baseRow, status: 'cancelado' }}
                onCancelar={vi.fn()}
                onReenviarWhatsapp={vi.fn()}
            />
        );
        expect(screen.queryByText('Cancelar')).toBeNull();
    });

    it('expande os detalhes ao clicar em Detalhes', async () => {
        render(<AgendamentoRow row={baseRow} onCancelar={vi.fn()} onReenviarWhatsapp={vi.fn()} />);

        fireEvent.click(screen.getByText('Detalhes'));

        expect(await screen.findByText('Telefone: 11999999999')).toBeTruthy();
        expect(screen.getByText('E-mail: maria@example.com')).toBeTruthy();
        expect(screen.getByText('endereco: Rua das Flores, 123')).toBeTruthy();
    });

    it('confirma o cancelamento e chama onCancelar com o id do agendamento', async () => {
        const onCancelar = vi.fn().mockResolvedValue(undefined);
        render(<AgendamentoRow row={baseRow} onCancelar={onCancelar} onReenviarWhatsapp={vi.fn()} />);

        fireEvent.click(screen.getByText('Cancelar'));
        fireEvent.click(await screen.findByText('Cancelar agendamento'));

        await waitFor(() => {
            expect(onCancelar).toHaveBeenCalledWith('ag-1');
        });
        expect(toast.success).toHaveBeenCalled();
    });

    it('abre o link de whatsapp retornado ao reenviar', async () => {
        const onReenviarWhatsapp = vi.fn().mockResolvedValue('https://wa.me/5511999999999');
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        render(<AgendamentoRow row={baseRow} onCancelar={vi.fn()} onReenviarWhatsapp={onReenviarWhatsapp} />);
        fireEvent.click(screen.getByText('WhatsApp'));

        await waitFor(() => {
            expect(openSpy).toHaveBeenCalledWith('https://wa.me/5511999999999', '_blank', 'noopener,noreferrer');
        });
        openSpy.mockRestore();
    });

    it('mostra erro quando nao ha link de whatsapp disponivel', async () => {
        const onReenviarWhatsapp = vi.fn().mockResolvedValue(null);
        render(<AgendamentoRow row={baseRow} onCancelar={vi.fn()} onReenviarWhatsapp={onReenviarWhatsapp} />);

        fireEvent.click(screen.getByText('WhatsApp'));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Nenhum link de WhatsApp disponível para este agendamento.');
        });
    });
});
