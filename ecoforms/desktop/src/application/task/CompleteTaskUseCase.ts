import { NotFoundError } from '../../domain/shared/errors';
import type { TaskRepository } from '../../domain/task/TaskRepository';
import { Task } from '../../domain/task/Task';
import type { DemandaTaskSynchronizer } from '../demanda/services/DemandaTaskSynchronizer';
import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';
import type { TaskDto } from './dto/TaskDto';
import { toTaskDto } from './mappers';
import { calculateNextOccurrence } from 'ecoforms-core';
import type { TaskDateConfig } from '@/types';

export interface CompleteTaskInput {
    id: string;
}

/**
 * CompleteTaskUseCase — Conclui uma tarefa e gerencia recorrência
 *
 * Responsabilidades:
 * 1. Validar e executar transição para 'concluido'
 * 2. Sincronizar com demandas (se aplicável)
 * 3. Emitir evento de sync
 * 4. Se tarefa recorrente, criar próxima ocorrência
 *
 * @module CompleteTaskUseCase
 */
export class CompleteTaskUseCase {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly synchronizer: DemandaTaskSynchronizer,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(input: CompleteTaskInput): Promise<TaskDto> {
        const task = await this.tasks.findById(input.id);
        if (!task) throw new NotFoundError('Task', input.id);

        // Executar transição para concluído
        task.transitionTo('concluido');
        await this.tasks.save(task);

        // Sincronizar com demanda (se aplicável)
        if (task.demandaId) {
            await this.synchronizer.aoMoverTask(task.id, task.demandaId, 'concluido');
        }

        // Emitir evento de sync
        await this.sync.write('task.concluida', {
            tarefa_id: task.id,
            demanda_id: task.demandaId ?? null,
        }, { aggregateId: task.id, streamId: task.demandaId ?? undefined });

        // Gerar próxima ocorrência se tarefa recorrente
        if (task.tipoPrazo === 'recorrente' && task.recorrencia) {
            await this.criarProximaOcorrencia(task);
        }

        return toTaskDto(task);
    }

    /**
     * Cria a próxima ocorrência de uma tarefa recorrente
     */
    private async criarProximaOcorrencia(task: any): Promise<void> {
        try {
            // Extrair configuração de data
            const dateConfig: TaskDateConfig | undefined = task.payload?.dateConfig || (task.recorrencia ? {
                tipo: 'recorrente',
                data_inicio: task.prazo,
                recorrencia: typeof task.recorrencia === 'string'
                    ? JSON.parse(task.recorrencia)
                    : task.recorrencia
            } : undefined);

            if (!dateConfig?.recorrencia) return;

            // Calcular próxima data
            const nextDate = calculateNextOccurrence(
                dateConfig.data_inicio || task.prazo || new Date().toISOString(),
                dateConfig.recorrencia
            );

            if (!nextDate) return;

            // Preparar configuração para próxima ocorrência
            const nextConfig = { ...dateConfig, data_inicio: nextDate };
            const nextRecorrencia = typeof dateConfig.recorrencia === 'string'
                ? dateConfig.recorrencia
                : JSON.stringify(dateConfig.recorrencia);

            // Criar nova tarefa com próxima data
            const props = task.toProps();
            const newTask = Task.fromProps({
                ...props,
                id: undefined as unknown as string, // Novo ID será gerado
                status: 'a_fazer',
                prazo: nextDate,
                tipoPrazo: 'recorrente',
                recorrencia: nextRecorrencia,
                payload: { ...props.payload, dateConfig: nextConfig },
            });
            await this.tasks.save(newTask);
        } catch (error) {
            // Log erro mas não falha a conclusão da tarefa atual
            console.error('[CompleteTaskUseCase] Erro ao criar próxima ocorrência:', error);
        }
    }
}
