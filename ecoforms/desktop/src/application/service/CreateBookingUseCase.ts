import { uuidv7 } from 'ecoforms-core';
import { Agendamento } from '../../domain/service/Agendamento';
import type { AgendamentoRepository } from '../../domain/service/AgendamentoRepository';
import type { ServiceSlotRepository } from '../../domain/service/ServiceSlotRepository';
import type { ServiceTypeRepository } from '../../domain/service/ServiceTypeRepository';
import { ServiceValidatorFactory } from '../../domain/service/validators/ServiceValidatorFactory';
import type { AgendamentoEfeitosService } from './services/AgendamentoEfeitosService';
import type { SqlitePort } from '../ports/SqlitePort';
import { formatDateBR } from '../../lib/date';

export interface CreateBookingInput {
    slotId: string;
    clienteId: string;
    clienteNome: string;
    clienteEmail?: string;
    clienteTelefone?: string;
    dadosFormulario: Record<string, unknown>;
    vagasSolicitadas?: number;
    bairro?: string;
    responsavelId?: string;
    setorId?: string;
    userId: string;
}

export class CreateBookingUseCase {
    constructor(
        private readonly slotRepo: ServiceSlotRepository,
        private readonly typeRepo: ServiceTypeRepository,
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly efeitos: AgendamentoEfeitosService,
        private readonly sqlite: SqlitePort,
    ) {}

    async execute(input: CreateBookingInput): Promise<string> {
        const slot = await this.slotRepo.findById(input.slotId);
        if (!slot) throw new Error('Slot não encontrado');
        if (slot.status !== 'publicado') throw new Error('Slot indisponível para booking');
        if (new Date(slot.dataFim) < new Date()) throw new Error('Slot já encerrado');

        const aberturaEm = slot.aberturaEm;
        if (aberturaEm && new Date() < new Date(aberturaEm)) {
            throw new Error(`Agendamentos para este slot abrem em ${formatDateBR(aberturaEm)}`);
        }

        const serviceType = await this.typeRepo.findById(slot.serviceTypeId);
        if (!serviceType) throw new Error('Tipo de serviço não encontrado');
        if (!serviceType.ativo) throw new Error('Tipo de serviço inativo');

        const jaExiste = await this.agendamentoRepo.existeParaClienteESlot(input.clienteId, input.slotId);
        if (jaExiste) throw new Error('Cliente já possui agendamento neste slot');

        const validator = ServiceValidatorFactory.create(serviceType.validatorKey);
        await validator.validate(slot, {
            dadosFormulario: input.dadosFormulario,
            clienteId: input.clienteId,
            clienteNome: input.clienteNome,
            vagasSolicitadas: input.vagasSolicitadas,
            bairro: input.bairro,
        });

        const vagas = input.vagasSolicitadas ?? 1;
        if (vagas <= 0) throw new Error("vagasSolicitadas deve ser >= 1");
        const agendamentoId = uuidv7();
        const now = new Date().toISOString();

        const agendamento = Agendamento.fromProps({
            id: agendamentoId,
            slotId: input.slotId,
            serviceTypeId: slot.serviceTypeId,
            clienteId: input.clienteId,
            clienteNome: input.clienteNome,
            vagasSolicitadas: vagas,
            bairro: input.bairro ?? null,
            dadosFormulario: input.dadosFormulario,
            status: 'pendente',
            taskId: null,
            clienteEmail: input.clienteEmail ?? null,
            clienteTelefone: input.clienteTelefone ?? null,
            responsavelId: input.responsavelId ?? null,
            setorId: input.setorId ?? null,
            criadoPor: input.userId,
            criadoEm: now,
            atualizadoEm: now,
        });

        slot.incrementarVagas(vagas);

        // Atomicidade: persistir o agendamento e o desconto de vagas do slot na mesma transação.
        // Se qualquer um falhar, ambos são revertidos (evita vagas descontadas sem agendamento e vice-versa).
        await this.sqlite.transaction(async () => {
            await this.agendamentoRepo.save(agendamento);
            await this.slotRepo.save(slot);
        });

        // Efeitos compensáveis (task/sync via outbox) ficam fora da transação principal.
        await this.efeitos.aoCriar(agendamento, input.userId);

        return agendamentoId;
    }

}
