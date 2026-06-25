/**
 * Lookups simples para selects/dropdowns da UI.
 *
 * Confina o acesso ao catálogo de queries (`src/infrastructure/persistence/sqlite/queries/*`)
 * e ao container DI nesta camada `src/interface/`, para que componentes de `components/**`
 * e `app/**` não importem `src/infrastructure/**` direto (regra de boundary do ESLint).
 *
 * São funções imperativas (não hooks React) porque os consumidores fazem fetch
 * sob demanda dentro de effects/handlers, mantendo seu próprio estado local.
 */
import { getContainerAsync } from '@/src/infrastructure/container';
import {
  USUARIOS_ATIVOS,
  USUARIOS_COUNT,
  USUARIO_NOME_BY_ID,
  USUARIO_AUTH,
  SETOR_BY_ID,
  SETORES_ALL,
} from '@/src/infrastructure/persistence/sqlite/queries/usuarios';
import {
  FORMS_ATIVOS_LIST,
  FORMS_ATIVOS_PRESETS,
  FORMS_SCHEMAS_ATIVOS,
  FORM_DEFINITION_ATIVO,
  FORM_METADATA,
  FORM_REGISTRY_GET_BY_ID_OR_SLUG,
} from '@/src/infrastructure/persistence/sqlite/queries/forms';
import {
  SISTEMA_CONFIG_GET,
  SISTEMA_CONFIG_SAVE,
} from '@/src/infrastructure/persistence/sqlite/queries/system';
import { DATA_REGISTRY_TIPOS_COUNT } from '@/src/infrastructure/persistence/sqlite/queries/data-registry';
import { TAREFA_BY_ID, TAREFA_INSERT_FROM_SOLICITACAO } from '@/src/infrastructure/persistence/sqlite/queries/tarefas';
import {
  TAREFAS_ANEXOS_BY_TAREFA,
  TAREFA_ANEXO_INSERT,
  TAREFA_ANEXO_DELETE,
} from '@/src/infrastructure/persistence/sqlite/queries/tarefas_anexos';
import {
  FORM_REGISTRY_UPDATE,
  FORM_REGISTRY_INSERT,
} from '@/src/infrastructure/persistence/sqlite/queries/forms';
import { PACOTE_INSERT_FROM_FORM } from '@/src/infrastructure/persistence/sqlite/queries/pacotes';
import {
  PACOTES_RECENT_ATUAL,
  PACOTES_FOR_TAREFA,
  PACOTE_BY_ID,
  PACOTE_CLOSE,
  PACOTE_UPDATE_STATUS,
  PACOTE_UPDATE_DADOS,
} from '@/src/infrastructure/persistence/sqlite/queries/pacotes';
import { ESCALAS_LIST } from '@/src/infrastructure/persistence/sqlite/queries/escalas';
import { AGENDAMENTO_BY_ID_WITH_DETAILS } from '@/src/infrastructure/persistence/sqlite/queries/service';
import { REGISTRO_DADOS_BY_TIPO_ECOPONTO } from '@/src/infrastructure/persistence/sqlite/queries/registro_dados';
import { PACOTES_TIPOS_FORM_DISTINTOS } from '@/src/infrastructure/persistence/sqlite/queries/pacotes';
import {
  CLIENTES_GEO,
  CLIENTES_GEO_IN_VIEWPORT,
  CLIENTES_GEO_COUNT,
  TERRENOS_ATIVOS,
  TERRENOS_IN_VIEWPORT_RTREE,
  TERRENOS_IN_VIEWPORT_CENTROID,
  TERRENOS_EXTENT,
  TERRENO_INSERT_OR_IGNORE,
  TERRENOS_RTREE_UPSERT,
  TERRENOS_CLEAR_TERRENO_ID_CLIENTES,
  TERRENOS_CLEAR_TERRENO_ID_ROTEIRO_CLIENTES,
  TERRENO_SOFT_DELETE,
  ROTEIRO_CLIENTES_ITINERARIO,
} from '@/src/infrastructure/persistence/sqlite/queries/terrenos';
import {
  GEO_LAYERS_LIST,
  GEO_LAYER_UPSERT,
  GEO_LAYER_TOGGLE_VISIVEL,
  GEO_LAYER_DELETE,
} from '@/src/infrastructure/persistence/sqlite/queries/geo_layers';
import {
  EXECUCAO_CLIENTES_GEO,
  INTERCORRENCIAS_GEO,
  CHECKLIST_GEO,
} from '@/src/infrastructure/persistence/sqlite/queries/execucao_clientes';
import {
  ROTEIROS_LIST_FILTERED,
  ROTEIROS_DISTINCT_BASES,
  ROTEIROS_DISTINCT_TURNOS,
  EXECUCAO_PESAGENS_LIST_FILTERED,
  EXECUCAO_PESAGENS_DISTINCT_RESIDUOS,
  EXECUCAO_PESAGENS_DISTINCT_DESTINOS,
} from '@/src/infrastructure/persistence/sqlite/queries/logistica';
import { INBOX_NORMALIZADA_VIEW } from '@/src/infrastructure/persistence/sqlite/queries/inbox_view';
import {
  ESCALAS_LIST_FULL,
  ESCALA_INSERT,
  ESCALA_UPDATE,
  ESCALA_DELETE,
} from '@/src/infrastructure/persistence/sqlite/queries/escalas';
import { FORM_REGISTRY_CLONE_INSERT } from '@/src/infrastructure/persistence/sqlite/queries/forms';
import type { FormRegistry } from '@/types';

