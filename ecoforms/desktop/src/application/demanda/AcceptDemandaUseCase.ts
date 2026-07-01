import type { DemandaRepository } from '../../domain/demanda/DemandaRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SyncOutbox } from '../ports/SyncOutboxPort';
import type { TaskProjectionService } from '../task/TaskProjectionService';
import type { TaskCriadaPayload } from 'ecoforms-core/sync';
import { uuidv7 } from 'ecoforms-core';

export interface AcceptDemandaTarefaInput {
  titulo: string;
  descricao?: string;
  atribuidoPara?: string;
  prazo?: string;
  prioridade?: 'baixa' | 'media' | 'alta';
  formularios: Array<{
    formRegistryId: string;
    formSnapshot: Record<string, unknown>;
    formVersion?: number;
    ordem: number;
    obrigatorio: boolean;
  }>;
}

export interface AcceptDemandaInput {
  demandaId: string;
  aceitoPor: string;
  tarefas: AcceptDemandaTarefaInput[];
}

export class AcceptDemandaUseCase {
  constructor(
    private repo:       DemandaRepository,
    private taskProj:   TaskProjectionService,
    private clock:      ClockPort,
    private sync:       SyncOutbox,
  ) {}

  async execute(input: AcceptDemandaInput): Promise<void> {
    const demanda = await this.repo.findById(input.demandaId);
    if (!demanda) throw new Error(`Demanda ${input.demandaId} não encontrada`);

    if (demanda.status !== 'aberta') {
      throw new Error(
        `Demanda não pode ser aceita: status atual é '${demanda.status}'. ` +
        `Apenas demandas com status 'aberta' podem ser aceitas por este use case.`
      );
    }

    const agora = this.clock.nowIso();
    // Coletados durante a transacao e publicados so depois dela commitar — ver o comentario em
    // TaskProjectionOptions.onProjected para o porque (nested sync.write dentro de uma transacao
    // ja aberta trava o mutex estatico do TauriSqliteAdapter).
    const pendingTaskEvents: TaskCriadaPayload[] = [];

    await this.repo.transaction(async (txRepo) => {
      await txRepo.updateStatus(input.demandaId, 'aceita', {
        aceitoPor: input.aceitoPor,
        aceitoEm: agora,
      });

      for (const t of input.tarefas) {
        const tarefaId = await this.taskProj.project({
          titulo:        t.titulo,
          descricao:     t.descricao,
          setorId:       demanda.setorId,
          atribuidoPara: t.atribuidoPara,
          prazo:         t.prazo,
          prioridade:    t.prioridade,
          criadoPor:     input.aceitoPor,
          origemTipo:    'demanda',
          origemId:      input.demandaId,
          formularios:   t.formularios,
        }, {
          formularioSaver: (tf) => txRepo.saveTarefaFormulario(tf),
          onProjected: (payload) => { pendingTaskEvents.push(payload); },
        });

        await txRepo.saveEvento({
          id: uuidv7(),
          demandaId: input.demandaId,
          type: 'task.criada',
          correlationId: input.demandaId,
          causationId: null,
          payload: { tarefaId, titulo: t.titulo, atribuidoPara: t.atribuidoPara },
          deviceId: null,
          userId: input.aceitoPor,
          createdAt: agora,
        });
      }

      await txRepo.saveEvento({
        id: uuidv7(),
        demandaId: input.demandaId,
        type: 'demanda.aceita',
        correlationId: input.demandaId,
        causationId: null,
        payload: { aceitoPor: input.aceitoPor, tarefasCriadas: input.tarefas.length },
        deviceId: null,
        userId: input.aceitoPor,
        createdAt: agora,
      });
    });

    for (const payload of pendingTaskEvents) {
      await this.sync.write('task.criada', payload as unknown as Record<string, unknown>, {
        aggregateId: payload.id,
        streamId: input.demandaId,
      });
    }

    await this.sync.write('demanda.aceita', {
      aceito_por: input.aceitoPor,
      tarefas_criadas: input.tarefas.length,
    }, { aggregateId: input.demandaId, streamId: input.demandaId });
  }
}
