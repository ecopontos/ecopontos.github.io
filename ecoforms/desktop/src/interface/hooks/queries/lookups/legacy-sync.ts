import { getContainerAsync } from '../../utils/useContainer';
import {
  ROTEIROS_LIST_FILTERED,
  ROTEIROS_DISTINCT_BASES,
  ROTEIROS_DISTINCT_TURNOS,
  EXECUCAO_PESAGENS_LIST_FILTERED,
  EXECUCAO_PESAGENS_DISTINCT_RESIDUOS,
  EXECUCAO_PESAGENS_DISTINCT_DESTINOS,
} from '@/src/infrastructure/persistence/sqlite/queries/logistica';

export async function fetchRoteirosFiltered(filters: {
  situacao: string;
  base: string;
  turno: string;
  limit: number;
}): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(ROTEIROS_LIST_FILTERED.sql, [
    filters.situacao || null, filters.situacao || null,
    filters.base || null, filters.base || null,
    filters.turno || null, filters.turno || null,
    filters.limit,
  ]);
}

export async function fetchPesagensFiltered(filters: {
  residuo: string;
  destino: string;
  dataInicio: string;
  dataFim: string;
  limit: number;
}): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(EXECUCAO_PESAGENS_LIST_FILTERED.sql, [
    filters.residuo || null, filters.residuo || null,
    filters.destino || null, filters.destino || null,
    filters.dataInicio || null, filters.dataInicio || null,
    filters.dataFim || null, filters.dataFim || null,
    filters.limit,
  ]);
}

export async function fetchLegacyFilterOptions(): Promise<{
  bases: string[];
  turnos: string[];
  residuos: string[];
  destinos: string[];
}> {
  const c = await getContainerAsync();
  const [bases, turnos, residuos, destinos] = await Promise.all([
    c.sqlite.query<{ base: string }>(ROTEIROS_DISTINCT_BASES.sql, ROTEIROS_DISTINCT_BASES.params),
    c.sqlite.query<{ turno: string }>(ROTEIROS_DISTINCT_TURNOS.sql, ROTEIROS_DISTINCT_TURNOS.params),
    c.sqlite.query<{ residuo: string }>(EXECUCAO_PESAGENS_DISTINCT_RESIDUOS.sql, EXECUCAO_PESAGENS_DISTINCT_RESIDUOS.params),
    c.sqlite.query<{ destino: string }>(EXECUCAO_PESAGENS_DISTINCT_DESTINOS.sql, EXECUCAO_PESAGENS_DISTINCT_DESTINOS.params),
  ]);
  return {
    bases: bases.map((r: { base: string }) => r.base),
    turnos: turnos.map((r: { turno: string }) => r.turno),
    residuos: residuos.map((r: { residuo: string }) => r.residuo),
    destinos: destinos.map((r: { destino: string }) => r.destino),
  };
}