export interface UsuarioAtivo {
  id: string;
  nome: string;
}

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

export interface TarefaRow {
  id: string;
  projeto_id: string;
  titulo: string;
  status: string;
  prioridade: string;
  atribuido_para: string;
  created_at: string;
  prazo: string;
  setor_id: string;
  demanda_id: string;
}

export interface PacoteRow {
  id_pacote: string;
  tipo_modulo: string;
  carga_json: string;
  criado_em: string;
  status: string;
  id_proprietario: string;
}

export interface FormMetadata<T = unknown> {
  auto_aprovacao: T;
  ad_hoc: T;
}

export interface DataRegistryTipo {
  tipo: string;
  count: number;
}

/** Usuários ativos (id + nome) ordenados por nome. */
export async function fetchUsuariosAtivos(): Promise<UsuarioAtivo[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<UsuarioAtivo>(USUARIOS_ATIVOS.sql, USUARIOS_ATIVOS.params);
}

/**
 * Contagem total de usuários (para detecção de first-run no login).
 * Retorna 0 se a tabela estiver vazia.
 */
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

/**
 * Nome de um usuário por ID (para joins resolvidos na UI — ex.: demanda
 * mostrando "solicitante: Maria"). Retorna null se não existir.
 */
export async function fetchUsuarioNomeById(id: string): Promise<string | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ nome: string }>(USUARIO_NOME_BY_ID.sql, [id]);
  return rows[0]?.nome ?? null;
}

/**
 * Setor (id + nome) por ID (para joins resolvidos na UI).
 * Retorna null se não existir.
 */
export async function fetchSetorById(id: string): Promise<{ id: string; nome: string } | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ id: string; nome: string }>(SETOR_BY_ID.sql, [id]);
  return rows[0] ?? null;
}

/** Formulários ativos (form_id + titulo) ordenados por titulo. */
export async function fetchFormsAtivos(): Promise<FormAtivo[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<FormAtivo>(FORMS_ATIVOS_LIST.sql, FORMS_ATIVOS_LIST.params);
}

/**
 * Obtém um FormRegistry por form_id OU slug, com `conteudo` parseado para objeto.
 * Retorna null se nenhum registro casar.
 */
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
    } catch {
      // mantém string original em caso de JSON inválido
    }
  }
  return row as unknown as FormRegistry;
}

/**
 * Formulários ativos com slug (NewTaskModal e similares).
 * `slug` serve como fallback de `form_id` quando este estiver ausente.
 */
export async function fetchFormPresets(): Promise<FormPresetOption[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<FormPresetOption>(FORMS_ATIVOS_PRESETS.sql, FORMS_ATIVOS_PRESETS.params);
}

/** Schemas (conteúdo JSON) de todos os formulários ativos (TaskDetailPage). */
export async function fetchFormSchemasAtivos(): Promise<FormSchemaRow[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<FormSchemaRow>(FORMS_SCHEMAS_ATIVOS.sql, FORMS_SCHEMAS_ATIVOS.params);
}

/** Tarefa completa por ID (TaskDetailPage). Retorna null se não existir. */
export async function fetchTarefaById(id: string): Promise<TarefaRow | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<TarefaRow>(TAREFA_BY_ID.sql, [id]);
  return rows[0] ?? null;
}

/** Pacotes ativos (atual=1) mais recentes — feed do TaskDetailPage. */
export async function fetchPacotesRecentAtuais(): Promise<PacoteRow[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<PacoteRow>(PACOTES_RECENT_ATUAL.sql, PACOTES_RECENT_ATUAL.params);
}

/**
 * Fecha (arquiva) um lote de pacotes em transação implícita por linha.
 * Cada chamada usa PACOTE_CLOSE — `?` parametrizado, sem interpolação.
 */
