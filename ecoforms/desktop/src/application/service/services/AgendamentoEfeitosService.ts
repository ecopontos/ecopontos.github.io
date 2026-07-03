import type { Agendamento } from '../../../domain/service/Agendamento';
import type { AgendamentoRepository } from '../../../domain/service/AgendamentoRepository';
import type { ServiceSlotRepository } from '../../../domain/service/ServiceSlotRepository';
import type { ServiceTypeRepository } from '../../../domain/service/ServiceTypeRepository';
import type { SyncOutbox } from '../../ports/SyncOutboxPort';
import type { TaskProjectionFormulario, TaskProjectionService } from '../../task/TaskProjectionService';
import type { NotificacaoService } from './NotificacaoService';
import { formatDateBR } from '../../../lib/date';

export class AgendamentoEfeitosService {
    constructor(
        private readonly taskProjection: TaskProjectionService,
        private readonly agendamentoRepo: AgendamentoRepository,
        private readonly slotRepo: ServiceSlotRepository,
        private readonly typeRepo: ServiceTypeRepository,
        private readonly notificador: NotificacaoService,
        private readonly sync: SyncOutbox,
    ) {}

    async aoConfirmar(ag: Agendamento, criadoPor: string): Promise<void> {
        if (!ag.taskId) {
            const slot = await this.slotRepo.findById(ag.slotId);
            const serviceType = await this.typeRepo.findById(ag.serviceTypeId);

            if (slot && serviceType) {
                const titulo = `[${serviceType.nome}] ${ag.clienteNome} · ${formatDateBR(slot.dataInicio)}`;

                const linhas: string[] = [];
                if (ag.bairro) linhas.push(`Bairro: ${ag.bairro}`);
                if (ag.vagasSolicitadas > 1) linhas.push(`Vagas: ${ag.vagasSolicitadas}`);
                if (slot.local) linhas.push(`Local: ${slot.local}`);
                if (ag.clienteTelefone) linhas.push(`Tel: ${ag.clienteTelefone}`);
                if (ag.clienteEmail) linhas.push(`Email: ${ag.clienteEmail}`);
                const descricao = linhas.length > 0 ? linhas.join(' · ') : undefined;

                // Repassa o snapshot do formulario preenchido no booking como TarefaFormulario, da
                // mesma forma que AcceptDemandaUseCase faz no caminho demanda -> task. Sem isso os
                // campos custom coletados pelo FormRenderer eram descartados e so sobreviviam os
                // poucos campos hardcoded da descricao acima.
                const dadosNaoVazios = Object.keys(ag.dadosFormulario).length > 0;
                const formularios: TaskProjectionFormulario[] = (serviceType.formId && dadosNaoVazios)
                    ? [{
                        formRegistryId: serviceType.formId,
                        formSnapshot:   ag.dadosFormulario,
                        ordem:          0,
                        obrigatorio:    true,
                    }]
                    : [];

                // O wizard hoje so seta responsavelId; setorId fica nulo. Usa o setor do tipo de
                // servico como fallback para a task nao nascer sem setor.
                const setorId = ag.setorId ?? serviceType.setorId ?? null;

                const taskId = await this.taskProjection.project({
                    titulo,
                    descricao,
                    setorId,
                    atribuidoPara: ag.responsavelId ?? undefined,
                    prazo: slot.dataFim,
                    criadoPor,
                    origemTipo: 'agendamento',
                    origemId: ag.id,
                    formularios,
                });
                ag.vinculaTask(taskId);
                await this.agendamentoRepo.save(ag);
            }
        }

        await this.notificador.enviarConfirmacao(ag);
        await this.sync.write('agendamento.confirmado', {
            agendamentoId: ag.id,
            slotId: ag.slotId,
            serviceTypeId: ag.serviceTypeId,
            clienteId: ag.clienteId,
            criadoPor,
        }, { aggregateId: ag.id, streamId: ag.slotId });
    }

    async aoCriar(ag: Agendamento, criadoPor: string): Promise<void> {
        await this.sync.write('agendamento.criado', {
            agendamentoId: ag.id,
            slotId: ag.slotId,
            serviceTypeId: ag.serviceTypeId,
            clienteId: ag.clienteId,
            criadoPor,
        }, { aggregateId: ag.id, streamId: ag.slotId });
    }

    async aoCancelar(ag: Agendamento): Promise<void> {
        await this.sync.write('agendamento.cancelado', {
            agendamentoId: ag.id,
            slotId: ag.slotId,
            vagasDevolvidas: ag.vagasSolicitadas,
        }, { aggregateId: ag.id, streamId: ag.slotId });
    }

    async aoRealizar(ag: Agendamento, realizadoPor: string): Promise<void> {
        await this.sync.write('agendamento.realizado', {
            agendamentoId: ag.id,
            slotId: ag.slotId,
            serviceTypeId: ag.serviceTypeId,
            clienteId: ag.clienteId,
            realizadoPor,
        }, { aggregateId: ag.id, streamId: ag.slotId });
    }

}
