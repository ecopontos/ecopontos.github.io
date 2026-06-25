BEGIN TRANSACTION;

-- Create audit table for task reassignments (SQLite version)
CREATE TABLE IF NOT EXISTS tbl_tasks_audit (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  actor_id TEXT,
  actor_perfil TEXT,
  previous_assignee TEXT,
  new_assignee TEXT,
  changed_at TEXT DEFAULT (datetime('now')),
  reason TEXT,
  request_source TEXT
);

-- Remove old trigger if exists
DROP TRIGGER IF EXISTS trg_tasks_audit_after_update;

-- Trigger to record changes when atribuido_para is updated
CREATE TRIGGER trg_tasks_audit_after_update
AFTER UPDATE OF atribuido_para ON tarefas
FOR EACH ROW
BEGIN
  INSERT INTO tbl_tasks_audit(
    id, task_id, actor_id, actor_perfil, previous_assignee, new_assignee, changed_at, request_source
  ) VALUES (
    (strftime('%Y%m%d%H%M%f','now') || '-' || substr(hex(randomblob(4)),1,8)),
    COALESCE(NEW.id, OLD.id),
    NULL,
    NULL,
    OLD.atribuido_para,
    NEW.atribuido_para,
    datetime('now'),
    'local'
  );
END;

-- Seed an example 'encarregado' user (development only)
INSERT OR REPLACE INTO usuarios (id, username, nome, perfil, password_hash, ativo, criado_em)
VALUES (
  '00000000-0000-0000-0000-000000enc1',
  'encarregado1',
  'Encarregado de Teste',
  'encarregado',
  'changeme',
  1,
  datetime('now')
);

COMMIT;