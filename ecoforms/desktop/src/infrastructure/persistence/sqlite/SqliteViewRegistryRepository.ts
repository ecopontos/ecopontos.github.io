import { ViewRegistry } from '../../../domain/view/ViewRegistry';
import type { ViewRegistryRepository } from '../../../domain/view/ViewRegistryRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface ViewRow {
    id: string;
    titulo: string;
    perfis: string;
    layout: string;
    widgets: string;
    module_type: string | null;
    user_id: string | null;
    is_template: number;
    ativo: number;
    criado_em: string | null;
    atualizado_em: string | null;
}

function rowToView(row: ViewRow): ViewRegistry {
    return ViewRegistry.fromRow({
        id: row.id,
        titulo: row.titulo,
        perfis: row.perfis,
        layout: row.layout,
        widgets: row.widgets,
        module_type: row.module_type,
        user_id: row.user_id,
        is_template: row.is_template,
        ativo: row.ativo,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
    });
}

export class SqliteViewRegistryRepository implements ViewRegistryRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<ViewRegistry | null> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, tipo_modulo AS module_type, id_usuario AS user_id, modelo AS is_template, ativo, criado_em, atualizado_em
             FROM registro_visualizacoes WHERE id = ? AND ativo = 1 LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToView(rows[0]) : null;
    }

    async findByModuleType(moduleType: string): Promise<ViewRegistry[]> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, tipo_modulo AS module_type, id_usuario AS user_id, modelo AS is_template, ativo, criado_em, atualizado_em
             FROM registro_visualizacoes WHERE tipo_modulo = ? AND ativo = 1 ORDER BY titulo`,
            [moduleType],
        );
        return rows.map(rowToView);
    }

    async findByPerfil(perfil: string): Promise<ViewRegistry[]> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, tipo_modulo AS module_type, id_usuario AS user_id, modelo AS is_template, ativo, criado_em, atualizado_em
             FROM registro_visualizacoes WHERE perfis LIKE ? AND ativo = 1 ORDER BY titulo`,
            [`%"${perfil}"%`],
        );
        return rows.filter((row) => {
            try {
                const perfis: string[] = JSON.parse(row.perfis);
                return perfis.includes(perfil);
            } catch {
                return false;
            }
        }).map(rowToView);
    }

    async findActive(): Promise<ViewRegistry[]> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, tipo_modulo AS module_type, id_usuario AS user_id, modelo AS is_template, ativo, criado_em, atualizado_em
             FROM registro_visualizacoes WHERE ativo = 1 ORDER BY titulo`,
        );
        return rows.map(rowToView);
    }

    async findAll(): Promise<ViewRegistry[]> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, tipo_modulo AS module_type, id_usuario AS user_id, modelo AS is_template, ativo, criado_em, atualizado_em
             FROM registro_visualizacoes ORDER BY titulo`,
        );
        return rows.map(rowToView);
    }

    async save(view: ViewRegistry): Promise<void> {
        const row = view.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM registro_visualizacoes WHERE id = ? LIMIT 1`,
            [row.id],
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO registro_visualizacoes (id, titulo, perfis, layout, widgets, tipo_modulo, id_usuario, modelo, ativo, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
                [row.id, row.titulo, row.perfis, row.layout, row.widgets, row.module_type, row.user_id, row.is_template, row.ativo, row.criado_em],
            );
        } else {
            await this.db.execute(
                `UPDATE registro_visualizacoes SET titulo = ?, perfis = ?, layout = ?, widgets = ?, tipo_modulo = ?, id_usuario = ?, modelo = ?, ativo = ?, atualizado_em = datetime('now') WHERE id = ?`,
                [row.titulo, row.perfis, row.layout, row.widgets, row.module_type, row.user_id, row.is_template, row.ativo, row.id],
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM registro_visualizacoes WHERE id = ?`, [id]);
    }
}
