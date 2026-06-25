import type { AgendamentoRepository } from '../../domain/service/AgendamentoRepository';
import type { Agendamento } from '../../domain/service/Agendamento';

export class GetAgendamentoUseCase {
    constructor(private readonly repo: AgendamentoRepository) {}

    async execute(id: string): Promise<Agendamento> {
        const agendamento = await this.repo.findById(id);
        if (!agendamento) throw new Error('Agendamento não encontrado');
        return agendamento;
    }
}