export async function closePacotes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const c = await getContainerAsync();
  for (const id of ids) {
    await c.sqlite.execute(PACOTE_CLOSE.sql, [id]);
  }
}

/**
 * Pacote completo por id (app/view). Retorna null se não existir.
 * NOTA: o catálogo usa coluna `id` (preserva comportamento original) —
 * investigar se é alias de id_pacote.
 */
export async function fetchPacoteById(id: string): Promise<Record<string, unknown> | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<Record<string, unknown>>(PACOTE_BY_ID.sql, [id]);
  return rows[0] ?? null;
}

/** Atualiza o status de um pacote (revisão de submissão). */
export async function updatePacoteStatus(idPacote: string, status: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(PACOTE_UPDATE_STATUS.sql, [status, idPacote]);
}

/** Atualiza o JSON de dados de um pacote (edição no app/view). */
export async function updatePacoteDados(idPacote: string, dados: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(PACOTE_UPDATE_DADOS.sql, [dados, idPacote]);
}

/** Todos os setores (sem filtro de ativo) — para o editor de usuários. */
export async function fetchSetoresAll(): Promise<{ id: string; nome: string }[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<{ id: string; nome: string }>(SETORES_ALL.sql, SETORES_ALL.params);
}

/** Lista de escalas (id + nome) ordenadas por nome. */
export async function fetchEscalas(): Promise<{ id: string; nome: string }[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<{ id: string; nome: string }>(ESCALAS_LIST.sql, ESCALAS_LIST.params);
}

/** Pacotes (entradas de suite) vinculados a uma tarefa. */
export async function fetchPacotesForTarefa(
  suiteIdOrRef: string,
): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    PACOTES_FOR_TAREFA.sql,
    [suiteIdOrRef, suiteIdOrRef],
  );
}

/**
 * Campos de auth de um usuário (inclui hash_senha — uso interno apenas).
 * Retorna null se não existir.
 */
export async function fetchUsuarioAuth(id: string): Promise<Record<string, unknown> | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<Record<string, unknown>>(USUARIO_AUTH.sql, [id]);
  return rows[0] ?? null;
}

/** Agendamento por id com joins em slot e service type (EditTaskModal). */
export async function fetchAgendamentoByIdWithDetails(
  id: string,
): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    AGENDAMENTO_BY_ID_WITH_DETAILS.sql,
    [id],
  );
}

/** Lista anexos de uma tarefa (TaskAttachments). */
export async function fetchTarefaAnexos(tarefaId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    TAREFAS_ANEXOS_BY_TAREFA.sql,
    [tarefaId],
  );
}

/** Insere um anexo em uma tarefa (TaskAttachments). */
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

/** Deleta um anexo por id (TaskAttachments). */
export async function deleteTarefaAnexo(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(TAREFA_ANEXO_DELETE.sql, [id]);
}

/** Atualiza um registro de formulário existente (SchemaEditor — update branch). */
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

/** Insere um novo registro de formulário (SchemaEditor — insert branch). */
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

/** Insere uma tarefa a partir de uma solicitação (FormRenderer — auto_aprovacao). */
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

/** Insere um pacote v2 a partir de um formulário regular (FormRenderer). */
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

/** Tipos de formulário distintos em pacotes ativos (useAnalysisData). */
export async function fetchPacoteFormTypes(): Promise<string[]> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ tipo_form: string }>(
    PACOTES_TIPOS_FORM_DISTINTOS.sql,
  );
  return rows.map(r => r.tipo_form).filter(Boolean);
}

/** Lista completa de escalas (useEscalas). */
export async function fetchEscalasFull(): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(ESCALAS_LIST_FULL.sql, ESCALAS_LIST_FULL.params);
}

/** Insere uma escala (useEscalas.create). */
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

/** Atualiza uma escala (useEscalas.update). */
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

/** Deleta uma escala (useEscalas.remove). */
export async function deleteEscala(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(ESCALA_DELETE.sql, [id]);
}

/** Insere um clone de formulário (useFormRegistryData.clone). */
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

/** Registros de dados por tipo + ecoponto (useRemocaoAnalytics). */
export async function fetchRegistroDadosByTipoEcoponto(
  tipo: string,
  ecopontoId: string,
): Promise<{ conteudo: string; criado_em: string }[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<{ conteudo: string; criado_em: string }>(
    REGISTRO_DADOS_BY_TIPO_ECOPONTO.sql,
    [tipo, ecopontoId],
  );
}

