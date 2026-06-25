import type { TaskDto } from '../../application/task/dto/TaskDto';
import { statusLabel } from '../../domain/task/TaskStatus';

export interface TaskViewModel {
    id: string;
    titulo: string;
    statusLabel: string;
    status: TaskDto['status'];
    prioridade: TaskDto['prioridade'];
    ordem: number;
    atribuidoPara: string | null;
    prazo: string | null;
    arquivado: boolean;
    atrasado: boolean;
    projetoId: string | null;
    formRegistryId: string | null;
}

export function toTaskViewModel(dto: TaskDto, now: Date = new Date()): TaskViewModel {
    const prazoDate = dto.prazo ? new Date(dto.prazo) : null;
    const atrasado = !!prazoDate && prazoDate.getTime() < now.getTime() && dto.status !== 'concluido';

    return {
        id: dto.id,
        titulo: dto.titulo,
        statusLabel: statusLabel(dto.status),
        status: dto.status,
        prioridade: dto.prioridade,
        ordem: dto.ordem,
        atribuidoPara: dto.atribuidoPara,
        prazo: dto.prazo,
        arquivado: dto.arquivado,
        atrasado,
        projetoId: dto.projetoId,
        formRegistryId: dto.formRegistryId,
    };
}
