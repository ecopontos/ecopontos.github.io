import { UserWidgetInstance } from '../../../domain/widget/UserWidgetInstance';
import type { UserWidgetInstanceRepository } from '../../../domain/widget/UserWidgetInstanceRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface WidgetRow {
    id: string;
    user_id: string;
    dashboard_id: string;
    widget_type: string;
    data_source: string;
    display_config: string;
    position_x: number;
    position_y: number;
    position_w: number;
    position_h: number;
    position_order: number;
    criado_em: string;
    atualizado_em: string;
}

function rowToWidget(row: WidgetRow): UserWidgetInstance {
    return UserWidgetInstance.fromRow({
        id: row.id,
        user_id: row.user_id,
        dashboard_id: row.dashboard_id,
        widget_type: row.widget_type,
        data_source: row.data_source,
        display_config: row.display_config,
        position_x: row.position_x,
        position_y: row.position_y,
        position_w: row.position_w,
        position_h: row.position_h,
        position_order: row.position_order,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
    });
}

// A coluna física é `id_usuario` (schema pt-br em ensure-columns.ts). O SELECT a expõe
// como `user_id` para casar com WidgetRow/UserWidgetInstance; o INSERT usa o nome físico.
const SELECT_COLS = `id, id_usuario AS user_id, dashboard_id, widget_type, data_source, display_config, position_x, position_y, position_w, position_h, position_order, criado_em, atualizado_em`;
const INSERT_COLS = `id, id_usuario, dashboard_id, widget_type, data_source, display_config, position_x, position_y, position_w, position_h, position_order, criado_em, atualizado_em`;

export class SqliteUserWidgetInstanceRepository implements UserWidgetInstanceRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<UserWidgetInstance | null> {
        const rows = await this.db.query<WidgetRow>(
            `SELECT ${SELECT_COLS} FROM instancias_widgets_usuario WHERE id = ? LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToWidget(rows[0]) : null;
    }

    async findByDashboardId(dashboardId: string): Promise<UserWidgetInstance[]> {
        const rows = await this.db.query<WidgetRow>(
            `SELECT ${SELECT_COLS} FROM instancias_widgets_usuario WHERE dashboard_id = ? ORDER BY position_y, position_x`,
            [dashboardId],
        );
        return rows.map(rowToWidget);
    }

    async findByUserId(userId: string): Promise<UserWidgetInstance[]> {
        const rows = await this.db.query<WidgetRow>(
            `SELECT ${SELECT_COLS} FROM instancias_widgets_usuario WHERE id_usuario = ? ORDER BY criado_em DESC`,
            [userId],
        );
        return rows.map(rowToWidget);
    }

    async save(widget: UserWidgetInstance): Promise<void> {
        const row = widget.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM instancias_widgets_usuario WHERE id = ? LIMIT 1`,
            [row.id],
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO instancias_widgets_usuario (${INSERT_COLS})
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
                [row.id, row.user_id, row.dashboard_id, row.widget_type, row.data_source, row.display_config,
                 row.position_x, row.position_y, row.position_w, row.position_h, row.position_order, row.criado_em],
            );
        } else {
            await this.db.execute(
                `UPDATE instancias_widgets_usuario SET widget_type = ?, data_source = ?, display_config = ?,
                 position_x = ?, position_y = ?, position_w = ?, position_h = ?, position_order = ?,
                 atualizado_em = datetime('now') WHERE id = ?`,
                [row.widget_type, row.data_source, row.display_config,
                 row.position_x, row.position_y, row.position_w, row.position_h, row.position_order, row.id],
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM instancias_widgets_usuario WHERE id = ?`, [id]);
    }

    async updatePositions(updates: Array<{ id: string; x: number; y: number; w: number; h: number; order: number }>): Promise<void> {
        await this.db.transaction(async () => {
            for (const u of updates) {
                await this.db.execute(
                    `UPDATE instancias_widgets_usuario SET position_x = ?, position_y = ?, position_w = ?,
                     position_h = ?, position_order = ?, atualizado_em = datetime('now') WHERE id = ?`,
                    [u.x, u.y, u.w, u.h, u.order, u.id],
                );
            }
        });
    }
}
