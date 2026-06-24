-- Migration: ADR-010 Module Registry
-- Cria tabelas para registro declarativo de módulos operacionais

CREATE TABLE IF NOT EXISTS module_registry (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  entity_type   TEXT NOT NULL UNIQUE,
  icon          TEXT,
  color         TEXT,
  prefix        TEXT NOT NULL UNIQUE,
  ordem         INTEGER NOT NULL DEFAULT 999,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  version       INTEGER NOT NULL DEFAULT 1,
  config        TEXT NOT NULL DEFAULT '{}',
  suite_config  TEXT,
  criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
  publicado_em  TEXT
);

CREATE TABLE IF NOT EXISTS module_permissions (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  module_id  TEXT NOT NULL REFERENCES module_registry(id) ON DELETE CASCADE,
  profile    TEXT NOT NULL,
  can_view   INTEGER NOT NULL DEFAULT 0,
  can_create INTEGER NOT NULL DEFAULT 0,
  can_edit   INTEGER NOT NULL DEFAULT 0,
  can_approve INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  UNIQUE (module_id, profile),
  CHECK (can_create = 0 OR can_view = 1)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_module_registry_status ON module_registry(status);
CREATE INDEX IF NOT EXISTS idx_module_registry_entity_type ON module_registry(entity_type);
CREATE INDEX IF NOT EXISTS idx_module_permissions_module_id ON module_permissions(module_id);
