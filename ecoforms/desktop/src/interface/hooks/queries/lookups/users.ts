import { getContainerAsync } from '../../utils/useContainer';
import {
  USUARIOS_ATIVOS,
  USUARIOS_COUNT,
  USUARIO_NOME_BY_ID,
  USUARIO_AUTH,
  SETOR_BY_ID,
  SETORES_ALL,
} from '@/src/infrastructure/persistence/sqlite/queries/usuarios';

export interface UsuarioAtivo {
  id: string;
  nome: string;
}

export async function fetchUsuariosAtivos(): Promise<UsuarioAtivo[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<UsuarioAtivo>(USUARIOS_ATIVOS.sql, USUARIOS_ATIVOS.params);
}

export async function countUsuarios(): Promise<number> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ count: number | string | bigint }>(
    USUARIOS_COUNT.sql,
    USUARIOS_COUNT.params,
  );
  const raw = rows[0]?.count;
  if (typeof raw === 'string') return parseInt(raw, 10) || 0;
  if (typeof raw === 'bigint') return Number(raw);
  return Number(raw ?? 0);
}

export async function fetchUsuarioNomeById(id: string): Promise<string | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ nome: string }>(USUARIO_NOME_BY_ID.sql, [id]);
  return rows[0]?.nome ?? null;
}

export async function fetchSetorById(id: string): Promise<{ id: string; nome: string } | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ id: string; nome: string }>(SETOR_BY_ID.sql, [id]);
  return rows[0] ?? null;
}

export async function fetchSetoresAll(): Promise<{ id: string; nome: string }[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<{ id: string; nome: string }>(SETORES_ALL.sql, SETORES_ALL.params);
}

export async function fetchUsuarioAuth(id: string): Promise<Record<string, unknown> | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<Record<string, unknown>>(USUARIO_AUTH.sql, [id]);
  return rows[0] ?? null;
}
