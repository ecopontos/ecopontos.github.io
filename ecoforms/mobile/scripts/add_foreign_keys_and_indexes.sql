-- ============================================================
-- SCRIPT: Adicionar Foreign Keys e Índices ao EcoForms
-- Compatível com: Supabase (PostgreSQL) e SQLite local
-- Data: 2026-04-27
-- ============================================================

-- IMPORTANTE: No SQLite, foreign keys devem ser habilitadas PRIMEIRO:
-- PRAGMA foreign_keys = ON;

-- ============================================================
-- PARTE 1: ÍNDICES PARA PERFORMANCE
-- ============================================================

-- activities
CREATE INDEX IF NOT EXISTS idx_tbl_activities_form_id ON activities(form_id);
CREATE INDEX IF NOT EXISTS idx_tbl_activities_assignee_id ON activities(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tbl_activities_created_by ON activities(created_by);
CREATE INDEX IF NOT EXISTS idx_tbl_activities_submission_id ON activities(submission_id);
CREATE INDEX IF NOT EXISTS idx_tbl_activities_status ON activities(status);

-- tarefas
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_projeto_id ON tarefas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_criado_por ON tarefas(criado_por);
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_atribuido_para ON tarefas(atribuido_para);
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_form_registry_id ON tarefas(form_registry_id);
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_tbl_suite_id ON tarefas(tbl_suite_id);
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_status ON tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_arquivado ON tarefas(arquivado);

-- tarefas_anexos
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_anexos_tarefa_id ON tarefas_anexos(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_anexos_usuario_id ON tarefas_anexos(usuario_id);

-- tarefas_comentarios
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_comentarios_tarefa_id ON tarefas_comentarios(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_tbl_tarefas_comentarios_usuario_id ON tarefas_comentarios(usuario_id);

-- projetos
CREATE INDEX IF NOT EXISTS idx_tbl_projetos_criado_por ON projetos(criado_por);
CREATE INDEX IF NOT EXISTS idx_tbl_projetos_arquivado ON projetos(arquivado);

-- suite
CREATE INDEX IF NOT EXISTS idx_tbl_suite_user_id ON suite(user_id);
CREATE INDEX IF NOT EXISTS idx_tbl_suite_activity_id ON suite(activity_id);
CREATE INDEX IF NOT EXISTS idx_tbl_suite_revisor_id ON suite(revisor_id);
CREATE INDEX IF NOT EXISTS idx_tbl_suite_status ON suite(status);
CREATE INDEX IF NOT EXISTS idx_tbl_suite_tipo_form ON suite(tipo_form);

-- suite_historico
CREATE INDEX IF NOT EXISTS idx_tbl_suite_historico_registro_id ON suite_historico(registro_id);
CREATE INDEX IF NOT EXISTS idx_tbl_suite_historico_alterado_por ON suite_historico(alterado_por);

-- form_registry
CREATE INDEX IF NOT EXISTS idx_form_registry_slug ON form_registry(slug);
CREATE INDEX IF NOT EXISTS idx_form_registry_tipo_form ON form_registry(tipo_form);
CREATE INDEX IF NOT EXISTS idx_form_registry_situacao ON form_registry(situacao);
CREATE INDEX IF NOT EXISTS idx_form_registry_ativo ON form_registry(ativo);

-- form_field_registry
CREATE INDEX IF NOT EXISTS idx_form_field_registry_form_id ON form_field_registry(form_id);

-- tbl_tasks_audit
CREATE INDEX IF NOT EXISTS idx_tbl_tasks_audit_task_id ON tbl_tasks_audit(task_id);
CREATE INDEX IF NOT EXISTS idx_tbl_tasks_audit_actor_id ON tbl_tasks_audit(actor_id);

-- ============================================================
-- PARTE 2: FOREIGN KEYS (PostgreSQL/Supabase)
-- Execute apenas no Supabase, NÃO no SQLite
-- ============================================================

/*
-- Descomente este bloco para executar no Supabase

-- activities → form_registry
ALTER TABLE activities
  ADD CONSTRAINT fk_activities_form
  FOREIGN KEY (form_id) REFERENCES form_registry(form_id)
  ON DELETE CASCADE;

-- activities → usuarios (assignee)
ALTER TABLE activities
  ADD CONSTRAINT fk_activities_assignee
  FOREIGN KEY (assignee_id) REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- activities → usuarios (creator)
ALTER TABLE activities
  ADD CONSTRAINT fk_activities_creator
  FOREIGN KEY (created_by) REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- activities → suite
ALTER TABLE activities
  ADD CONSTRAINT fk_activities_submission
  FOREIGN KEY (submission_id) REFERENCES suite(id)
  ON DELETE SET NULL;

-- projetos → usuarios
ALTER TABLE projetos
  ADD CONSTRAINT fk_projetos_creator
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
  ON DELETE CASCADE;

-- tarefas → projetos
ALTER TABLE tarefas
  ADD CONSTRAINT fk_tarefas_projeto
  FOREIGN KEY (projeto_id) REFERENCES projetos(id)
  ON DELETE CASCADE;

-- tarefas → usuarios (creator)
ALTER TABLE tarefas
  ADD CONSTRAINT fk_tarefas_creator
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
  ON DELETE CASCADE;

-- tarefas → usuarios (assignee)
ALTER TABLE tarefas
  ADD CONSTRAINT fk_tarefas_assignee
  FOREIGN KEY (atribuido_para) REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- tarefas → form_registry
ALTER TABLE tarefas
  ADD CONSTRAINT fk_tarefas_form
  FOREIGN KEY (form_registry_id) REFERENCES form_registry(form_id)
  ON DELETE SET NULL;

-- tarefas → suite
ALTER TABLE tarefas
  ADD CONSTRAINT fk_tarefas_suite
  FOREIGN KEY (tbl_suite_id) REFERENCES suite(id)
  ON DELETE SET NULL;

-- tarefas_anexos → tarefas
ALTER TABLE tarefas_anexos
  ADD CONSTRAINT fk_anexos_tarefa
  FOREIGN KEY (tarefa_id) REFERENCES tarefas(id)
  ON DELETE CASCADE;

-- tarefas_anexos → usuarios
ALTER TABLE tarefas_anexos
  ADD CONSTRAINT fk_anexos_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  ON DELETE CASCADE;

-- tarefas_comentarios → tarefas
ALTER TABLE tarefas_comentarios
  ADD CONSTRAINT fk_comentarios_tarefa
  FOREIGN KEY (tarefa_id) REFERENCES tarefas(id)
  ON DELETE CASCADE;

-- tarefas_comentarios → usuarios
ALTER TABLE tarefas_comentarios
  ADD CONSTRAINT fk_comentarios_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  ON DELETE CASCADE;

-- suite → activities
ALTER TABLE suite
  ADD CONSTRAINT fk_suite_activity
  FOREIGN KEY (activity_id) REFERENCES activities(id)
  ON DELETE SET NULL;

-- suite → usuarios (revisor)
ALTER TABLE suite
  ADD CONSTRAINT fk_suite_revisor
  FOREIGN KEY (revisor_id) REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- suite_historico → suite
ALTER TABLE suite_historico
  ADD CONSTRAINT fk_historico_suite
  FOREIGN KEY (registro_id) REFERENCES suite(id)
  ON DELETE CASCADE;

-- suite_historico → usuarios
ALTER TABLE suite_historico
  ADD CONSTRAINT fk_historico_usuario
  FOREIGN KEY (alterado_por) REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- form_field_registry → form_registry
ALTER TABLE form_field_registry
  ADD CONSTRAINT fk_field_registry_form
  FOREIGN KEY (form_id) REFERENCES form_registry(form_id)
  ON DELETE CASCADE;

-- tbl_tasks_audit → tarefas
ALTER TABLE tbl_tasks_audit
  ADD CONSTRAINT fk_audit_task
  FOREIGN KEY (task_id) REFERENCES tarefas(id)
  ON DELETE CASCADE;

-- tbl_tasks_audit → usuarios (actor)
ALTER TABLE tbl_tasks_audit
  ADD CONSTRAINT fk_audit_actor
  FOREIGN KEY (actor_id) REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- tbl_tasks_audit → usuarios (previous assignee)
ALTER TABLE tbl_tasks_audit
  ADD CONSTRAINT fk_audit_prev_assignee
  FOREIGN KEY (previous_assignee) REFERENCES usuarios(id)
  ON DELETE SET NULL;

-- tbl_tasks_audit → usuarios (new assignee)
ALTER TABLE tbl_tasks_audit
  ADD CONSTRAINT fk_audit_new_assignee
  FOREIGN KEY (new_assignee) REFERENCES usuarios(id)
  ON DELETE SET NULL;

*/

-- ============================================================
-- PARTE 3: ÍNDICES COMPOSTOS PARA QUERIES COMUNS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tarefas_projeto_status ON tarefas(projeto_id, status);
CREATE INDEX IF NOT EXISTS idx_tarefas_atribuido_status ON tarefas(atribuido_para, status);
CREATE INDEX IF NOT EXISTS idx_suite_status_tipo ON suite(status, tipo_form);
CREATE INDEX IF NOT EXISTS idx_activities_form_status ON activities(form_id, status);
CREATE INDEX IF NOT EXISTS idx_historico_registro_em ON suite_historico(registro_id, alterado_em);
