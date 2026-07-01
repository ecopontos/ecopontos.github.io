import { getContainerAsync } from '../../utils/useContainer';
import { ESCALAS_LIST } from '@/src/infrastructure/persistence/sqlite/queries/escalas';
import {
  ESCALAS_LIST_FULL,
  ESCALA_INSERT,
  ESCALA_UPDATE,
  ESCALA_DELETE,
} from '@/src/infrastructure/persistence/sqlite/queries/escalas';
import {
  SISTEMA_CONFIG_GET,
  SISTEMA_CONFIG_SAVE,
} from '@/src/infrastructure/persistence/sqlite/queries/system';

export async function fetchEscalas(): Promise<{ id: string; nome: string }[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<{ id: string; nome: string }>(ESCALAS_LIST.sql, ESCALAS_LIST.params);
}

export async function fetchEscalasFull(): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(ESCALAS_LIST_FULL.sql, ESCALAS_LIST_FULL.params);
}

export async function insertEscala(args: {
  id: string;
  nome: string;
  tipo: string;
  referencia_inicio: string;
  duracao_minutos: number;
  tolerancia_minutos: number;
  ciclo_horas: number;
  criado_em: string;
  atualizado_em: string;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(ESCALA_INSERT.sql, [
    args.id, args.nome, args.tipo, args.referencia_inicio, args.duracao_minutos,
    args.tolerancia_minutos, args.ciclo_horas, args.criado_em, args.atualizado_em,
  ]);
}

export async function updateEscala(args: {
  id: string;
  nome: string;
  tipo: string;
  referencia_inicio: string;
  duracao_minutos: number;
  tolerancia_minutos: number;
  ciclo_horas: number;
  atualizado_em: string;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(ESCALA_UPDATE.sql, [
    args.nome, args.tipo, args.referencia_inicio, args.duracao_minutos,
    args.tolerancia_minutos, args.ciclo_horas, args.atualizado_em, args.id,
  ]);
}

export async function deleteEscala(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(ESCALA_DELETE.sql, [id]);
}

export async function getSistemaConfig(chave: string): Promise<string | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ valor: string }>(SISTEMA_CONFIG_GET.sql, [chave]);
  return rows[0]?.valor ?? null;
}

export async function saveSistemaConfig(chave: string, valor: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(SISTEMA_CONFIG_SAVE.sql, [chave, valor]);
}
