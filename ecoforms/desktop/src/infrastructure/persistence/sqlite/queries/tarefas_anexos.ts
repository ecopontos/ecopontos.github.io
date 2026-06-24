/**
 * Catálogo de queries: Anexos de Tarefas
 *
 * Operações sobre `tarefas_anexos` (CRUD mínimo: listar por tarefa,
 * inserir, deletar por id). Consumido por TaskAttachments.
 */
import type { QueryDef } from './_types';

export const TAREFAS_ANEXOS_BY_TAREFA: QueryDef = {
  sql: `SELECT * FROM tarefas_anexos
 WHERE tarefa_id = ?
 ORDER BY created_at DESC`,
  description: 'Lista anexos de uma tarefa, mais recentes primeiro',
  params: ['tarefa_id'],
  use: 'operacional',
  returns: 'TarefaAnexo[]',
};

export const TAREFA_ANEXO_INSERT: QueryDef = {
  sql: `INSERT INTO tarefas_anexos
 (id, tarefa_id, usuario_id, nome_arquivo,
  url_storage, tipo_mime, tamanho_bytes, created_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  description: 'Insere um anexo para uma tarefa',
  params: ['id', 'tarefa_id', 'usuario_id', 'nome_arquivo', 'url_storage', 'tipo_mime', 'tamanho_bytes'],
  use: 'operacional',
  returns: 'void',
};

export const TAREFA_ANEXO_DELETE: QueryDef = {
  sql: `DELETE FROM tarefas_anexos WHERE id = ?`,
  description: 'Deleta um anexo por id',
  params: ['id'],
  use: 'operacional',
  returns: 'void',
};
