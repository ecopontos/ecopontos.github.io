-- Migration 019: user_widget_instances + view_registry extensions — ADR-011
-- Self-service analytics: user-created widgets composable into personal dashboards.

CREATE TABLE IF NOT EXISTS user_widget_instances (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    dashboard_id    TEXT NOT NULL REFERENCES view_registry(id) ON DELETE CASCADE,
    widget_type     TEXT NOT NULL CHECK (widget_type IN (
                        'kpi_card','bar_chart','pie_chart','line_chart',
                        'area_chart','table','recent_activity'
                    )),
    data_source     TEXT NOT NULL DEFAULT '{}',
    display_config  TEXT NOT NULL DEFAULT '{}',
    position_x      INTEGER NOT NULL DEFAULT 0,
    position_y      INTEGER NOT NULL DEFAULT 0,
    position_w      INTEGER NOT NULL DEFAULT 6,
    position_h      INTEGER NOT NULL DEFAULT 1,
    position_order  INTEGER NOT NULL DEFAULT 0,
    criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_uwi_dashboard ON user_widget_instances(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_uwi_user     ON user_widget_instances(user_id);

ALTER TABLE view_registry ADD COLUMN user_id     TEXT;
ALTER TABLE view_registry ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_view_registry_user ON view_registry(user_id);
