import { ModuleVisualView } from '../../../domain/visual/ModuleVisualView';
import type { ModuleVisualViewRepository } from '../../../domain/visual/ModuleVisualViewRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface VisualViewRow {
    id: string;
    module_id: string;
    visual_type: string;
    name: string;
    config: string;
    is_default: number;
    user_id: string | null;
    parent_view_id: string | null;
    sync_status: string;
    position: number;
    criado_em: string;
    atualizado_em: string;
}

function rowToView(row: VisualViewRow): ModuleVisualView {
    return ModuleVisualView.fromRow({
        id: row.id,
        module_id: row.module_id,
        visual_type: row.visual_type,
        name: row.name,
        config: row.config,
        is_default: row.is_default === 1,
        user_id: row.user_id,
        parent_view_id: row.parent_view_id,
        sync_status: row.sync_status,
        position: row.position,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
    });
}

const COLS = `id, module_id, visual_type, name, config, is_default, user_id, parent_view_id, sync_status, position, criado_em, atualizado_em`;

export class SqliteModuleVisualViewRepository implements ModuleVisualViewRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<ModuleVisualView | null> {
        const rows = await this.db.query<VisualViewRow>(
            `SELECT ${COLS} FROM visuais_modulos WHERE id = ? LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToView(rows[0]) : null;
    }

    async findByModuleId(moduleId: string): Promise<ModuleVisualView[]> {
        const rows = await this.db.query<VisualViewRow>(
            `SELECT ${COLS} FROM visuais_modulos WHERE module_id = ? ORDER BY position`,
            [moduleId],
        );
        return rows.map(rowToView);
    }

    async findByModuleIdAndType(moduleId: string, visualType: string): Promise<ModuleVisualView[]> {
        const rows = await this.db.query<VisualViewRow>(
            `SELECT ${COLS} FROM visuais_modulos WHERE module_id = ? AND visual_type = ? ORDER BY position`,
            [moduleId, visualType],
        );
        return rows.map(rowToView);
    }

    async findDefaultsByModuleId(moduleId: string): Promise<ModuleVisualView[]> {
        const rows = await this.db.query<VisualViewRow>(
            `SELECT ${COLS} FROM visuais_modulos WHERE module_id = ? AND is_default = 1 ORDER BY position`,
            [moduleId],
        );
        return rows.map(rowToView);
    }

    async findPersonalByUserId(moduleId: string, userId: string): Promise<ModuleVisualView[]> {
        const rows = await this.db.query<VisualViewRow>(
            `SELECT ${COLS} FROM visuais_modulos WHERE module_id = ? AND user_id = ? ORDER BY position`,
            [moduleId, userId],
        );
        return rows.map(rowToView);
    }

    async findGlobalViews(moduleId: string): Promise<ModuleVisualView[]> {
        const rows = await this.db.query<VisualViewRow>(
            `SELECT ${COLS} FROM visuais_modulos WHERE module_id = ? AND user_id IS NULL ORDER BY position`,
            [moduleId],
        );
        return rows.map(rowToView);
    }

    async findByParentId(parentId: string): Promise<ModuleVisualView[]> {
        const rows = await this.db.query<VisualViewRow>(
            `SELECT ${COLS} FROM visuais_modulos WHERE parent_view_id = ? ORDER BY position`,
            [parentId],
        );
        return rows.map(rowToView);
    }

    async findAll(): Promise<ModuleVisualView[]> {
        const rows = await this.db.query<VisualViewRow>(
            `SELECT ${COLS} FROM visuais_modulos ORDER BY module_id, visual_type, position`,
        );
        return rows.map(rowToView);
    }

    async save(view: ModuleVisualView): Promise<void> {
        const row = view.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM visuais_modulos WHERE id = ? LIMIT 1`,
            [row.id],
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO visuais_modulos (${COLS})
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
                [row.id, row.module_id, row.visual_type, row.name, row.config,
                 row.is_default, row.user_id, row.parent_view_id, row.sync_status, row.position, row.criado_em],
            );
        } else {
            await this.db.execute(
                `UPDATE visuais_modulos SET name = ?, config = ?, is_default = ?, user_id = ?,
                 parent_view_id = ?, sync_status = ?, position = ?, atualizado_em = datetime('now')
                 WHERE id = ?`,
                [row.name, row.config, row.is_default, row.user_id, row.parent_view_id, row.sync_status, row.position, row.id],
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM visuais_modulos WHERE id = ?`, [id]);
    }

    async setDefault(viewId: string, moduleId: string, visualType: string): Promise<void> {
        const statements = [
            { sql: "UPDATE visuais_modulos SET is_default = 0, atualizado_em = datetime('now') WHERE module_id = ? AND visual_type = ?", params: [moduleId, visualType] },
            { sql: "UPDATE visuais_modulos SET is_default = 1, atualizado_em = datetime('now') WHERE id = ?", params: [viewId] },
        ];

        if (this.db.transactionBatch) {
            await this.db.transactionBatch(statements);
        } else {
            await this.db.transaction(async (tx) => {
                for (const statement of statements) {
                    await tx.execute(statement.sql, statement.params);
                }
            });
        }
    }
}
