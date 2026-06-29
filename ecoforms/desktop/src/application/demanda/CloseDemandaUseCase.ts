import { uuidv7 } from 'ecoforms-core';
import type { DemandaRepository } from '../../domain/demanda/DemandaRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { DemandaTaskSynchronizer } from './services/DemandaTaskSynchronizer';
import type { SyncOutbox } from '../ports/SyncOutboxPort';

export interface CloseDemandaInput {
  demandaId: string;
  encerradoPor: string;
  motivo?: string;
}

export class CloseDemandaUseCase {
  constructor(
    private repo: DemandaRepository,
    private clock: ClockPort,
    private synchronizer: DemandaTaskSynchronizer,
    private sync: SyncOutbox,
  ) {}

  async execute(input: CloseDemandaInput): Promise<void> {
    const demanda = await this.repo.findById(input.demandaId);
    if (!demanda) throw new Error(`Demanda ${input.demandaId} não encontrada`);

    if (demanda.status === 'concluida') {
      throw new Error('Demanda já está concluída');
    }

    if (demanda.politicaConclusao === 'todas') {
      const todasConcluidas = await this.repo.allTarefasObrigatoriasConcluidasParaDemanda(
        input.demandaId
      );
      if (!todasConcluidas) {
        throw new Error(
          'Política "todas": há tarefas pendentes para esta demanda. ' +
          'Todas as tarefas devem estar com status "concluido" antes de encerrar.'
        );
      }
    }

    const agora = this.clock.nowIso();

    await this.repo.transaction(async (txRepo) => {
      await txRepo.updateStatus(input.demandaId, 'concluida', {
        encerradoPor: input.encerradoPor,
        encerradoEm: agora,
        archiveStatus: 'completed',
      });

      await txRepo.saveEvento({
        id: uuidv7(),
        demandaId: input.demandaId,
        type: 'demanda.encerrada',
        correlationId: input.demandaId,
        causationId: null,
        payload: {
          encerradoPor: input.encerradoPor,
          motivo: input.motivo ?? null,
          politicaConclusao: demanda.politicaConclusao,
        },
        deviceId: null,
        userId: input.encerradoPor,
        createdAt: agora,
      });
    });

    await this.synchronizer.aoEncerrarDemanda(input.demandaId);
    await this.sync.write('demanda.encerrada', {
      encerrado_por: input.encerradoPor,
    }, { aggregateId: input.demandaId, streamId: input.demandaId });
  }
}
