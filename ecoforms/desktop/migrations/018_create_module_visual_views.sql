-- Migration 018: module_visual_views table — ADR-010
-- Visual widgets for Module Builder (table, chart, kanban, timeline, summary)
-- with support for global views, personal copies, and sync tracking.

CREATE TABLE IF NOT EXISTS module_visual_views (
    id              TEXT PRIMARY KEY,
    module_id       TEXT NOT NULL REFERENCES module_registry(id) ON DELETE CASCADE,
    visual_type     TEXT NOT NULL CHECK (visual_type IN ('table','chart','kanban','timeline','summary')),
    name            TEXT NOT NULL,
    config          TEXT NOT NULL DEFAULT '{}',
    is_default      INTEGER NOT NULL DEFAULT 0,
    user_id         TEXT,
    parent_view_id  TEXT REFERENCES module_visual_views(id) ON DELETE SET NULL,
    sync_status     TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced','outdated','conflict')),
    position        INTEGER NOT NULL DEFAULT 0,
    criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(module_id, visual_type, name, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mvv_module     ON module_visual_views(module_id);
CREATE INDEX IF NOT EXISTS idx_mvv_parent     ON module_visual_views(parent_view_id);
CREATE INDEX IF NOT EXISTS idx_mvv_user       ON module_visual_views(user_id);
