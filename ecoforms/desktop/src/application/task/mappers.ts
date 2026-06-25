import type { Task } from '../../domain/task/Task';
import type { TaskDto } from './dto/TaskDto';

export function toTaskDto(task: Task): TaskDto {
    const p = task.toProps();
    return {
        id: p.id,
        titulo: p.titulo,
        status: p.status,
        prioridade: p.prioridade,
        ordem: p.ordem,
        criadoPor: p.criadoPor,
        projetoId: p.projetoId ?? null,
        descricao: p.descricao,
        atribuidoPara: p.atribuidoPara ?? null,
        prazo: p.prazo ?? null,
        prazoFim: p.prazoFim ?? null,
        tipoPrazo: p.tipoPrazo ?? null,
        formRegistryId: p.formRegistryId ?? null,
        tblSuiteId: p.tblSuiteId ?? null,
        parentTaskId: p.parentTaskId ?? null,
        demandaId: p.demandaId ?? null,
        arquivado: !!p.arquivado,
        recorrencia: p.recorrencia ?? null,
        setorId: p.setorId ?? null,
        origemTipo: p.origemTipo ?? null,
        origemId: p.origemId ?? null,
        criadoEm: p.criadoEm,
        atualizadoEm: p.atualizadoEm,
    };
}
