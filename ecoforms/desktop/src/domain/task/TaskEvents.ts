/**
 * TaskEvents.ts — Constantes de eventos do domínio de tarefas
 *
 * Centraliza todos os tipos de eventos relacionados a tarefas para evitar
 * strings mágicas espalhadas pelo código. Usado por:
 * - Use cases (emitem eventos)
 * - HandlerRegistry (consome eventos)
 * - EventEnvelope (declara tipos)
 *
 * @module TaskEvents
 */

export const TaskEvents = {
    /** Tarefa criada */
    CRIADA: 'task.criada',

    /** Tarefa movida (status alterado) */
    MOVIDA: 'task.movida',

    /** Tarefa concluída */
    CONCLUIDA: 'task.concluida',

    /** Tarefa arquivada */
    ARQUIVADA: 'task.arquivada',

    /** Tarefa desarquivada */
    DESARQUIVADA: 'task.desarquivada',

    /** Tarefa atualizada (campos editados) */
    ATUALIZADA: 'task.atualizada',

    /** Tarefa excluída */
    EXCLUIDA: 'task.excluida',

    /** Comentário adicionado à tarefa */
    COMENTARIO_ADICIONADO: 'task.comentario_adicionado',
} as const;

export type TaskEventType = (typeof TaskEvents)[keyof typeof TaskEvents];
