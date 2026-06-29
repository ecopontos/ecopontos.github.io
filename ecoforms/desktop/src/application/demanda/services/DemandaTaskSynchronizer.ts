import { uuidv7 } from 'ecoforms-core';
import type { TaskRepository } from '../../../domain/task/TaskRepository';
import type { DemandaRepository } from '../../../domain/demanda/DemandaRepository';

export class DemandaTaskSynchronizer {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly demandas: DemandaRepository,
    ) {}

    async aoMoverTask(taskId: string, demandaId: string, novoStatus: string): Promise<void> {
        if (novoStatus === 'em_progresso') {
            const demanda = await this.demandas.findById(demandaId);
            if (demanda && demanda.status === 'aceita') {
                await this.demandas.updateStatus(demandaId, 'em_campo');
            }
        } else if (novoStatus === 'concluido') {
            const demanda = await this.demandas.findById(demandaId);
            if (demanda && demanda.status !== 'concluida') {
                const todasConcluidas = await this.demandas.allTarefasObrigatoriasConcluidasParaDemanda(demandaId);
                if (todasConcluidas) {
                    await this.#encerrarDemandaAuto(demandaId, 'Todas as tarefas foram concluídas');
                }
            }
        }
    }

    async aoArquivarTask(taskId: string, demandaId: string | null): Promise<void> {
        if (!demandaId) return;
        const demanda = await this.demandas.findById(demandaId);
        if (!demanda || demanda.status === 'concluida') return;

        const taskList = await this.tasks.findByDemandaId(demandaId);
        const allDone = taskList.every(
            (t) => t.arquivado || t.status === 'concluido' || t.status === 'cancelado',
        );
        if (!allDone) return;

        await this.#encerrarDemandaAuto(demandaId, 'Todas as tarefas foram arquivadas ou concluídas');
    }

    async aoEncerrarDemanda(demandaId: string): Promise<void> {
        const taskList = await this.tasks.findByDemandaId(demandaId);
        for (const task of taskList) {
            if (task.status === 'concluido' || task.status === 'cancelado') continue;
            task.transitionTo('cancelado');
            await this.tasks.save(task);
        }
    }

    async #encerrarDemandaAuto(demandaId: string, motivo: string): Promise<void> {
        const now = new Date().toISOString();
        await this.demandas.transaction(async (txRepo) => {
            await txRepo.updateStatus(demandaId, 'concluida', {
                encerradoEm: now,
                archiveStatus: 'completed',
            });
            await txRepo.saveEvento({
                id: uuidv7(),
                demandaId,
                type: 'demanda.encerrada',
                correlationId: demandaId,
                causationId: null,
                payload: { motivo },
                deviceId: null,
                userId: null,
                createdAt: now,
            });
        });
    }
}
