import type { ProjectRepository, ProjectWithMetrics, ProjectPatch } from '../../../domain/project/ProjectRepository';
import type { Interessado, ProjetoStatus } from '@/types';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import { isValidProjectTransition } from '../../../domain/project/ProjectStatus';
import { uuidv7 } from 'ecoforms-core';

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
}

export class SqliteProjectRepository implements ProjectRepository {
    constructor(private readonly db: SqlitePort) {}

    async findAllWithMetrics(userId: string, isAdminOrManager: boolean): Promise<ProjectWithMetrics[]> {
        const filter = isAdminOrManager
            ? '1=1'
            : `(p.criado_por = ? OR EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = p.id AND pi.usuario_id = ?))`;
        const params = isAdminOrManager ? [] : [userId, userId];

        const rows = await this.db.query<Record<string, unknown>>(
            `SELECT
                p.*,
                u.nome AS criado_por_nome,
                resp.nome AS responsavel_nome,
                COALESCE((
                    SELECT json_group_array(json_object('usuario_id', usuario_id, 'permissao', permissao, 'contexto', 'projeto'))
                    FROM projetos_interessados
                    WHERE projeto_id = p.id
                ), '[]') AS interessados_json,
                CASE
                    WHEN p.criado_por = ? THEN 'dono'
                    WHEN EXISTS (SELECT 1 FROM projetos_interessados pi WHERE pi.projeto_id = p.id AND pi.usuario_id = ? AND pi.permissao = 'edicao') THEN 'edicao'
                    ELSE 'leitura'
                END AS meu_nivel_acesso,
                COALESCE(SUM(CASE WHEN t.status = 'a_fazer'       AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_a_fazer,
                COALESCE(SUM(CASE WHEN t.status = 'em_progresso'  AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_em_progresso,
                COALESCE(SUM(CASE WHEN t.status = 'concluido'     AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_concluido,
                COALESCE(COUNT(CASE WHEN t.arquivado = 0 THEN 1 END), 0) AS total_tarefas,
                COALESCE(SUM(CASE WHEN t.prioridade = 'baixa'  AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_baixa,
                COALESCE(SUM(CASE WHEN t.prioridade = 'media'  AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_media,
                COALESCE(SUM(CASE WHEN t.prioridade = 'alta'   AND t.arquivado = 0 THEN 1 ELSE 0 END), 0) AS cnt_alta
            FROM projetos p
            LEFT JOIN usuarios u ON u.id = p.criado_por
            LEFT JOIN usuarios resp ON resp.id = p.responsavel_id
            LEFT JOIN tarefas t ON t.projeto_id = p.id
            WHERE p.arquivado_em IS NULL AND ${filter}
            GROUP BY p.id
            ORDER BY p.criado_em DESC`,
            [userId, userId, ...params],
        );

        return rows.map(row => ({
            ...(row as unknown as ProjectWithMetrics),
            id: String(row.id),
            nome: String(row.nome),
            cor: String(row.cor),
            arquivado: row.arquivado_em != null,
            status: (row.status as ProjetoStatus) ?? 'ativo',
            data_inicio: (row.data_inicio as string | null) ?? null,
            data_fim: (row.data_fim as string | null) ?? null,
            responsavel_id: (row.responsavel_id as string | null) ?? null,
            responsavel_nome: (row.responsavel_nome as string | null) ?? null,
            interessados: safeJsonParse(row.interessados_json as string | null, []) as Interessado[],
            meu_nivel_acesso: (row.meu_nivel_acesso as 'dono' | 'leitura' | 'edicao') ?? 'leitura',
            cnt_a_fazer: Number(row.cnt_a_fazer ?? 0),
            cnt_em_progresso: Number(row.cnt_em_progresso ?? 0),
            cnt_concluido: Number(row.cnt_concluido ?? 0),
            total_tarefas: Number(row.total_tarefas ?? 0),
            cnt_baixa: Number(row.cnt_baixa ?? 0),
            cnt_media: Number(row.cnt_media ?? 0),
            cnt_alta: Number(row.cnt_alta ?? 0),
        }));
    }

