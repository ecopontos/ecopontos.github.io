import type { AgendamentoRepository } from '../../domain/service/AgendamentoRepository';
import type { AgendamentoEfeitosService } from './services/AgendamentoEfeitosService';

export class ConfirmarAgendamentoUseCase {
    constructor(
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly efeitos: AgendamentoEfeitosService,
    ) {}

    async execute(agendamentoId: string, criadoPor: string): Promise<void> {
        const agendamento = await this.agendamentoRepo.findById(agendamentoId);
        if (!agendamento) throw new Error('Agendamento não encontrado');

        // Idempotência: se já está confirmado, um retry não deve lançar erro. Apenas completa
        // efeitos que possam ter ficado pendentes numa execução anterior interrompida (ex.: task
        // não criada após a transição ser persistida). `aoConfirmar` é reentrant (guard por taskId).
        if (agendamento.status === 'confirmado') {
            if (!agendamento.taskId) {
                await this.efeitos.aoConfirmar(agendamento, criadoPor);
            }
            return;
        }

        if (!agendamento.podeTransitarPara('confirmado')) {
            throw new Error(`Agendamento já está '${agendamento.status}'`);
        }

        agendamento.transitionTo('confirmado');
        const claimed = await this.agendamentoRepo.confirmIfPendente(
            agendamento.id,
            new Date().toISOString(),
        );
        if (!claimed) return; // outro request ganhou a corrida — idempotência via retry path
        await this.efeitos.aoConfirmar(agendamento, criadoPor);
    }
}