/** Clientes com posição resolvida (useMapData useClientesGeo). */
export async function fetchClientesGeo(): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(CLIENTES_GEO.sql, CLIENTES_GEO.params);
}

/** Clientes no viewport via bbox (useClientesGeoInViewport). */
export async function fetchClientesGeoInViewport(
  bbox: [number, number, number, number],
): Promise<Record<string, unknown>[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    CLIENTES_GEO_IN_VIEWPORT.sql,
    [minLng, maxLng, minLat, maxLat],
  );
}

/** Contagem de clientes geolocalizados — decide threshold para viewport loading. */
export async function fetchClientesGeoCount(): Promise<number> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ count: number | string | bigint }>(
    CLIENTES_GEO_COUNT.sql,
    CLIENTES_GEO_COUNT.params,
  );
  const raw = rows[0]?.count;
  if (typeof raw === 'string') return parseInt(raw, 10) || 0;
  if (typeof raw === 'bigint') return Number(raw);
  return Number(raw ?? 0);
}

/** Terrenos ativos (useMapData useTerrenos). */
export async function fetchTerrenosAtivos(): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(TERRENOS_ATIVOS.sql, TERRENOS_ATIVOS.params);
}

/** Terrenos no viewport via R-Tree (zoom >= 12). */
export async function fetchTerrenosInViewportRtree(
  bbox: [number, number, number, number],
): Promise<Record<string, unknown>[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    TERRENOS_IN_VIEWPORT_RTREE.sql,
    [minLng, maxLng, minLat, maxLat],
  );
}

/** Terrenos no viewport via centroid bbox (zoom < 12). */
export async function fetchTerrenosInViewportCentroid(
  bbox: [number, number, number, number],
): Promise<Record<string, unknown>[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    TERRENOS_IN_VIEWPORT_CENTROID.sql,
    [minLng, maxLng, minLat, maxLat],
  );
}

/** Extent agregado de terrenos ativos (useTerrenosExtent). */
export async function fetchTerrenosExtent(): Promise<{
  min_lng: number | null;
  min_lat: number | null;
  max_lng: number | null;
  max_lat: number | null;
} | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{
    min_lng: number | null;
    min_lat: number | null;
    max_lng: number | null;
    max_lat: number | null;
  }>(TERRENOS_EXTENT.sql, TERRENOS_EXTENT.params);
  return rows[0] ?? null;
}

/** Insere um terreno (INSERT OR IGNORE) — saveTerrenosBatch. */
export async function insertTerrenoOrIgnore(args: {
  id: string;
  nome: string;
  codigo_cadastral: string | null;
  tipo: string;
  geojson: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
  area_m2: number | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cidade: string | null;
  estado: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  bbox: [number, number, number, number] | undefined;
}): Promise<void> {
  const c = await getContainerAsync();
  const numBbox = (v: number | undefined) => v == null ? null : v;
  const b = args.bbox;
  await c.sqlite.execute(TERRENO_INSERT_OR_IGNORE.sql, [
    args.id, args.nome, args.codigo_cadastral, args.tipo, args.geojson,
    args.centroid_lat, args.centroid_lng, args.area_m2,
    args.bairro, args.logradouro, args.numero, args.cidade, args.estado,
    args.criado_por, args.criado_em, args.atualizado_em,
    numBbox(b?.[0]), numBbox(b?.[1]), numBbox(b?.[2]), numBbox(b?.[3]),
  ]);
}

/** Upsert do bbox R-Tree para um terreno — saveTerrenosBatch. */
export async function upsertTerrenosRtree(args: {
  bbox: [number, number, number, number];
  terreno_id: string;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(TERRENOS_RTREE_UPSERT.sql, [
    args.bbox[0], args.bbox[2], args.bbox[1], args.bbox[3], args.terreno_id,
  ]);
}

/** Soft-delete completo: desvincula clientes, roteiro_clientes, marca ativo=0. */
export async function deleteTerrenoByIdSafe(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(TERRENOS_CLEAR_TERRENO_ID_CLIENTES.sql, [id]);
  await c.sqlite.execute(TERRENOS_CLEAR_TERRENO_ID_ROTEIRO_CLIENTES.sql, [id]);
  await c.sqlite.execute(TERRENO_SOFT_DELETE.sql, [id]);
}

/** Paradas de um roteiro com nome e posição (useMapData useItinerario). */
export async function fetchItinerario(roteiroId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    ROTEIRO_CLIENTES_ITINERARIO.sql,
    [roteiroId],
  );
}

/** Lista de geo layers (useMapData useGeoLayers). */
export async function fetchGeoLayers(): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(GEO_LAYERS_LIST.sql, GEO_LAYERS_LIST.params);
}

