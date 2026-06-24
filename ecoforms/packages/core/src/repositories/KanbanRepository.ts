import type { SqlitePort } from '../ports/SqlitePort.js';

export interface Interessado {
    usuario_id: string;
    permissao: 'leitura' | 'edicao';
    nome?: string;
    contexto?: 'tarefa' | 'projeto';
}

export interface TaskEventInput {
    id: string;
    tarefaId: string;
    tipo: string;
    descricao: string | null;
    usuarioId: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface CreateKanbanTaskInput {
    id: string;
    projetoId: string;
    titulo: string;
    descricao: string;
    status: string;
    prioridade: string;
    atribuidoPara: string | null;
    setorId: string | null;
    criadoPor: string;
    prazo: string | null;
    prazoFim: string | null;
    tipoPrazo: string;
    recorrencia: string | null;
    ordem: number;
    tags: string;
    arquivado: number;
    formRegistryId: string | null;
    tblSuiteId: string | null;
    parentTaskId: string | null;
    containerTaskId: string | null;
    cycleId: string | null;
    dependsOnTaskId: string | null;
    snapVersion: string | null;
    snapHash: string | null;
    snapFrozenAt: string | null;
    location: string | null;
    payload: string | null;
}

export interface UpdateKanbanTaskInput {
    titulo?: string;
    descricao?: string;
    status?: string;
    prioridade?: string;
    prazo?: string | null;
    prazoFim?: string | null;
    tipoPrazo?: string;
    recorrencia?: string | null;
    atribuidoPara?: string | null;
    setorId?: string | null;
    projetoId?: string | null;
    ordem?: number;
    tags?: string;
    formRegistryId?: string | null;
    tblSuiteId?: string | null;
    location?: string | null;
    payload?: string | null;
    parentTaskId?: string | null;
    containerTaskId?: string | null;
    cycleId?: string | null;
    dependsOnTaskId?: string | null;
}

export interface PatchKanbanTaskInput {
    titulo?: string;
    descricao?: string;
    prioridade?: string;
    payload?: string | null;
}

export interface ApproveSolicitacaoInput {
    taskId: string;
    projetoId: string | null;
    titulo: string;
    descricao: string | null;
    status: string;
    prioridade: string | null;
    atribuidoPara: string | null;
    aprovadoPor: string;
    prazo: string | null;
    formRegistryId: string | null;
    carga: string | null;
}

export interface TarefaCampoRow {
    id: string;
    titulo: string;
    status: string;
    carga: string | null;
    agendamento_id: string | null;
    atribuido_para: string | null;
    prazo: string | null;
}

export interface KanbanRepository {
    isUserActive(userId: string): Promise<boolean>;
    isFormActive(formId: string): Promise<boolean>;
    getUserSectors(userId: string): Promise<string[]>;
    insertTaskEvent(input: TaskEventInput): Promise<void>;
    findBookingTasksForUser(userId: string): Promise<TarefaCampoRow[]>;
    createTask(input: CreateKanbanTaskInput, interessados?: Interessado[]): Promise<void>;
    updateTask(id: string, input: UpdateKanbanTaskInput, interessados?: Interessado[]): Promise<void>;
    unfreezeTask(id: string, patchFields?: { titulo?: string; descricao?: string; prioridade?: string; payload?: string | null }): Promise<void>;
    patchTask(id: string, input: PatchKanbanTaskInput): Promise<void>;
    unarchiveTask(taskId: string): Promise<void>;
    approveSolicitacao(input: ApproveSolicitacaoInput): Promise<void>;
    rejectSolicitacao(packageId: string, motivo: string): Promise<void>;
    ensureGeneralProject(userId: string): Promise<string>;
    createProject(id: string, nome: string, descricao: string, cor: string, criadoPor: string): Promise<void>;
    addProjectInteressados(projetoId: string, interessados: Interessado[]): Promise<void>;
    updateProject(projectId: string, nome?: string, descricao?: string, cor?: string): Promise<void>;
    clearProjectInteressados(projectId: string): Promise<void>;
    getKanbanData(
        userId: string,
        perfil: string,
        setor: string | null,
        isAdmin: boolean,
        isManager: boolean,
        accessiblePerfis: string[],
        showAllProjects: boolean,
        currentProjectId: string | null
    ): Promise<{ projects: Record<string, unknown>[]; tasks: Record<string, unknown>[]; solicitacoes: Record<string, unknown>[] }>;
}

// ── SqliteSyncEventRepository ─────────────────────────────────────────────────

export interface SyncEventRow {
    id: string;
    tipo: string;
    carga: string;
    tipo_agregado: string | null;
    id_agregado: string | null;
    situacao: 'pending' | 'sent' | 'failed';
    tentativas: number;
    id_envelope: string | null;
    criado_em: string;
}

export interface SyncEventRepository {
    enqueue(event: Omit<SyncEventRow, 'situacao' | 'tentativas' | 'criado_em'>): Promise<void>;
    getPending(limit?: number): Promise<SyncEventRow[]>;
    markSent(id: string, envelopeId?: string): Promise<void>;
    markFailed(id: string): Promise<void>;
    clear(): Promise<void>;
}

export class SqliteSyncEventRepository implements SyncEventRepository {
    constructor(private readonly db: SqlitePort) {}

    async enqueue(event: Omit<SyncEventRow, 'situacao' | 'tentativas' | 'criado_em'>): Promise<void> {
        await this.db.execute(
            `INSERT OR IGNORE INTO fila_eventos_sync
             (id, tipo, carga, tipo_agregado, id_agregado, situacao, tentativas, id_envelope, criado_em)
             VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, datetime('now'))`,
            [event.id, event.tipo, event.carga, event.tipo_agregado ?? null,
             event.id_agregado ?? null, event.id_envelope ?? null],
        );
    }

    async getPending(limit = 50): Promise<SyncEventRow[]> {
        return this.db.query<SyncEventRow>(
            `SELECT * FROM fila_eventos_sync WHERE situacao = 'pending' ORDER BY criado_em ASC LIMIT ?`,
            [limit],
        );
    }

    async markSent(id: string, envelopeId?: string): Promise<void> {
        await this.db.execute(
            `UPDATE fila_eventos_sync SET situacao = 'sent', id_envelope = COALESCE(?, id_envelope),
             enviado_em = datetime('now') WHERE id = ?`,
            [envelopeId ?? null, id],
        );
    }

    async markFailed(id: string): Promise<void> {
        await this.db.execute(
            `UPDATE fila_eventos_sync SET situacao = 'failed', tentativas = tentativas + 1 WHERE id = ?`,
            [id],
        );
    }

    async clear(): Promise<void> {
        await this.db.execute(`DELETE FROM fila_eventos_sync WHERE situacao = 'sent'`);
    }
}
