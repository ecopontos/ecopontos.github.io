import type { AgendamentoRepository } from '../../domain/service/AgendamentoRepository';
import type { ServiceSlotRepository } from '../../domain/service/ServiceSlotRepository';
import type { AgendamentoEfeitosService } from './services/AgendamentoEfeitosService';

export class CancelarAgendamentoUseCase {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly slotRepo: ServiceSlotRepository,
        private readonly efeitos: AgendamentoEfeitosService,
    ) {}

    async execute(agendamentoId: string): Promise<void> {
        const agendamento = await this.agendamentoRepo.findById(agendamentoId);
        if (!agendamento) throw new Error('Agendamento não encontrado');
        if (!agendamento.podeTransitarPara('cancelado')) {
            throw new Error(`Agendamento já está '${agendamento.status}'`);
        }

        const slot = await this.slotRepo.findById(agendamento.slotId);
        if (slot && !slot.isTerminal()) {
            const novasVagas = Math.max(0, slot.vagasOcupadas - agendamento.vagasSolicitadas);
            await this.slotRepo.updateVagasOcupadas(slot.id, novasVagas);
        }

        agendamento.transitionTo('cancelado');
        await this.agendamentoRepo.save(agendamento);
        await this.efeitos.aoCancelar(agendamento);
    }
}
