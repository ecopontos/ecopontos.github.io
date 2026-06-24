import { uuidv7 } from 'ecoforms-core';
import { Task, type TaskProps } from '../../../domain/task/Task';
import type { TaskQuery, TaskRepository } from '../../../domain/task/TaskRepository';
import type { TaskStatus } from '../../../domain/task/TaskStatus';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface TaskRow {
    id: string;
    projeto_id: string | null;
    titulo: string;
    descricao: string | null;
    status: TaskStatus;
    prioridade: 'baixa' | 'media' | 'alta';
    atribuido_para: string | null;
    criado_por: string;
    prazo: string | null;
    prazo_fim: string | null;
    tipo_prazo: 'unico' | 'periodo' | 'recorrente' | null;
    recorrencia: string | null;
    ordem: number;
    arquivado: number;
    id_formulario: string | null;
    suite_id: string | number | null;
    demanda_id: string | null;
    setor_id: string | null;
    origem_tipo: string | null;
    origem_id: string | null;
    criado_em: string | null;
    atualizado_em: string | null;
}

function rowToTask(row: TaskRow): Task {
    const props: TaskProps = {
        id: row.id,
        projetoId: row.projeto_id,
        titulo: row.titulo,
        descricao: row.descricao ?? undefined,
        status: row.status,
        prioridade: row.prioridade,
        atribuidoPara: row.atribuido_para,
        criadoPor: row.criado_por,
        prazo: row.prazo,
        prazoFim: row.prazo_fim,
        tipoPrazo: row.tipo_prazo,
        recorrencia: row.recorrencia,
        ordem: row.ordem,
        arquivado: row.arquivado === 1,
        formRegistryId: row.id_formulario,
        tblSuiteId: row.suite_id,
        demandaId: row.demanda_id,
        setorId: row.setor_id,
        origemTipo: row.origem_tipo,
        origemId: row.origem_id,
        criadoEm: row.criado_em ?? undefined,
        atualizadoEm: row.atualizado_em ?? undefined,
    };
    return Task.fromProps(props);
}

const SELECT_COLUMNS = [
    'id', 'projeto_id', 'titulo', 'descricao', 'status', 'prioridade',
    'atribuido_para', 'criado_por', 'prazo', 'prazo_fim', 'tipo_prazo',
    'recorrencia', 'ordem', 'arquivado', 'id_formulario', 'suite_id',
    'demanda_id', 'setor_id', 'origem_tipo', 'origem_id', 'criado_em', 'atualizado_em',
].join(', ');