/** Upsert de uma geo layer (saveGeoLayer). */
export async function upsertGeoLayer(args: {
  id: string;
  nome: string;
  tipo: string;
  categoria: string;
  geojson: string;
  cor: string;
  criado_por?: string | null;
  criado_em: string;
  atualizado_em: string;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(GEO_LAYER_UPSERT.sql, [
    args.id, args.nome, args.tipo, args.categoria, args.geojson, args.cor,
    args.criado_por ?? null, args.criado_em, args.atualizado_em,
  ]);
}

/** Toggle de visibilidade de uma geo layer (toggleGeoLayerVisivel). */
export async function toggleGeoLayerVisivel(id: string, visivel: boolean): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(GEO_LAYER_TOGGLE_VISIVEL.sql, [visivel ? 1 : 0, id]);
}

/** Deleta uma geo layer (deleteGeoLayer). */
export async function deleteGeoLayer(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(GEO_LAYER_DELETE.sql, [id]);
}

/** Pontos de execução de clientes (useMapData useExecucaoGeo). */
export async function fetchExecucaoGeo(execucaoId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    EXECUCAO_CLIENTES_GEO.sql,
    [execucaoId],
  );
}

/** Intercorrências de uma execução (useMapData useIntercorrenciasGeo). */
export async function fetchIntercorrenciasGeo(execucaoId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    INTERCORRENCIAS_GEO.sql,
    [execucaoId],
  );
}

/** Itens de checklist de uma execução (useMapData useChecklistGeo). */
export async function fetchChecklistGeo(execucaoId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(
    CHECKLIST_GEO.sql,
    [execucaoId],
  );
}

/** Roteiros filtrados (useLegacySyncData). Filtros null = sem filtro. */
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

/** Pesagens filtradas (useLegacySyncData). Filtros null = sem filtro. */
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

/** Opções de filtro (bases, turnos, residuos, destinos) para legacy sync. */
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
    bases: bases.map(r => r.base),
    turnos: turnos.map(r => r.turno),
    residuos: residuos.map(r => r.residuo),
    destinos: destinos.map(r => r.destino),
  };
}

/**
 * View normalizada do inbox (useInboxData).
 * O accessFilter.clause vem de `buildInboxAccessFilter` e eh
 * injetado em {{ACCESS_CLAUSE}}. A searchClause (FTS MATCH) eh
 * injetada em {{SEARCH_CLAUSE}}.
 */
export async function fetchInboxNormalizada(args: {
  accessClause: string;
  accessParams: unknown[];
  searchTerm: string;
}): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  const searchClause = args.searchTerm
    ? 'AND v.id IN (SELECT suite_id FROM suite_fts WHERE texto_busca MATCH ?) ORDER BY v.criado_em DESC'
    : 'ORDER BY v.criado_em DESC';
  const sql = INBOX_NORMALIZADA_VIEW.sql
    .replace('{{ACCESS_CLAUSE}}', args.accessClause)
    .replace('{{SEARCH_CLAUSE}}', searchClause);
  const params = args.searchTerm
    ? [...args.accessParams, `"${args.searchTerm}"*`]
    : [...args.accessParams];
  return c.sqlite.query<Record<string, unknown>>(sql, params);
}

/** Conteúdo (JSON cru) de um formulário ativo por form_id, ou null se não existir. */
export async function fetchFormDefinitionAtivo(formId: string): Promise<string | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ conteudo: string }>(FORM_DEFINITION_ATIVO.sql, [formId]);
  return rows[0]?.conteudo ?? null;
}

/** Metadados de auto-aprovação / ad-hoc de um formulário, ou null se não existir. */
export async function fetchFormMetadata<T = unknown>(formId: string): Promise<FormMetadata<T> | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<FormMetadata<T>>(FORM_METADATA.sql, [formId]);
  return rows[0] ?? null;
}

/** Contagem de registros por tipo na tabela data_registry (para selects de catálogo). */
export async function fetchDataRegistryTipos(): Promise<DataRegistryTipo[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<DataRegistryTipo>(DATA_REGISTRY_TIPOS_COUNT.sql, DATA_REGISTRY_TIPOS_COUNT.params);
}

/** Valor de uma configuração do sistema por chave, ou null se não existir. */
export async function getSistemaConfig(chave: string): Promise<string | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ valor: string }>(SISTEMA_CONFIG_GET.sql, [chave]);
  return rows[0]?.valor ?? null;
}

/** Salva (upsert) uma configuração do sistema. */
export async function saveSistemaConfig(chave: string, valor: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(SISTEMA_CONFIG_SAVE.sql, [chave, valor]);
}
