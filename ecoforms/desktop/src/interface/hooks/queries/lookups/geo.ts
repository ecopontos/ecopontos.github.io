import { getContainerAsync } from '../../utils/useContainer';
import { REGISTRO_DADOS_BY_TIPO_ECOPONTO } from '@/src/infrastructure/persistence/sqlite/queries/registro_dados';
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
  TERRENO_BY_ID,
  PONTO_OP_BY_IMOVEL,
  PONTO_OP_INSERT,
  PONTO_OP_UPDATE,
  PONTO_OP_DELETE,
  PONTO_OP_CLEAR_PRINCIPAL,
  PONTO_OP_SET_PRINCIPAL,
} from '@/src/infrastructure/persistence/sqlite/queries/terrenos';
import {
  GEO_LAYERS_LIST,
  GEO_LAYER_UPSERT,
  GEO_LAYER_TOGGLE_VISIVEL,
  GEO_LAYER_DELETE,
} from '@/src/infrastructure/persistence/sqlite/queries/camadas_geo';
import {
  EXECUCAO_CLIENTES_GEO,
  INTERCORRENCIAS_GEO,
  CHECKLIST_GEO,
} from '@/src/infrastructure/persistence/sqlite/queries/execucao_clientes';

export async function fetchRegistroDadosByTipoEcoponto(
  tipo: string,
  ecopontoId: string,
): Promise<{ conteudo: string; criado_em: string }[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<{ conteudo: string; criado_em: string }>(REGISTRO_DADOS_BY_TIPO_ECOPONTO.sql, [tipo, ecopontoId]);
}

export async function fetchClientesGeo(): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(CLIENTES_GEO.sql, CLIENTES_GEO.params);
}

export async function fetchClientesGeoInViewport(bbox: [number, number, number, number]): Promise<Record<string, unknown>[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(CLIENTES_GEO_IN_VIEWPORT.sql, [minLng, maxLng, minLat, maxLat]);
}

export async function fetchClientesGeoCount(): Promise<number> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<{ count: number | string | bigint }>(CLIENTES_GEO_COUNT.sql, CLIENTES_GEO_COUNT.params);
  const raw = rows[0]?.count;
  if (typeof raw === 'string') return parseInt(raw, 10) || 0;
  if (typeof raw === 'bigint') return Number(raw);
  return Number(raw ?? 0);
}

export async function fetchTerrenosAtivos(): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(TERRENOS_ATIVOS.sql, TERRENOS_ATIVOS.params);
}

export async function fetchTerrenosInViewportRtree(bbox: [number, number, number, number]): Promise<Record<string, unknown>[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(TERRENOS_IN_VIEWPORT_RTREE.sql, [minLng, maxLng, minLat, maxLat]);
}

export async function fetchTerrenosInViewportCentroid(bbox: [number, number, number, number]): Promise<Record<string, unknown>[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(TERRENOS_IN_VIEWPORT_CENTROID.sql, [minLng, maxLng, minLat, maxLat]);
}

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
  const numBbox = (v: number | undefined) => (v == null ? null : v);
  const b = args.bbox;
  await c.sqlite.execute(TERRENO_INSERT_OR_IGNORE.sql, [
    args.id, args.nome, args.codigo_cadastral, args.tipo, args.geojson,
    args.centroid_lat, args.centroid_lng, args.area_m2,
    args.bairro, args.logradouro, args.numero, args.cidade, args.estado,
    args.criado_por, args.criado_em, args.atualizado_em,
    numBbox(b?.[0]), numBbox(b?.[1]), numBbox(b?.[2]), numBbox(b?.[3]),
  ]);
}

export async function upsertTerrenosRtree(args: { bbox: [number, number, number, number]; terreno_id: string }): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(TERRENOS_RTREE_UPSERT.sql, [
    args.bbox[0], args.bbox[2], args.bbox[1], args.bbox[3], args.terreno_id,
  ]);
}

export async function deleteTerrenoByIdSafe(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(TERRENOS_CLEAR_TERRENO_ID_CLIENTES.sql, [id]);
  await c.sqlite.execute(TERRENOS_CLEAR_TERRENO_ID_ROTEIRO_CLIENTES.sql, [id]);
  await c.sqlite.execute(TERRENO_SOFT_DELETE.sql, [id]);
}

export async function fetchItinerario(roteiroId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(ROTEIRO_CLIENTES_ITINERARIO.sql, [roteiroId]);
}

export async function fetchGeoLayers(): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(GEO_LAYERS_LIST.sql, GEO_LAYERS_LIST.params);
}

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

export async function toggleGeoLayerVisivel(id: string, visivel: boolean): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(GEO_LAYER_TOGGLE_VISIVEL.sql, [visivel ? 1 : 0, id]);
}

export async function deleteGeoLayer(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(GEO_LAYER_DELETE.sql, [id]);
}

export async function fetchExecucaoGeo(execucaoId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(EXECUCAO_CLIENTES_GEO.sql, [execucaoId]);
}

export async function fetchIntercorrenciasGeo(execucaoId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(INTERCORRENCIAS_GEO.sql, [execucaoId]);
}

// ── Fase 4: pontos operacionais do imóvel (terreno) ──

export async function fetchTerrenoById(id: string): Promise<Record<string, unknown> | null> {
  const c = await getContainerAsync();
  const rows = await c.sqlite.query<Record<string, unknown>>(TERRENO_BY_ID.sql, [id]);
  return rows[0] ?? null;
}

export async function fetchPontosOperacionaisByImovel(imovelId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(PONTO_OP_BY_IMOVEL.sql, [imovelId]);
}

export async function insertPontoOperacional(args: {
  id: string;
  imovel_id: string;
  tipo: string | null;
  latitude: number;
  longitude: number;
  principal: boolean;
  origem: string | null;
  observacao: string | null;
}): Promise<void> {
  const c = await getContainerAsync();
  // Garante unicidade do principal: se for principal, desmarca os outros do mesmo imóvel.
  if (args.principal) {
    await c.sqlite.execute(PONTO_OP_CLEAR_PRINCIPAL.sql, [args.imovel_id]);
  }
  await c.sqlite.execute(PONTO_OP_INSERT.sql, [
    args.id, args.imovel_id, args.tipo, args.latitude, args.longitude,
    args.principal ? 1 : 0, args.origem, args.observacao,
  ]);
}

export async function updatePontoOperacional(args: {
  id: string;
  tipo: string | null;
  latitude: number;
  longitude: number;
  observacao: string | null;
}): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(PONTO_OP_UPDATE.sql, [
    args.tipo, args.latitude, args.longitude, args.observacao, args.id,
  ]);
}

export async function deletePontoOperacional(id: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(PONTO_OP_DELETE.sql, [id]);
}

export async function setPontoOperacionalPrincipal(id: string, imovelId: string): Promise<void> {
  const c = await getContainerAsync();
  await c.sqlite.execute(PONTO_OP_CLEAR_PRINCIPAL.sql, [imovelId]);
  await c.sqlite.execute(PONTO_OP_SET_PRINCIPAL.sql, [id]);
}

export async function fetchChecklistGeo(execucaoId: string): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  return c.sqlite.query<Record<string, unknown>>(CHECKLIST_GEO.sql, [execucaoId]);
}
