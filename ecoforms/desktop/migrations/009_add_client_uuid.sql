-- Migration 009: Add UUID column to pjuridicas
-- Replaces Date.now() timestamp with crypto.randomUUID() (v4) for Client identity
-- Syncs with Task/Demanda ID strategy
--
-- Run: embed at application startup via ensure-schema logic

-- 1. Add uuid TEXT column
ALTER TABLE pjuridicas ADD COLUMN uuid TEXT;

-- 2. Backfill UUIDs for existing rows (approximate v4 format in SQLite)
UPDATE pjuridicas SET uuid =
  lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-' ||
    '4' || substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', (abs(random()) % 4) + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
  )
WHERE uuid IS NULL;

-- 3. Unique index on uuid for lookup performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_pjuridicas_uuid ON pjuridicas(uuid);