    async createProject(
        nome: string,
        descricao: string,
        cor: string,
        userId: string,
        interessados: Interessado[],
        extra: { status?: ProjetoStatus; data_inicio?: string | null; data_fim?: string | null; responsavel_id?: string | null; setor_id?: string | null }
    ): Promise<string> {
        const id = uuidv7();
        await this.db.execute(
            `INSERT INTO projetos (id, nome, descricao, cor, criado_por, status, data_inicio, data_fim, responsavel_id, setor_id, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [id, nome.trim(), descricao.trim(), cor, userId, extra.status ?? 'ativo', extra.data_inicio ?? null, extra.data_fim ?? null, extra.responsavel_id ?? null, extra.setor_id ?? null]
        );
        for (const i of interessados) {
            await this.db.execute(
                `INSERT INTO projetos_interessados (projeto_id, usuario_id, permissao) VALUES (?, ?, ?)`,
                [id, i.usuario_id, i.permissao]
            );
        }
        return id;
    }

    async updateProject(projectId: string, patch: ProjectPatch): Promise<void> {
        const fields: string[] = [];
        const params: (string | number | null)[] = [];
        if (patch.nome !== undefined) { fields.push('nome = ?'); params.push(patch.nome.trim()); }
        if (patch.descricao !== undefined) { fields.push('descricao = ?'); params.push(patch.descricao.trim()); }
        if (patch.cor !== undefined) { fields.push('cor = ?'); params.push(patch.cor); }
        if (patch.status !== undefined) {
            const current = await this.getProjectStatus(projectId);
            if (current && !isValidProjectTransition(current, patch.status)) {
                throw new Error(`Transição inválida: ${current} → ${patch.status}`);
            }
            fields.push('status = ?'); params.push(patch.status);
        }
        if (patch.data_inicio !== undefined) { fields.push('data_inicio = ?'); params.push(patch.data_inicio ?? null); }
        if (patch.data_fim !== undefined) { fields.push('data_fim = ?'); params.push(patch.data_fim ?? null); }
        if (patch.responsavel_id !== undefined) { fields.push('responsavel_id = ?'); params.push(patch.responsavel_id ?? null); }
        if (fields.length > 0) {
            fields.push("atualizado_em = datetime('now')");
            params.push(projectId);
            await this.db.execute(`UPDATE projetos SET ${fields.join(', ')} WHERE id = ?`, params);
        }
        if (patch.interessados !== undefined) {
            await this.db.execute(`DELETE FROM projetos_interessados WHERE projeto_id = ?`, [projectId]);
            for (const i of patch.interessados) {
                await this.db.execute(
                    `INSERT INTO projetos_interessados (projeto_id, usuario_id, permissao) VALUES (?, ?, ?)`,
                    [projectId, i.usuario_id, i.permissao]
                );
            }
        }
    }

    async archiveProject(projectId: string, arquivadoPor: string): Promise<void> {
        await this.db.execute(
            `UPDATE projetos SET arquivado_em = datetime('now'), arquivado_por = ?, atualizado_em = datetime('now') WHERE id = ?`,
            [arquivadoPor, projectId]
        );
    }

    async unarchiveProject(projectId: string): Promise<void> {
        await this.db.execute(
            `UPDATE projetos SET arquivado_em = NULL, arquivado_por = NULL, atualizado_em = datetime('now') WHERE id = ?`,
            [projectId]
        );
    }

    private async getProjectStatus(projectId: string): Promise<ProjetoStatus | null> {
        const rows = await this.db.query<{ status: string }>(
            `SELECT status FROM projetos WHERE id = ? LIMIT 1`,
            [projectId],
        );
        return rows[0]?.status as ProjetoStatus ?? null;
    }
}
