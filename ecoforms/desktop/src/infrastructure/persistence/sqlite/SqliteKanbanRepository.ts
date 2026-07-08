import { uuidv7 } from 'ecoforms-core';
import type { KanbanRepository, TaskEventInput, CreateKanbanTaskInput, UpdateKanbanTaskInput, PatchKanbanTaskInput, ApproveSolicitacaoInput, TarefaCampoRow } from '../../../domain/kanban/KanbanRepository';
import type { Interessado } from '@/types';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import { getEffectiveSectors } from '../SectorQueryUtils';

export class SqliteKanbanRepository implements KanbanRepository {
    constructor(private readonly db: SqlitePort) {}

    async isUserActive(userId: string): Promise<boolean> {
        const rows = await this.db.query<{ ativo: number | null }>(
            `SELECT ativo FROM usuarios WHERE id = ?`,
            [userId],
        );
        const row = rows[0];
        return row ? row.ativo !== 0 : true;
    }

    async isFormActive(formId: string): Promise<boolean> {
        const rows = await this.db.query<{ ativo: number | null }>(
            `SELECT ativo FROM registro_formularios WHERE form_id = ?`,
            [formId],
        );
        const row = rows[0];
        return row ? row.ativo !== 0 : true;
    }

    async getUserSectors(userId: string): Promise<string[]> {
        const rows = await this.db.query<{ setor_id: string }>(
            `SELECT us.setor_id FROM usuarios_setores us WHERE us.usuario_id = ?
             UNION
             SELECT u.setor_principal_id FROM usuarios u WHERE u.id = ? AND u.setor_principal_id IS NOT NULL`,
            [userId, userId],
        );
        return rows.map(r => r.setor_id);
    }

