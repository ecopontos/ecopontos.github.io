-- Migration 011: Key escrow table for sync_salt rotation (ADR-011)
-- Stores historical sync salts encrypted, enabling key rotation and recovery

CREATE TABLE IF NOT EXISTS historico_sal_sync (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    salt_encrypted TEXT NOT NULL,
    salt_hash TEXT NOT NULL,
    replaced_at TEXT NOT NULL DEFAULT (datetime('now')),
    replaced_by TEXT NOT NULL,
    reason TEXT,
    FOREIGN KEY (user_id) REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_historico_sal_sync_usuario ON historico_sal_sync(user_id, replaced_at DESC);
