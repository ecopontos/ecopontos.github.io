import { getContainerAsync } from '../../utils/useContainer';
import {
  FORMS_ATIVOS_LIST,
  FORMS_ATIVOS_PRESETS,
  FORMS_SCHEMAS_ATIVOS,
  FORM_DEFINITION_ATIVO,
  FORM_METADATA,
  FORM_REGISTRY_GET_BY_ID_OR_SLUG,
  FORM_REGISTRY_UPDATE,
  FORM_REGISTRY_INSERT,
  FORM_REGISTRY_CLONE_INSERT,
} from '@/src/application/persistence/sqlite/queries/forms';
import { DATA_REGISTRY_TIPOS_COUNT } from '@/src/application/persistence/sqlite/queries/data-registry';
import { TAREFA_INSERT_FROM_SOLICITACAO } from '@/src/application/persistence/sqlite/queries/tarefas';
import { PACOTE_INSERT_FROM_FORM } from '@/src/application/persistence/sqlite/queries/pacotes';
import type { FormRegistry } from '@/types';

export interface FormAtivo {
  form_id: string;
  titulo: string;
}

export interface FormPresetOption {
  form_id: string;
  slug: string;
  titulo: string;
}

export interface FormSchemaRow {
  form_id: string;
  conteudo: string;
}

export interface FormMetadata<T = unknown> {
  auto_aprovacao: T;
  ad_hoc: T;
}

export interface DataRegistryTipo {
  tipo: string;
  count: number;
}

export async function fetchFormsAtivos(): Promise<FormAtivo[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<FormAtivo>(FORMS_ATIVOS_LIST.sql, FORMS_ATIVOS_LIST.params);
}

export async function fetchFormByIdOrSlug(formIdOrSlug: string): Promise<FormRegistry | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<Record<string, unknown>>(
    FORM_REGISTRY_GET_BY_ID_OR_SLUG.sql,
    [formIdOrSlug, formIdOrSlug],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  if (typeof row.conteudo === 'string') {
    try {
      row.conteudo = JSON.parse(row.conteudo);
    } catch {}
  }
  return row as unknown as FormRegistry;
}

export async function fetchFormPresets(): Promise<FormPresetOption[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<FormPresetOption>(FORMS_ATIVOS_PRESETS.sql, FORMS_ATIVOS_PRESETS.params);
}

export async function fetchFormSchemasAtivos(): Promise<FormSchemaRow[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<FormSchemaRow>(FORMS_SCHEMAS_ATIVOS.sql, FORMS_SCHEMAS_ATIVOS.params);
}

export async function updateFormRegistry(args: {
  titulo: string;
  versao: number;
  conteudo: string;
  atualizado_em: string;
  slug: string | null;
  ativo: number | boolean;
  auto_aprovacao: number | boolean | null;
  ad_hoc: number | boolean | null;
  data_id: string | null;
  form_id: string;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(FORM_REGISTRY_UPDATE.sql, [
    args.titulo, args.versao, args.conteudo, args.atualizado_em,
    args.slug, args.ativo ? 1 : 0, args.auto_aprovacao, args.ad_hoc, args.data_id,
    args.form_id,
  ]);
}

export async function insertFormRegistry(args: {
  form_id: string;
  titulo: string;
  versao: number;
  conteudo: string;
  criado_em: string;
  atualizado_em: string;
  slug: string | null;
  ativo: number | boolean;
  auto_aprovacao: number | boolean | null;
  ad_hoc: number | boolean | null;
  data_id: string | null;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(FORM_REGISTRY_INSERT.sql, [
    args.form_id, args.titulo, args.versao, args.conteudo,
    args.criado_em, args.atualizado_em, args.slug, args.ativo ? 1 : 0,
    args.auto_aprovacao, args.ad_hoc, args.data_id,
  ]);
}

export async function cloneFormRegistry(args: {
  new_form_id: string;
  new_titulo: string;
  new_slug: string;
  conteudo: string;
  versao: string;
  autor: string;
  auto_aprovacao: number;
  ad_hoc: number;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(FORM_REGISTRY_CLONE_INSERT.sql, [
    args.new_form_id, args.new_titulo, args.new_slug, args.conteudo, args.versao,
    args.autor, args.auto_aprovacao, args.ad_hoc,
  ]);
}

export async function fetchFormDefinitionAtivo(formId: string): Promise<string | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ conteudo: string }>(FORM_DEFINITION_ATIVO.sql, [formId]);
  return rows[0]?.conteudo ?? null;
}

export async function fetchFormMetadata<T = unknown>(formId: string): Promise<FormMetadata<T> | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<FormMetadata<T>>(FORM_METADATA.sql, [formId]);
  return rows[0] ?? null;
}

export async function fetchDataRegistryTipos(): Promise<DataRegistryTipo[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<DataRegistryTipo>(DATA_REGISTRY_TIPOS_COUNT.sql, DATA_REGISTRY_TIPOS_COUNT.params);
}

export async function insertTarefaFromSolicitacao(args: {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  criado_por: string;
  id_formulario: string;
  carga: string;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(TAREFA_INSERT_FROM_SOLICITACAO.sql, [
    args.id, args.titulo, args.descricao, args.prioridade,
    args.criado_por, args.id_formulario, args.carga,
  ]);
}

export async function insertPacoteFromForm(args: {
  id_pacote: string;
  tipo_modulo: string;
  tipo_recurso: string;
  status: string;
  id_proprietario: string;
  dados: string;
  carga_json: string;
  criado_em: string;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(PACOTE_INSERT_FROM_FORM.sql, [
    args.id_pacote, args.tipo_modulo, args.tipo_recurso, args.status,
    args.id_proprietario, args.dados, args.carga_json, args.criado_em,
  ]);
}
