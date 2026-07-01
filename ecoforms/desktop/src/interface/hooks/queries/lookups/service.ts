import { getContainerAsync } from '../../utils/useContainer';
import { AGENDAMENTO_BY_ID_WITH_DETAILS } from '@/src/application/persistence/sqlite/queries/service';

export async function fetchAgendamentoByIdWithDetails(id: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(AGENDAMENTO_BY_ID_WITH_DETAILS.sql, [id]);
}
