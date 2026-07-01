import { getContainerAsync } from '../../utils/useContainer';
import {
  PACOTES_RECENT_ATUAL,
  PACOTES_FOR_TAREFA,
  PACOTE_BY_ID,
  PACOTE_CLOSE,
  PACOTE_UPDATE_STATUS,
  PACOTE_UPDATE_DADOS,
  PACOTES_TIPOS_FORM_DISTINTOS,
} from '@/src/infrastructure/persistence/sqlite/queries/pacotes';

export interface PacoteRow {
  id_pacote: string;
  tipo_modulo: string;
  carga_json: string;
  criado_em: string;
  status: string;
  id_proprietario: string;
}

export async function fetchPacotesRecentAtuais(): Promise<PacoteRow[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<PacoteRow>(PACOTES_RECENT_ATUAL.sql, PACOTES_RECENT_ATUAL.params);
}

export async function closePacotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const c = await getContainerAsync();
  for (const id of ids) {
    await c.sqlite.execute(PACOTE_CLOSE.sql, [id]);
  }
}

export async function fetchPacoteById(id: string): Promise<Record<string, unknown> | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<Record<string, unknown>>(PACOTE_BY_ID.sql, [id]);
  return rows[0] ?? null;
}

export async function updatePacoteStatus(idPacote: string, status: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(PACOTE_UPDATE_STATUS.sql, [status, idPacote]);
}

export async function updatePacoteDados(idPacote: string, dados: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(PACOTE_UPDATE_DADOS.sql, [dados, idPacote]);
}

export async function fetchPacotesForTarefa(tarefaId: string): Promise<PacoteRow[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<PacoteRow>(PACOTES_FOR_TAREFA.sql, [tarefaId, tarefaId]);
}

export async function fetchPacoteFormTypes(): Promise<string[]> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ tipo_form: string }>(PACOTES_TIPOS_FORM_DISTINTOS.sql);
  return rows.map((r: { tipo_form: string }) => r.tipo_form).filter(Boolean);
}
