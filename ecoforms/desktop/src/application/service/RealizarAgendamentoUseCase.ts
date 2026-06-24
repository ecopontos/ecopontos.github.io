import type { AgendamentoRepository } from '../../domain/service/AgendamentoRepository';
import type { AgendamentoEfeitosService } from './services/AgendamentoEfeitosService';

export class RealizarAgendamentoUseCase {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly efeitos: AgendamentoEfeitosService,
    ) {}

    async execute(agendamentoId: string, realizadoPor: string): Promise<void> {
        const agendamento = await this.agendamentoRepo.findById(agendamentoId);
        if (!agendamento) throw new Error('Agendamento não encontrado');

        if (agendamento.status === 'realizado') return;

        if (!agendamento.podeTransitarPara('realizado')) {
            throw new Error(`Agendamento já está '${agendamento.status}'`);
        }

        agendamento.transitionTo('realizado');
        await this.agendamentoRepo.save(agendamento);
        await this.efeitos.aoRealizar(agendamento, realizadoPor);
    }
}
