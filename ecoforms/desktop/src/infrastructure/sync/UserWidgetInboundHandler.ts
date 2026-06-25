import type { InboundService } from './InboundService';
import type { SqlitePort } from '../../application/ports/SqlitePort';
import type { EventEnvelope } from './EventEnvelope';

export function registerUserWidgetHandlers(inbound: InboundService, db: SqlitePort): void {
    inbound.on('user_widget.created', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        if (!d?.id) return;
        await db.execute(
            `INSERT OR REPLACE INTO instancias_widgets_usuario
             (id, id_usuario, dashboard_id, widget_type, data_source, display_config,
              position_x, position_y, position_w, position_h, position_order,
              criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
            [d.id, d.user_id, d.dashboard_id, d.widget_type, d.data_source, d.display_config,
             d.position_x ?? 0, d.position_y ?? 0, d.position_w ?? 6, d.position_h ?? 1, d.position_order ?? 0, env.time],
        );
    });

    inbound.on('user_widget.updated', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        if (!d?.id) return;
        await db.execute(
            `UPDATE instancias_widgets_usuario SET widget_type = ?, data_source = ?, display_config = ?,
             position_x = ?, position_y = ?, position_w = ?, position_h = ?, position_order = ?,
             atualizado_em = datetime('now') WHERE id = ?`,
            [d.widget_type, d.data_source, d.display_config,
             d.position_x ?? 0, d.position_y ?? 0, d.position_w ?? 6, d.position_h ?? 1, d.position_order ?? 0, d.id],
        );
    });

    inbound.on('user_widget.deleted', async (env: EventEnvelope) => {
        const d = env.data as Record<string, unknown>;
        const id = d?.id ?? env.aggregate.id;
        if (!id) return;
        await db.execute(`DELETE FROM instancias_widgets_usuario WHERE id = ?`, [id]);
    });
}