    async insertTaskEvent(input: TaskEventInput): Promise<void> {
        await this.db.execute(
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

    async createTask(input: CreateKanbanTaskInput, interessados?: Interessado[]): Promise<void> {
        await this.db.execute(
            `INSERT INTO tarefas (
                id, projeto_id, titulo, descricao, status, prioridade, setor_id, atribuido_para, criado_por,
                prazo, prazo_fim, tipo_prazo, recorrencia, ordem, etiquetas, arquivado, id_formulario,
                suite_id, tarefa_pai_id, tarefa_container_id, id_ciclo, depende_tarefa_id,
                versao_snapshot, hash_snapshot, snapshot_congelado_em, localizacao, carga, criado_em, atualizado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
                input.id, input.projetoId, input.titulo, input.descricao, input.status, input.prioridade,
                input.setorId, input.atribuidoPara, input.criadoPor, input.prazo, input.prazoFim,
                input.tipoPrazo, input.recorrencia, input.ordem, input.tags, input.arquivado,
                input.formRegistryId, input.tblSuiteId, input.parentTaskId, input.containerTaskId,
                input.cycleId, input.dependsOnTaskId, input.snapVersion, input.snapHash,
                input.snapFrozenAt, input.location, input.payload,
            ],
        );
        if (interessados && interessados.length > 0) {
            for (const i of interessados) {
                await this.db.execute(
                    `INSERT INTO tarefas_interessados (tarefa_id, usuario_id, permissao) VALUES (?, ?, ?)`,
                    [input.id, i.usuario_id, i.permissao],
                );
            }
        }
    }

    async updateTask(id: string, input: UpdateKanbanTaskInput, interessados?: Interessado[]): Promise<void> {
        const fields: string[] = [];
        const params: (string | number | null)[] = [];

        if (input.titulo !== undefined) { fields.push('titulo = ?'); params.push(input.titulo); }
        if (input.descricao !== undefined) { fields.push('descricao = ?'); params.push(input.descricao); }
        if (input.status !== undefined) { fields.push('status = ?'); params.push(input.status); }
        if (input.prioridade !== undefined) { fields.push('prioridade = ?'); params.push(input.prioridade); }
        if (input.prazo !== undefined) { fields.push('prazo = ?'); params.push(input.prazo); }
        if (input.prazoFim !== undefined) { fields.push('prazo_fim = ?'); params.push(input.prazoFim); }
        if (input.tipoPrazo !== undefined) { fields.push('tipo_prazo = ?'); params.push(input.tipoPrazo); }
        if (input.recorrencia !== undefined) { fields.push('recorrencia = ?'); params.push(input.recorrencia); }
        if (input.atribuidoPara !== undefined) { fields.push('atribuido_para = ?'); params.push(input.atribuidoPara); }
        if (input.setorId !== undefined) { fields.push('setor_id = ?'); params.push(input.setorId); }
        if (input.projetoId !== undefined) { fields.push('projeto_id = ?'); params.push(input.projetoId); }
        if (input.ordem !== undefined) { fields.push('ordem = ?'); params.push(input.ordem); }
        if (input.tags !== undefined) { fields.push('etiquetas = ?'); params.push(input.tags); }
        if (input.formRegistryId !== undefined) { fields.push('id_formulario = ?'); params.push(input.formRegistryId); }
        if (input.tblSuiteId !== undefined) { fields.push('suite_id = ?'); params.push(input.tblSuiteId); }
        if (input.location !== undefined) { fields.push('localizacao = ?'); params.push(input.location); }
        if (input.payload !== undefined) { fields.push('carga = ?'); params.push(input.payload); }
        if (input.parentTaskId !== undefined) { fields.push('tarefa_pai_id = ?'); params.push(input.parentTaskId); }
        if (input.containerTaskId !== undefined) { fields.push('tarefa_container_id = ?'); params.push(input.containerTaskId); }
        if (input.cycleId !== undefined) { fields.push('id_ciclo = ?'); params.push(input.cycleId); }
        if (input.dependsOnTaskId !== undefined) { fields.push('depende_tarefa_id = ?'); params.push(input.dependsOnTaskId); }

        if (fields.length === 0 && (!interessados || interessados.length === 0)) return;

        if (fields.length > 0) {
            fields.push("atualizado_em = datetime('now')");
            params.push(id);
            await this.db.execute(`UPDATE tarefas SET ${fields.join(', ')} WHERE id = ?`, params);
        }

        if (interessados !== undefined) {
            await this.db.execute(`DELETE FROM tarefas_interessados WHERE tarefa_id = ?`, [id]);
            for (const i of interessados) {
                await this.db.execute(
                    `INSERT INTO tarefas_interessados (tarefa_id, usuario_id, permissao) VALUES (?, ?, ?)`,
                    [id, i.usuario_id, i.permissao],
                );
            }
        }
    }

    async unfreezeTask(
        id: string,
        patchFields?: { titulo?: string; descricao?: string; prioridade?: string; payload?: string | null }
    ): Promise<void> {
        if (patchFields && Object.keys(patchFields).length > 0) {
            const fields: string[] = [];
            const params: (string | null)[] = [];
            if (patchFields.titulo !== undefined) { fields.push('titulo = ?'); params.push(patchFields.titulo); }
            if (patchFields.descricao !== undefined) { fields.push('descricao = ?'); params.push(patchFields.descricao); }
            if (patchFields.prioridade !== undefined) { fields.push('prioridade = ?'); params.push(patchFields.prioridade); }
            if (patchFields.payload !== undefined) { fields.push('carga = ?'); params.push(patchFields.payload); }
            if (fields.length > 0) {
                fields.push("atualizado_em = datetime('now')");
                params.push(id);
                await this.db.execute(`UPDATE tarefas SET ${fields.join(', ')} WHERE id = ?`, params);
            }
        }
        await this.db.execute(
            `UPDATE tarefas SET snapshot_congelado_em = NULL, hash_snapshot = NULL, versao_snapshot = NULL, atualizado_em = datetime('now') WHERE id = ?`,
            [id],
        );
    }

    async findBookingTasksForUser(userId: string): Promise<TarefaCampoRow[]> {
        return this.db.query<TarefaCampoRow>(
            `SELECT t.id, t.titulo, t.status, t.carga, t.origem_id AS agendamento_id,
                    t.atribuido_para, t.prazo
             FROM tarefas t
             WHERE t.origem_tipo = 'agendamento'
               AND t.atribuido_para = ?
               AND date(t.prazo) = date('now')
               AND t.status NOT IN ('concluido', 'cancelado')
               AND t.arquivado = 0
             ORDER BY t.prazo ASC`,
            [userId],
        );
    }

    async patchTask(id: string, input: PatchKanbanTaskInput): Promise<void> {
        const fields: string[] = [];
        const params: (string | null)[] = [];
        if (input.titulo !== undefined) { fields.push('titulo = ?'); params.push(input.titulo); }
        if (input.descricao !== undefined) { fields.push('descricao = ?'); params.push(input.descricao); }
        if (input.prioridade !== undefined) { fields.push('prioridade = ?'); params.push(input.prioridade); }
        if (input.payload !== undefined) { fields.push('carga = ?'); params.push(input.payload); }
        if (fields.length === 0) return;
        fields.push("atualizado_em = datetime('now')");
        params.push(id);
        await this.db.execute(`UPDATE tarefas SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    async unarchiveTask(taskId: string): Promise<void> {
        await this.db.execute(
            `UPDATE tarefas SET arquivado = 0, atualizado_em = datetime('now') WHERE id = ?`,
            [taskId],
        );
    }

    async approveSolicitacao(input: ApproveSolicitacaoInput): Promise<void> {
        await this.db.execute(
            `UPDATE tarefas SET
                status        = ?,
                projeto_id    = ?,
                titulo        = ?,
                descricao     = ?,
                prioridade    = ?,
                atribuido_para = ?,
                aprovado_por  = ?,
                prazo         = ?,
                id_formulario = ?,
                carga         = ?,
                atualizado_em = datetime('now')
             WHERE id = ? AND status = 'aguardando_aprovacao'`,
            [
                input.status, input.projetoId, input.titulo, input.descricao,
                input.prioridade, input.atribuidoPara, input.aprovadoPor,
                input.prazo, input.formRegistryId, input.carga, input.taskId,
            ],
        );
    }

    async rejectSolicitacao(taskId: string, motivo: string): Promise<void> {
        await this.db.execute(
            `UPDATE tarefas SET
                status          = 'cancelado',
                motivo_rejeicao = ?,
                atualizado_em   = datetime('now')
             WHERE id = ? AND status = 'aguardando_aprovacao'`,
            [motivo, taskId],
        );
    }

    async ensureGeneralProject(userId: string): Promise<string> {
        const generalRows = await this.db.query<{ id: string }>(
            `SELECT id FROM projetos WHERE nome = 'Projeto Geral' LIMIT 1`,
        );
        const general = generalRows[0];
        if (general) return general.id;

        const newId = uuidv7();
        try {
            await this.db.execute(
                `INSERT INTO projetos (id, nome, descricao, cor, criado_por, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [newId, 'Projeto Geral', 'Projeto padrão para tarefas sem projeto específico', '#64748b', userId],
            );
            return newId;
        } catch {
            const anyRows = await this.db.query<{ id: string }>(`SELECT id FROM projetos LIMIT 1`);
            const anyProject = anyRows[0];
            if (anyProject) return anyProject.id;
            throw new Error('Não foi possível criar ou encontrar um projeto padrão.');
        }
    }

    async createProject(
        id: string,
        nome: string,
        descricao: string,
        cor: string,
        criadoPor: string,
    ): Promise<void> {
        await this.db.execute(
            `INSERT INTO projetos (id, nome, descricao, cor, criado_por, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [id, nome, descricao, cor, criadoPor],
        );
    }

    async addProjectInteressados(projetoId: string, interessados: Interessado[]): Promise<void> {
        for (const i of interessados) {
            await this.db.execute(
                `INSERT INTO projetos_interessados (projeto_id, usuario_id, permissao) VALUES (?, ?, ?)`,
                [projetoId, i.usuario_id, i.permissao],
            );
        }
    }

    async updateProject(projectId: string, nome?: string, descricao?: string, cor?: string): Promise<void> {
        const fields: string[] = [];
        const params: (string | null)[] = [];
        if (nome !== undefined) { fields.push('nome = ?'); params.push(nome); }
        if (descricao !== undefined) { fields.push('descricao = ?'); params.push(descricao); }
        if (cor !== undefined) { fields.push('cor = ?'); params.push(cor); }
        if (fields.length === 0) return;
        fields.push("atualizado_em = datetime('now')");
        params.push(projectId);
        await this.db.execute(`UPDATE projetos SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    async clearProjectInteressados(projectId: string): Promise<void> {
        await this.db.execute(
            `DELETE FROM projetos_interessados WHERE projeto_id = ?`,
            [projectId],
        );
    }

    async getKanbanData(
        userId: string,
        _perfil: string,
        _setor: string | null,
        isAdmin: boolean,
        isManager: boolean,
        accessiblePerfis: string[],
        showAllProjects: boolean,
        currentProjectId: string | null,
    ): Promise<{ projects: Record<string, unknown>[]; tasks: Record<string, unknown>[]; solicitacoes: Record<string, unknown>[] }> {
        const isAdminMgr = isAdmin || isManager;

        // ADR-047 Gaps 3/5 — segregação horizontal por setor (apenas não-admin/gerente).
        // Fallback seguro: usuário sem setor efetivo não é restringido (não trava);
        // tarefas com setor_id NULL permanecem visíveis ao criador/atribuído/interessado.
        const effectiveSectors = isAdminMgr ? [] : await getEffectiveSectors(userId, this.db);
        let sectorClause = '';
        const sectorParams: string[] = [];
        if (!isAdminMgr && effectiveSectors.length > 0) {
            const ph = effectiveSectors.map(() => '?').join(',');
            sectorClause = ` AND (t.setor_id IS NULL OR t.setor_id IN (${ph}))`;
            sectorParams.push(...effectiveSectors);
        }

        const projectsRows = await this.db.query<Record<string, unknown>>(
            `SELECT p.*, u.nome AS criado_por_nome,
                COALESCE((SELECT json_group_array(json_object('usuario_id', usuario_id, 'permissao', permissao, 'contexto', 'projeto')) FROM projetos_interessados WHERE projeto_id = p.id), '[]') as interessados_json,
                CASE
                    WHEN p.criado_por = ? THEN 'dono'
                    WHEN EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = p.id AND pi.usuario_id = ? AND pi.permissao = 'edicao') THEN 'edicao'
                    ELSE 'leitura'
                END as meu_nivel_acesso
            FROM projetos p
            LEFT JOIN usuarios u ON u.id = p.criado_por
            WHERE p.arquivado_em IS NULL
              AND (
                ? OR p.criado_por = ? OR EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = p.id AND pi.usuario_id = ?)
              )
            ORDER BY p.criado_em DESC`,
            [userId, userId, isAdminMgr ? 1 : 0, userId, userId],
        );

        const baseSelect = `
            SELECT t.*,
                COALESCE(p.nome, 'Projeto Geral') as projeto_nome,
                COALESCE(p.cor, '#888888') as projeto_cor,
                u.nome as atribuido_username,
                u_criador.nome AS criador_username,
                fr.titulo as form_nome,
                ts.status as form_status,
                ts.carga_json as form_dados,
                d.status as demanda_status,
                d.destinatario_id as demanda_destinatario_id,
                s.nome as demanda_setor_nome,
                COALESCE((SELECT json_group_array(json_object('usuario_id', usuario_id, 'permissao', permissao, 'contexto', 'tarefa')) FROM tarefas_interessados WHERE tarefa_id = t.id), '[]') as interessados_json,
                CASE
                    WHEN t.criado_por = ? THEN 'dono'
                    WHEN t.atribuido_para = ? THEN 'edicao'
                    WHEN EXISTS (SELECT 1 FROM tarefas_interessados ti WHERE ti.tarefa_id = t.id AND ti.usuario_id = ? AND ti.permissao = 'edicao') THEN 'edicao'
                    WHEN EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = t.projeto_id AND pi.usuario_id = ? AND pi.permissao = 'edicao') THEN 'edicao'
                    ELSE 'leitura'
                END as meu_nivel_acesso,
                COALESCE((SELECT COUNT(*) FROM tarefas_comentarios c WHERE c.tarefa_id = t.id), 0) as num_comentarios,
                COALESCE((SELECT COUNT(*) FROM tarefas_anexos a WHERE a.tarefa_id = t.id), 0) as num_anexos,
                COALESCE((SELECT COUNT(*) FROM pacotes s WHERE s.id_pacote = t.suite_id), 0) as num_registros,
                CASE
                    WHEN t.tipo_prazo = 'periodo' AND t.prazo_fim IS NOT NULL AND date(t.prazo_fim) < date('now') AND t.status != 'concluido' THEN 1
                    WHEN (t.tipo_prazo IS NULL OR t.tipo_prazo = 'unico') AND t.prazo IS NOT NULL AND date(t.prazo) < date('now') AND t.status != 'concluido' THEN 1
                    ELSE 0
                END as atrasado,
                CASE
                    WHEN t.tipo_prazo = 'periodo' AND t.prazo_fim IS NOT NULL AND date(t.prazo_fim) <= date('now', '+3 days') AND t.status != 'concluido' THEN 1
                    WHEN (t.tipo_prazo IS NULL OR t.tipo_prazo = 'unico') AND t.prazo IS NOT NULL AND date(t.prazo) <= date('now', '+3 days') AND t.status != 'concluido' THEN 1
                    ELSE 0
                END as proximo_prazo
            FROM tarefas t
            LEFT JOIN projetos p ON t.projeto_id = p.id
            LEFT JOIN usuarios u ON t.atribuido_para = u.id
            LEFT JOIN usuarios u_criador ON t.criado_por = u_criador.id
            LEFT JOIN registro_formularios fr ON t.id_formulario = fr.form_id
            LEFT JOIN pacotes ts ON t.suite_id = ts.id_pacote
            LEFT JOIN demandas d ON t.demanda_id = d.id
            LEFT JOIN setores s ON d.destinatario_id = s.id
        `;
        const baseWhere = `t.arquivado = 0 AND (t.deletado_em IS NULL) AND t.status != 'cancelado'`;
        let taskSql: string;
        const taskParams: unknown[] = [userId, userId, userId, userId];
        if (showAllProjects) {
            taskSql = `${baseSelect} WHERE ${baseWhere} AND (? OR t.criado_por = ? OR t.atribuido_para = ? OR EXISTS (SELECT 1 FROM tarefas_interessados ti WHERE ti.tarefa_id = t.id AND ti.usuario_id = ?) OR EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = t.projeto_id AND pi.usuario_id = ?))${sectorClause} ORDER BY t.ordem ASC`;
            taskParams.push(isAdminMgr ? 1 : 0, userId, userId, userId, userId);
        } else if (currentProjectId) {
            taskSql = `${baseSelect} WHERE ${baseWhere} AND t.projeto_id = ? AND (? OR t.criado_por = ? OR t.atribuido_para = ? OR EXISTS (SELECT 1 FROM tarefas_interessados ti WHERE ti.tarefa_id = t.id AND ti.usuario_id = ?) OR EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = t.projeto_id AND pi.usuario_id = ?))${sectorClause} ORDER BY t.ordem ASC`;
            taskParams.push(currentProjectId, isAdminMgr ? 1 : 0, userId, userId, userId, userId);
        } else {
            taskSql = `${baseSelect} WHERE ${baseWhere} AND t.projeto_id IS NULL AND (? OR t.criado_por = ? OR t.atribuido_para = ? OR EXISTS (SELECT 1 FROM tarefas_interessados ti WHERE ti.tarefa_id = t.id AND ti.usuario_id = ?) OR EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = t.projeto_id AND pi.usuario_id = ?))${sectorClause} ORDER BY t.ordem ASC`;
            taskParams.push(isAdminMgr ? 1 : 0, userId, userId, userId, userId);
        }
        // sectorClause é anexado ao final do WHERE em todas as variantes → params ao final do array
        if (sectorClause) taskParams.push(...sectorParams);
        const tasksRows = await this.db.query<Record<string, unknown>>(taskSql, taskParams);

        let solicitacoesRows: Record<string, unknown>[] = [];
        if (isAdmin || isManager) {
            if (showAllProjects && currentProjectId === null) {
                solicitacoesRows = await this.db.query<Record<string, unknown>>(
                    `SELECT t.*, u.nome as user_nome
                     FROM tarefas t
                     LEFT JOIN usuarios u ON t.criado_por = u.id
                     WHERE t.status = 'aguardando_aprovacao'
                       AND t.origem = 'solicitacao'
                       AND t.arquivado = 0
                       AND (t.deletado_em IS NULL)
                     ORDER BY t.criado_em DESC`,
                    [],
                );
            }
        }

        return { projects: projectsRows, tasks: tasksRows, solicitacoes: solicitacoesRows };
    }
}