export class SqliteTaskRepository implements TaskRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<Task | null> {
        const rows = await this.db.query<TaskRow>(
            `SELECT ${SELECT_COLUMNS} FROM tarefas WHERE id = ? AND deletado_em IS NULL LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToTask(rows[0]) : null;
    }

    async findByProject(projectId: string | null, includeArchived = false): Promise<Task[]> {
        const archivedClause = includeArchived ? '' : 'AND arquivado = 0';
        const rows = projectId === null
            ? await this.db.query<TaskRow>(
                `SELECT ${SELECT_COLUMNS} FROM tarefas
                 WHERE projeto_id IS NULL AND deletado_em IS NULL ${archivedClause}
                 ORDER BY ordem ASC`,
            )
            : await this.db.query<TaskRow>(
                `SELECT ${SELECT_COLUMNS} FROM tarefas
                 WHERE projeto_id = ? AND deletado_em IS NULL ${archivedClause}
                 ORDER BY ordem ASC`,
                [projectId],
            );
        return rows.map(rowToTask);
    }

    async query(filter: TaskQuery): Promise<Task[]> {
        const clauses: string[] = ['deletado_em IS NULL'];
        const params: unknown[] = [];
        if (filter.projectId !== undefined) {
            if (filter.projectId === null) clauses.push('projeto_id IS NULL');
            else { clauses.push('projeto_id = ?'); params.push(filter.projectId); }
        }
        if (filter.status) { clauses.push('status = ?'); params.push(filter.status); }
        if (filter.assignedTo) { clauses.push('atribuido_para = ?'); params.push(filter.assignedTo); }
        if (filter.createdBy) { clauses.push('criado_por = ?'); params.push(filter.createdBy); }
        if (!filter.includeArchived) clauses.push('arquivado = 0');

        const sql = `SELECT ${SELECT_COLUMNS} FROM tarefas WHERE ${clauses.join(' AND ')} ORDER BY ordem ASC`;
        const rows = await this.db.query<TaskRow>(sql, params);
        return rows.map(rowToTask);
    }

    async save(task: Task): Promise<void> {
        const p = task.toProps();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM tarefas WHERE id = ? LIMIT 1`,
            [p.id],
        );

        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO tarefas (
                    id, projeto_id, titulo, descricao, status, prioridade,
                    atribuido_para, criado_por, prazo, prazo_fim, tipo_prazo,
                    recorrencia, ordem, arquivado, id_formulario, suite_id,
                    demanda_id, setor_id, origem_tipo, origem_id,
                    criado_em, atualizado_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
                [
                    p.id, p.projetoId ?? null, p.titulo, p.descricao ?? null,
                    p.status, p.prioridade, p.atribuidoPara ?? null, p.criadoPor,
                    p.prazo ?? null, p.prazoFim ?? null, p.tipoPrazo ?? 'unico',
                    p.recorrencia ?? null, p.ordem, p.arquivado ? 1 : 0,
                    p.formRegistryId ?? null, p.tblSuiteId ?? null,
                    p.demandaId ?? null, p.setorId ?? null, p.origemTipo ?? null, p.origemId ?? null,
                    p.criadoEm ?? null,
                ],
            );
        } else {
            await this.db.execute(
                `UPDATE tarefas SET
                    projeto_id = ?, titulo = ?, descricao = ?, status = ?, prioridade = ?,
                    atribuido_para = ?, prazo = ?, prazo_fim = ?, tipo_prazo = ?,
                    recorrencia = ?, ordem = ?, arquivado = ?, id_formulario = ?, suite_id = ?,
                    demanda_id = ?, setor_id = ?, origem_tipo = ?, origem_id = ?,
                    atualizado_em = datetime('now')
                 WHERE id = ?`,
                [
                    p.projetoId ?? null, p.titulo, p.descricao ?? null, p.status, p.prioridade,
                    p.atribuidoPara ?? null, p.prazo ?? null, p.prazoFim ?? null, p.tipoPrazo ?? 'unico',
                    p.recorrencia ?? null, p.ordem, p.arquivado ? 1 : 0,
                    p.formRegistryId ?? null, p.tblSuiteId ?? null,
                    p.demandaId ?? null, p.setorId ?? null, p.origemTipo ?? null, p.origemId ?? null,
                    p.id,
                ],
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(
            `UPDATE tarefas SET deletado_em = datetime('now'), atualizado_em = datetime('now') WHERE id = ?`,
            [id],
        );
    }

    async nextOrder(projectId: string | null, status: TaskStatus): Promise<number> {
        const rows = projectId === null
            ? await this.db.query<{ max_ordem: number | null }>(
                `SELECT COALESCE(MAX(ordem), 0) AS max_ordem FROM tarefas
                 WHERE projeto_id IS NULL AND status = ? AND deletado_em IS NULL`,
                [status],
            )
            : await this.db.query<{ max_ordem: number | null }>(
                `SELECT COALESCE(MAX(ordem), 0) AS max_ordem FROM tarefas
                 WHERE projeto_id = ? AND status = ? AND deletado_em IS NULL`,
                [projectId, status],
            );
        const current = rows[0]?.max_ordem ?? 0;
        return current + 1000;
    }

    async findByDemandaId(demandaId: string): Promise<Task[]> {
        const rows = await this.db.query<TaskRow>(
            `SELECT ${SELECT_COLUMNS} FROM tarefas WHERE demanda_id = ? AND deletado_em IS NULL ORDER BY criado_em ASC`,
            [demandaId],
        );
        return rows.map(rowToTask);
    }

    async findByOrigin(origemTipo: string, origemId: string): Promise<Task[]> {
        const rows = await this.db.query<TaskRow>(
            `SELECT ${SELECT_COLUMNS} FROM tarefas WHERE origem_tipo = ? AND origem_id = ? AND deletado_em IS NULL ORDER BY criado_em ASC`,
            [origemTipo, origemId],
        );
        return rows.map(rowToTask);
    }

    async addComment(tarefaId: string, usuarioId: string, comentario: string): Promise<void> {
        await this.db.execute(
            `INSERT INTO tarefas_comentarios (id, tarefa_id, usuario_id, comentario, criado_em)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [uuidv7(), tarefaId, usuarioId, comentario],
        );
    }

    async findAssignedActiveForms(userId: string): Promise<string[]> {
        const rows = await this.db.query<{ id_formulario: string }>(
            `SELECT DISTINCT id_formulario FROM tarefas
             WHERE atribuido_para = ? AND deletado_em IS NULL AND arquivado = 0
               AND status NOT IN ('done', 'cancelled', 'archived')`,
            [userId],
        );
        return rows.map(r => r.id_formulario).filter(Boolean);
    }

    async getTaskHistory(taskId: string): Promise<import('../../../domain/task/TaskRepository').TaskHistoryEvent[]> {
        const rows = await this.db.query<{
            id: string | number;
            tarefa_id: string;
            tipo: string;
            descricao: string | null;
            usuario_id: string | null;
            usuario_nome: string | null;
            metadata: unknown;
            created_at: string;
        }>(
            `SELECT e.id, e.tarefa_id, e.tipo, e.descricao, e.usuario_id, u.nome AS usuario_nome, e.metadata, e.criado_em AS created_at
             FROM tarefas_eventos e
             LEFT JOIN usuarios u ON e.usuario_id = u.id
             WHERE e.tarefa_id = ?
             UNION ALL
             SELECT c.id, c.tarefa_id, 'comentario' AS tipo, c.comentario AS descricao, c.usuario_id, u.nome AS usuario_nome, NULL AS metadata, c.criado_em AS created_at
             FROM tarefas_comentarios c
             LEFT JOIN usuarios u ON c.usuario_id = u.id
             WHERE c.tarefa_id = ? AND NOT EXISTS (
                 SELECT 1 FROM tarefas_eventos ev WHERE ev.tarefa_id = c.tarefa_id AND ev.tipo = 'comentario' AND ev.descricao = c.comentario AND ev.criado_em = c.criado_em
             )
             UNION ALL
             SELECT a.id, a.tarefa_id, 'anexo' AS tipo, a.nome_arquivo AS descricao, a.usuario_id, u.nome AS usuario_nome, NULL AS metadata, a.criado_em AS created_at
             FROM tarefas_anexos a
             LEFT JOIN usuarios u ON a.usuario_id = u.id
             WHERE a.tarefa_id = ? AND NOT EXISTS (
                 SELECT 1 FROM tarefas_eventos ev WHERE ev.tarefa_id = a.tarefa_id AND ev.tipo = 'anexo' AND ev.criado_em = a.criado_em
             )
             UNION ALL
             SELECT s.id_pacote, ? AS tarefa_id, 'formulario' AS tipo, COALESCE(s.tipo_recurso, 'Formulário') AS descricao, s.id_proprietario, u.nome AS usuario_nome, NULL AS metadata, s.criado_em AS created_at
             FROM pacotes s
             LEFT JOIN usuarios u ON s.id_proprietario = u.id
             WHERE s.id_pacote IN (SELECT suite_id FROM tarefas WHERE id = ?) AND s.atual = 1
               AND NOT EXISTS (
                   SELECT 1 FROM tarefas_eventos ev JOIN tarefas t ON t.id = ev.tarefa_id WHERE t.suite_id = s.id_pacote AND ev.tipo = 'formulario' AND ev.criado_em = s.criado_em
               )
             ORDER BY created_at DESC`,
            [taskId, taskId, taskId, taskId, taskId],
        );
        return rows.map(r => ({
            id: String(r.id),
            tarefaId: r.tarefa_id,
            tipo: r.tipo,
            descricao: r.descricao ?? null,
            usuarioId: r.usuario_id ?? null,
            usuarioNome: r.usuario_nome ?? null,
            metadata: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata as Record<string, unknown>) : null,
            createdAt: r.created_at,
        }));
    }
}
