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
        ativo: row.ativo,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
    });
}

export class SqliteViewRegistryRepository implements ViewRegistryRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<ViewRegistry | null> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, module_type, ativo, criado_em, atualizado_em
             FROM view_registry WHERE id = ? AND ativo = 1 LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToView(rows[0]) : null;
    }

    async findByModuleType(moduleType: string): Promise<ViewRegistry[]> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, module_type, ativo, criado_em, atualizado_em
             FROM view_registry WHERE module_type = ? AND ativo = 1 ORDER BY titulo`,
            [moduleType],
        );
        return rows.map(rowToView);
    }

    async findByPerfil(perfil: string): Promise<ViewRegistry[]> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, module_type, ativo, criado_em, atualizado_em
             FROM view_registry WHERE perfis LIKE ? AND ativo = 1 ORDER BY titulo`,
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
            `SELECT id, titulo, perfis, layout, widgets, module_type, ativo, criado_em, atualizado_em
             FROM view_registry WHERE ativo = 1 ORDER BY titulo`,
        );
        return rows.map(rowToView);
    }

    async findAll(): Promise<ViewRegistry[]> {
        const rows = await this.db.query<ViewRow>(
            `SELECT id, titulo, perfis, layout, widgets, module_type, ativo, criado_em, atualizado_em
             FROM view_registry ORDER BY titulo`,
        );
        return rows.map(rowToView);
    }

    async save(view: ViewRegistry): Promise<void> {
        const row = view.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM view_registry WHERE id = ? LIMIT 1`,
            [row.id],
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO view_registry (id, titulo, perfis, layout, widgets, module_type, ativo, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
                [row.id, row.titulo, row.perfis, row.layout, row.widgets, row.module_type, row.ativo, row.criado_em],
            );
        } else {
            await this.db.execute(
                `UPDATE view_registry SET titulo = ?, perfis = ?, layout = ?, widgets = ?, module_type = ?, ativo = ?, atualizado_em = datetime('now') WHERE id = ?`,
                [row.titulo, row.perfis, row.layout, row.widgets, row.module_type, row.ativo, row.id],
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM view_registry WHERE id = ?`, [id]);
    }
}