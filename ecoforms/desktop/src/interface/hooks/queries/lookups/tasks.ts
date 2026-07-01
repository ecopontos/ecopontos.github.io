import { getContainerAsync } from '../../utils/useContainer';
import { TAREFA_BY_ID } from '@/src/application/persistence/sqlite/queries/tarefas';
import {
  TAREFAS_ANEXOS_BY_TAREFA,
  TAREFA_ANEXO_INSERT,
  TAREFA_ANEXO_DELETE,
} from '@/src/application/persistence/sqlite/queries/tarefas_anexos';

export interface TarefaRow {
  id: string;
  projeto_id: string | null;
  titulo: string;
  status: string;
  prioridade: string;
  atribuido_para: string;
  criado_em: string;
  prazo: string | null;
  setor_id: string | null;
  demanda_id: string | null;
}

export async function fetchTarefaById(id: string): Promise<TarefaRow | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<TarefaRow>(TAREFA_BY_ID.sql, [id]);
  return rows[0] ?? null;
}

export async function fetchTarefaAnexos(tarefaId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(TAREFAS_ANEXOS_BY_TAREFA.sql, [tarefaId]);
}

export async function insertTarefaAnexo(args: {
  id: string;
  tarefa_id: string;
  usuario_id: string;
  nome_arquivo: string;
  url_storage: string;
  tipo_mime: string;
  tamanho_bytes: number;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(TAREFA_ANEXO_INSERT.sql, [
    args.id, args.tarefa_id, args.usuario_id, args.nome_arquivo,
    args.url_storage, args.tipo_mime, args.tamanho_bytes,
  ]);
}

export async function deleteTarefaAnexo(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(TAREFA_ANEXO_DELETE.sql, [id]);
}
