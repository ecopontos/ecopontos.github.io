import { InvalidTransitionError } from '../shared/errors';
import { describeTransition, isValidTransition, type TaskStatus } from './TaskStatus';

export type TaskPriority = 'baixa' | 'media' | 'alta';

export interface TaskProps {
    id: string;
    titulo: string;
    status: TaskStatus;
    prioridade: TaskPriority;
    ordem: number;
    criadoPor: string;
    projetoId?: string | null;
    descricao?: string;
    atribuidoPara?: string | null;
    prazo?: string | null;
    prazoFim?: string | null;
    tipoPrazo?: 'unico' | 'periodo' | 'recorrente' | null;
    recorrencia?: string | null;
    formRegistryId?: string | null;
    tblSuiteId?: number | string | null;
    parentTaskId?: string | null;
    demandaId?: string | null;
    setorId?: string | null;
    origemTipo?: string | null;
    origemId?: string | null;
    arquivado?: boolean;
    criadoEm?: string;
    atualizadoEm?: string;
}

/**
 * Entidade de domínio Task. Encapsula a máquina de estados e invariantes.
 * Construir via {@link Task.fromProps}; persistir via {@link Task.toProps}.
 */
export class Task {
    private constructor(private props: TaskProps) {}

    static fromProps(props: TaskProps): Task {
        return new Task({ ...props });
    }

    toProps(): TaskProps {
        return { ...this.props };
    }

    get id(): string { return this.props.id; }
    get status(): TaskStatus { return this.props.status; }
    get titulo(): string { return this.props.titulo; }
    get ordem(): number { return this.props.ordem; }
    get projetoId(): string | null | undefined { return this.props.projetoId; }
    get demandaId(): string | null | undefined { return this.props.demandaId; }
    get atribuidoPara(): string | null | undefined { return this.props.atribuidoPara; }
    get criadoPor(): string { return this.props.criadoPor; }
    get arquivado(): boolean { return !!this.props.arquivado; }
    get tipoPrazo(): 'unico' | 'periodo' | 'recorrente' | null | undefined { return this.props.tipoPrazo; }
    get recorrencia(): string | null | undefined { return this.props.recorrencia; }

    transitionTo(newStatus: TaskStatus): void {
        if (!isValidTransition(this.props.status, newStatus)) {
            throw new InvalidTransitionError(this.props.status, newStatus, 'Task');
        }
        this.props.status = newStatus;
    }

    assignTo(userId: string | null): void {
        this.props.atribuidoPara = userId;
    }

    rename(titulo: string): void {
        const trimmed = titulo.trim();
        if (!trimmed) throw new Error('Título da tarefa não pode ser vazio.');
        this.props.titulo = trimmed;
    }

    reorder(ordem: number): void {
        if (!Number.isFinite(ordem)) throw new Error('Ordem inválida.');
        this.props.ordem = ordem;
    }

    archive(): void {
        this.props.arquivado = true;
    }

    unarchive(): void {
        this.props.arquivado = false;
    }

    canTransitionTo(status: TaskStatus): boolean {
        return isValidTransition(this.props.status, status);
    }

    describeInvalidTransition(to: TaskStatus): string {
        return describeTransition(this.props.status, to);
    }

    toSyncJSON(): Record<string, unknown> {
        return {
            id: this.props.id,
            projeto_id: this.props.projetoId ?? null,
            titulo: this.props.titulo,
            descricao: this.props.descricao ?? null,
            status: this.props.status,
            prioridade: this.props.prioridade,
            atribuido_para: this.props.atribuidoPara ?? null,
            criado_por: this.props.criadoPor,
            prazo: this.props.prazo ?? null,
            prazo_fim: this.props.prazoFim ?? null,
            tipo_prazo: this.props.tipoPrazo ?? 'unico',
            recorrencia: this.props.recorrencia ?? null,
            ordem: this.props.ordem,
            arquivado: this.props.arquivado ? 1 : 0,
            form_registry_id: this.props.formRegistryId ?? null,
            suite_id: this.props.tblSuiteId ?? null,
            demanda_id:  this.props.demandaId ?? null,
            setor_id:    this.props.setorId ?? null,
            origem_tipo: this.props.origemTipo ?? null,
            origem_id:   this.props.origemId ?? null,
            created_at:  this.props.criadoEm ?? null,
            updated_at:  this.props.atualizadoEm ?? null,
        };
    }
}
