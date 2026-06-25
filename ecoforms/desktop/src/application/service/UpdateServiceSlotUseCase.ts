import { ServiceSlot } from '../../domain/service/ServiceSlot';
import type { ServiceSlotRepository } from '../../domain/service/ServiceSlotRepository';

export interface UpdateServiceSlotInput {
    id: string;
    titulo?: string;
    descricao?: string | null;
    dataInicio?: string;
    dataFim?: string;
    tipoPrazo?: 'unico' | 'periodo' | 'recorrente' | null;
    recorrencia?: string | null;
    capacidade?: number | null;
    bairros?: string[];
    local?: string | null;
}

export class UpdateServiceSlotUseCase {
    constructor(private readonly repo: ServiceSlotRepository) {}

    async execute(input: UpdateServiceSlotInput): Promise<void> {
        const slot = await this.repo.findById(input.id);
        if (!slot) throw new Error('Slot não encontrado');
        if (slot.status === 'encerrado' || slot.status === 'cancelado') {
            throw new Error('Não é possível editar um slot encerrado ou cancelado');
        }

        const props = slot.toProps();

        const updated = ServiceSlot.fromProps({
            ...props,
            titulo: input.titulo ?? props.titulo,
            descricao: input.descricao !== undefined ? input.descricao : props.descricao,
            dataInicio: input.dataInicio ?? props.dataInicio,
            dataFim: input.dataFim ?? props.dataFim,
            tipoPrazo: input.tipoPrazo !== undefined ? input.tipoPrazo : props.tipoPrazo,
            recorrencia: input.recorrencia !== undefined ? input.recorrencia : props.recorrencia,
            capacidade: input.capacidade !== undefined ? input.capacidade : props.capacidade,
            bairros: input.bairros ?? props.bairros,
            local: input.local !== undefined ? input.local : props.local,
            atualizadoEm: new Date().toISOString(),
        });

        await this.repo.save(updated);
    }
}
