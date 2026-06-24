/**
 * MobileKanbanRepository
 *
 * Implementa o subset de KanbanRepository (ecoforms-core/repositories)
 * necessário para o runtime mobile — especificamente para "Tarefas de Campo".
 *
 * Métodos implementados:
 *   - findBookingTasksForUser  → tela /minhas-tarefas-campo
 *   - updateTask               → confirmar desfecho
 *   - insertTaskEvent          → registrar status/intercorrência
 *
 * Métodos de gestão completa (Kanban board, projetos) não fazem sentido
 * no mobile e lançam erro explícito se chamados acidentalmente.
 *
 * ADR-052 — Fase 3
 */

import { sqliteAdapter } from './CapacitorSqliteAdapter.js';
import { SqliteSyncEventRepository } from '../../node_modules/ecoforms-core/dist/repositories/index.js';

export class MobileKanbanRepository {
    /** @type {import('./CapacitorSqliteAdapter.js').CapacitorSqliteAdapter} */
    #db;

    constructor(db = sqliteAdapter) {
        this.#db = db;
    }

    // ── Tarefas de Campo ───────────────────────────────────────────────

    /**
     * Retorna as tarefas booking do usuário para hoje.
     * @param {string} userId
     * @returns {Promise<import('ecoforms-core').TarefaCampoRow[]>}
     */
    async findBookingTasksForUser(userId) {
        return this.#db.query(
            `SELECT t.id, t.titulo, t.status, t.carga, t.agendamento_id,
                    t.atribuido_para, t.prazo
             FROM tarefas t
             WHERE t.origem = 'booking'
               AND t.atribuido_para = ?
               AND date(t.prazo) = date('now')
               AND t.status NOT IN ('concluido', 'cancelado', 'arquivado')
             ORDER BY t.prazo ASC`,
            [userId],
        );
    }

    /**
     * Atualiza campos de uma tarefa.
     * @param {string} id
     * @param {Partial<import('ecoforms-core').UpdateKanbanTaskInput>} input
     */
    async updateTask(id, input) {
        const fields = [];
        const params = [];

        if (input.status      !== undefined) { fields.push('status = ?');       params.push(input.status); }
        if (input.titulo      !== undefined) { fields.push('titulo = ?');       params.push(input.titulo); }
        if (input.descricao   !== undefined) { fields.push('descricao = ?');    params.push(input.descricao); }
        if (input.prioridade  !== undefined) { fields.push('prioridade = ?');   params.push(input.prioridade); }
        if (input.prazo       !== undefined) { fields.push('prazo = ?');        params.push(input.prazo); }
        if (input.atribuidoPara !== undefined) { fields.push('atribuido_para = ?'); params.push(input.atribuidoPara); }
        if (input.payload     !== undefined) { fields.push('carga = ?');        params.push(input.payload); }

        if (fields.length === 0) return;

        fields.push("atualizado_em = datetime('now')");
        params.push(id);
        await this.#db.execute(`UPDATE tarefas SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    /**
     * Insere evento em tarefas_eventos.
     * @param {import('ecoforms-core').TaskEventInput} input
     */
    async insertTaskEvent(input) {
        await this.#db.execute(
            `INSERT INTO tarefas_eventos (id, tarefa_id, tipo, descricao, usuario_id, metadata, criado_em)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                input.id,
                input.tarefaId,
                input.tipo,
                input.descricao ?? null,
                input.usuarioId ?? null,
                input.metadata ? JSON.stringify(input.metadata) : null,
            ],
        );
    }

    // ── Stubs — não suportados no mobile ──────────────────────────────

    #notSupported(method) {
        throw new Error(`MobileKanbanRepository: '${method}' não suportado no runtime mobile`);
    }

    async isUserActive()         { this.#notSupported('isUserActive'); }
    async isFormActive()         { this.#notSupported('isFormActive'); }
    async getUserSectors()       { this.#notSupported('getUserSectors'); }
    async createTask()           { this.#notSupported('createTask'); }
    async unfreezeTask()         { this.#notSupported('unfreezeTask'); }
    async patchTask()            { this.#notSupported('patchTask'); }
    async unarchiveTask()        { this.#notSupported('unarchiveTask'); }
    async approveSolicitacao()   { this.#notSupported('approveSolicitacao'); }
    async rejectSolicitacao()    { this.#notSupported('rejectSolicitacao'); }
    async ensureGeneralProject() { this.#notSupported('ensureGeneralProject'); }
    async createProject()        { this.#notSupported('createProject'); }
    async addProjectInteressados() { this.#notSupported('addProjectInteressados'); }
    async updateProject()        { this.#notSupported('updateProject'); }
    async clearProjectInteressados() { this.#notSupported('clearProjectInteressados'); }
    async getKanbanData()        { this.#notSupported('getKanbanData'); }
}

/** Singleton para uso nos componentes mobile. */
export const mobileKanbanRepository = new MobileKanbanRepository();

/** SqliteSyncEventRepository re-exportado para uso no mobile. */
export { SqliteSyncEventRepository };
