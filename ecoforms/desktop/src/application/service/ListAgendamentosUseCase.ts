import type { AgendamentoRepository, AgendamentoFiltros } from '../../domain/service/AgendamentoRepository';
import type { Agendamento } from '../../domain/service/Agendamento';

export class ListAgendamentosUseCase {
    constructor(private readonly repo: AgendamentoRepository) {}

    async execute(filtros?: AgendamentoFiltros): Promise<Agendamento[]> {
        return this.repo.findAll(filtros);
    }
}
