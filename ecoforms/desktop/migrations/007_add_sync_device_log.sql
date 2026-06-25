-- Migration 007: Tabelas de suporte ao sync event-driven
-- Pré-requisito para EventBus, TransportService e InboundService

CREATE TABLE IF NOT EXISTS sync_event_queue (
    id              TEXT PRIMARY KEY,
    type            TEXT NOT NULL,
    payload         TEXT NOT NULL,
    aggregate_type  TEXT,
    aggregate_id    TEXT,
    correlation_id  TEXT,
    causation_id    TEXT,
    seq             INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    attempts        INTEGER NOT NULL DEFAULT 0,
    sent_at         TEXT,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_event_queue_status ON sync_event_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_event_queue_seq ON sync_event_queue(seq);

CREATE TABLE IF NOT EXISTS sync_device_log (
    device_id   TEXT NOT NULL,
    seq         INTEGER NOT NULL,
    event_id    TEXT NOT NULL,
    pushed_at   TEXT,
    acked       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (device_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_sync_device_log_acked ON sync_device_log(device_id, acked);
