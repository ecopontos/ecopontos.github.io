import { useState } from 'react';
import { getContainerAsync } from '../../../infrastructure/container';
import type { CreateBookingInput } from '../../../application/service/CreateBookingUseCase';

export function useAgendamentoMutations() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const criarBooking = async (input: CreateBookingInput): Promise<string> => {
        setLoading(true);
        setError(null);
        try {
            const c = await getContainerAsync();
            // Cria o agendamento e confirma imediatamente (auto-confirm padrão)
            const agendamentoId = await c.createBookingUseCase.execute(input);
            await c.confirmarAgendamentoUseCase.execute(agendamentoId, input.userId);
            return agendamentoId;
        } catch (e) {
            const msg = String(e);
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    };

    const cancelarAgendamento = async (agendamentoId: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const c = await getContainerAsync();
            await c.cancelarAgendamentoUseCase.execute(agendamentoId);
        } catch (e) {
            const msg = String(e);
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    };

    const confirmarAgendamento = async (agendamentoId: string, userId: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const c = await getContainerAsync();
            await c.confirmarAgendamentoUseCase.execute(agendamentoId, userId);
        } catch (e) {
            const msg = String(e);
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    };

    const findLinkWhatsApp = async (agendamentoId: string): Promise<string | null> => {
        const c = await getContainerAsync();
        return c.agendamentoNotificacaoRepo.findLinkWhatsApp(agendamentoId);
    };

    return { criarBooking, cancelarAgendamento, confirmarAgendamento, findLinkWhatsApp, loading, error };
}
