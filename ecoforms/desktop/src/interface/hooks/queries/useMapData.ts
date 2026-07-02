/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { extractBbox } from '@/lib/geo/bbox';
import {
  fetchClientesGeo,
  fetchClientesGeoInViewport,
  fetchClientesGeoCount,
  fetchTerrenosAtivos,
  fetchTerrenosInViewportCentroid,
  fetchTerrenosInViewportRtree,
  fetchTerrenosExtent,
  fetchItinerario,
  fetchGeoLayers,
  fetchExecucaoGeo,
  fetchIntercorrenciasGeo,
  fetchChecklistGeo,
  insertTerrenoOrIgnore,
  upsertTerrenosRtree,
  deleteTerrenoByIdSafe,
  upsertGeoLayer,
  toggleGeoLayerVisivel as toggleGeoLayerVisivelLookup,
  deleteGeoLayer as deleteGeoLayerLookup,
} from '@/src/interface/hooks/queries/lookups/geo';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ClienteGeo {
    id: string;
    nome: string;
    latitude: number;
    longitude: number;
    tipo: string;
    categoria: string | null;
    endereco: string | null;
    terreno_id: string | null;
    terreno_nome: string | null;
}

export interface TerrenoGeo {
    id: string;
    nome: string;
    codigo_cadastral: string | null;
    tipo: string;
    geojson: string;
    centroid_lat: number | null;
    centroid_lng: number | null;
    area_m2: number | null;
    bairro: string | null;
    ativo: number;
}

export interface GeoLayer {
    id: string;
    nome: string;
    tipo: string;
    categoria: string | null;
    geojson: string | null;
    cor: string;
    visivel: number;
}

export interface ItinerarioStop {
    ordem: number;
    cliente_id: string;
    nome: string;
    latitude: number | null;
    longitude: number | null;
    terreno_id: string | null;
    terreno_nome: string | null;
    codigo_cadastral: string | null;
    /** terrenos.centroid_lat "cru" do terreno resolvido (vínculo principal) — usado para saber se a coordenada final veio do centroide. */
    terreno_centroid_lat: number | null;
    /** terrenos.centroid_lng "cru" do terreno resolvido (vínculo principal) — usado para saber se a coordenada final veio do centroide. */
    terreno_centroid_lng: number | null;
    /** imovel_pontos_operacionais.latitude "cru" do terreno resolvido (Fase 4) — ponto operacional principal. */
    ponto_operacional_lat: number | null;
    /** imovel_pontos_operacionais.longitude "cru" do terreno resolvido (Fase 4) — ponto operacional principal. */
    ponto_operacional_lng: number | null;
    /** roteiro_clientes.ponto_operacional_id — override explícito de ponto nesta parada (Fase 3 logística). */
    parada_ponto_operacional_id: string | null;
    parada_ponto_operacional_lat: number | null;
    parada_ponto_operacional_lng: number | null;
    /** roteiro_clientes.imovel_id — override de imóvel nesta parada (Fase 3 logística). */
    parada_imovel_id: string | null;
    parada_imovel_ponto_operacional_lat: number | null;
    parada_imovel_ponto_operacional_lng: number | null;
    parada_imovel_centroid_lat: number | null;
    parada_imovel_centroid_lng: number | null;
}

// ─── Helpers espaciais ────────────────────────────────────────────────────────

function ringCentroid(ring: number[][]): [number, number] {
    const n = ring.length - 1;
    let sumLng = 0, sumLat = 0;
    for (let i = 0; i < n; i++) { sumLng += ring[i][0]; sumLat += ring[i][1]; }
    return [sumLng / n, sumLat / n];
}

function ringAreaM2(ring: number[][]): number {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        area += ring[i][0] * ring[i + 1][1];
        area -= ring[i + 1][0] * ring[i][1];
    }
    area = Math.abs(area) / 2;
    const avgLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    const latM = 111320;
    const lngM = 111320 * Math.cos((avgLat * Math.PI) / 180);
    return area * latM * lngM;
}

export function computeCentroid(geojson: GeoJSON.Geometry): [number, number] | null {
    if (geojson.type === 'Polygon')      return ringCentroid(geojson.coordinates[0]);
    if (geojson.type === 'Point')         return [geojson.coordinates[0], geojson.coordinates[1]];
    if (geojson.type === 'MultiPolygon') {
        let totalArea = 0;
        let weightedLng = 0;
        let weightedLat = 0;
        for (const polygon of geojson.coordinates) {
            const area = ringAreaM2(polygon[0]);
            const [lng, lat] = ringCentroid(polygon[0]);
            totalArea += area;
            weightedLng += lng * area;
            weightedLat += lat * area;
        }
        return totalArea > 0 ? [weightedLng / totalArea, weightedLat / totalArea] : ringCentroid(geojson.coordinates[0][0]);
    }
    return null;
}

export function computeAreaM2(geojson: GeoJSON.Geometry): number | null {
    if (geojson.type === 'Polygon') {
        return ringAreaM2(geojson.coordinates[0]);
    }
    if (geojson.type === 'MultiPolygon') {
        let total = 0;
        for (const polygon of geojson.coordinates) {
            total += ringAreaM2(polygon[0]);
        }
        return total;
    }
    return null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const VIEWPORT_CLIENT_THRESHOLD = 2000;

export function useClientesGeo(bbox?: [number, number, number, number] | null) {
    const [data, setData] = useState<ClienteGeo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [useViewportMode, setUseViewportMode] = useState<boolean | null>(null);

    useEffect(() => {
        fetchClientesGeoCount()
            .then(count => setUseViewportMode(count > VIEWPORT_CLIENT_THRESHOLD))
            .catch(() => setUseViewportMode(false));
    }, []);

    const refetch = useCallback(async () => {
        if (useViewportMode === null) return;
        setLoading(true);
        setError(null);
        try {
            let rows: Record<string, unknown>[];
            if (useViewportMode && bbox) {
                rows = await fetchClientesGeoInViewport(bbox);
            } else {
                rows = await fetchClientesGeo();
            }
            setData(Array.isArray(rows) ? (rows as unknown as ClienteGeo[]) : []);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar clientes';
            console.error('[useClientesGeo]', msg);
            setError(msg);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [useViewportMode, bbox]);

    useEffect(() => { refetch(); }, [refetch]);

    return { data, loading, error, refetch };
}

export function useTerrenos() {
    const [data, setData] = useState<TerrenoGeo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await fetchTerrenosAtivos();
            setData(Array.isArray(rows) ? (rows as unknown as TerrenoGeo[]) : []);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar terrenos';
            console.error('[useTerrenos]', msg);
            setError(msg);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refetch(); }, [refetch]);
    return { data, loading, error, refetch };
}

/**
 * Fetches terrenos that intersect the given viewport bbox.
 * Uses R-Tree for efficient spatial queries at zoom >= 12.
 * Falls back to centroid-based filtering at lower zoom levels.
 */
export function useTerrenosInViewport(
    bbox: [number, number, number, number] | null,
    zoom: number
) {
    const [data, setData] = useState<TerrenoGeo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!bbox) { setLoading(false); return; }

        setLoading(true);
        setError(null);

        const useRtree = zoom >= 12;

        try {
            const rows = useRtree
                ? await fetchTerrenosInViewportRtree(bbox)
                : await fetchTerrenosInViewportCentroid(bbox);
            setData(Array.isArray(rows) ? (rows as unknown as TerrenoGeo[]) : []);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar terrenos do viewport';
            console.error('[useTerrenosInViewport]', msg);
            setError(msg);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [bbox, zoom]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}

export interface TerrenosExtent {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
}

export function useTerrenosExtent() {
    const [extent, setExtent] = useState<TerrenosExtent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetchTerrenosExtent();
            if (r && r.min_lng != null && r.min_lat != null && r.max_lng != null && r.max_lat != null) {
                setExtent({ minLng: r.min_lng, minLat: r.min_lat, maxLng: r.max_lng, maxLat: r.max_lat });
            } else {
                setExtent(null);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar extent';
            console.error('[useTerrenosExtent]', msg);
            setError(msg);
            setExtent(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refetch(); }, [refetch]);

    return { extent, loading, error, refetch };
}

export function useGeoLayers() {
    const [data, setData] = useState<GeoLayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await fetchGeoLayers();
            setData(Array.isArray(rows) ? (rows as unknown as GeoLayer[]) : []);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar camadas';
            console.error('[useGeoLayers]', msg);
            setError(msg);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refetch(); }, [refetch]);
    return { data, loading, error, refetch };
}

export function useItinerario(roteiroId: string | null) {
    const [data, setData] = useState<ItinerarioStop[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!roteiroId) { setData([]); return; }
        setLoading(true);
        setError(null);
        fetchItinerario(roteiroId)
            .then(rows => setData(Array.isArray(rows) ? (rows as unknown as ItinerarioStop[]) : []))
            .catch(err => {
                const msg = err instanceof Error ? err.message : 'Erro ao carregar itinerário';
                console.error('[useItinerario]', msg);
                setError(msg);
                setData([]);
            })
            .finally(() => setLoading(false));
    }, [roteiroId]);

    return { data, loading, error };
}

// ─── ADR-039: Camadas de execução ─────────────────────────────────────────────

export interface ExecucaoClienteGeo {
    id: string;
    execucao_id: string;
    cliente_id: string;
    cliente_nome: string;
    endereco: string | null;
    coleta_realizada: number;
    horario_visita: string | null;
    latitude: number;
    longitude: number;
}

export interface IntercorrenciaGeo {
    id: string;
    execucao_id: string;
    tipo_nome: string;
    tipo_cor: string;
    descricao: string | null;
    resolvido: number;
    registrado_em: string;
    latitude: number;
    longitude: number;
}

export interface ChecklistGeo {
    id: string;
    execucao_id: string;
    item: string;
    concluido: number;
    evidencia_url: string | null;
    latitude: number;
    longitude: number;
}

export function useExecucaoGeo(execucaoId: string | null) {
    const [data, setData] = useState<ExecucaoClienteGeo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!execucaoId) { setData([]); return; }
        setLoading(true);
        setError(null);
        fetchExecucaoGeo(execucaoId)
            .then(rows => setData(Array.isArray(rows) ? (rows as unknown as ExecucaoClienteGeo[]) : []))
            .catch(err => {
                const msg = err instanceof Error ? err.message : 'Erro ao carregar execução';
                console.error('[useExecucaoGeo]', msg);
                setError(msg);
                setData([]);
            })
            .finally(() => setLoading(false));
    }, [execucaoId]);

    return { data, loading, error };
}

export function useIntercorrenciasGeo(execucaoId: string | null) {
    const [data, setData] = useState<IntercorrenciaGeo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!execucaoId) { setData([]); return; }
        setLoading(true);
        setError(null);
        fetchIntercorrenciasGeo(execucaoId)
            .then(rows => setData(Array.isArray(rows) ? (rows as unknown as IntercorrenciaGeo[]) : []))
            .catch(err => {
                const msg = err instanceof Error ? err.message : 'Erro ao carregar intercorrências';
                console.error('[useIntercorrenciasGeo]', msg);
                setError(msg);
                setData([]);
            })
            .finally(() => setLoading(false));
    }, [execucaoId]);

    return { data, loading, error };
}

export function useChecklistGeo(execucaoId: string | null) {
    const [data, setData] = useState<ChecklistGeo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!execucaoId) { setData([]); return; }
        setLoading(true);
        setError(null);
        fetchChecklistGeo(execucaoId)
            .then(rows => setData(Array.isArray(rows) ? (rows as unknown as ChecklistGeo[]) : []))
            .catch(err => {
                const msg = err instanceof Error ? err.message : 'Erro ao carregar checklist';
                console.error('[useChecklistGeo]', msg);
                setError(msg);
                setData([]);
            })
            .finally(() => setLoading(false));
    }, [execucaoId]);

    return { data, loading, error };
}

// ─── Mutações terrenos ─────────────────────────────────────────────────────────

export async function saveTerrenosBatch(
    terrenos: Array<{
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
    }>,
    onProgress?: (done: number, total: number) => void
): Promise<number> {
    if (terrenos.length === 0) return 0;
    const now = new Date().toISOString();
    const BATCH_SIZE = 50;
    let inserted = 0;

    for (let i = 0; i < terrenos.length; i += BATCH_SIZE) {
        const batch = terrenos.slice(i, Math.min(i + BATCH_SIZE, terrenos.length));
        let batchInserted = 0;
        for (const t of batch) {
            try {
                const bbox = extractBbox(t.geojson);
                await insertTerrenoOrIgnore({
                    id: t.id,
                    nome: t.nome,
                    codigo_cadastral: t.codigo_cadastral,
                    tipo: t.tipo,
                    geojson: t.geojson,
                    centroid_lat: t.centroid_lat,
                    centroid_lng: t.centroid_lng,
                    area_m2: t.area_m2,
                    bairro: t.bairro,
                    logradouro: t.logradouro,
                    numero: t.numero,
                    cidade: t.cidade,
                    estado: t.estado,
                    criado_por: t.criado_por,
                    criado_em: now,
                    atualizado_em: now,
                    bbox: bbox ?? undefined,
                });
                if (bbox) {
                    await upsertTerrenosRtree({ bbox, terreno_id: t.id });
                }
                batchInserted++;
            } catch { /* ignora duplicatas */ }
        }
        inserted += batchInserted;
        onProgress?.(inserted, terrenos.length);
        await new Promise(r => setTimeout(r, 0));
    }
    return inserted;
}

export async function deleteTerrenoById(id: string): Promise<void> {
    await deleteTerrenoByIdSafe(id);
}

// ─── Mutações camadas_geo ───────────────────────────────────────────────────────

export async function saveGeoLayer(layer: {
    id: string;
    nome: string;
    tipo: string;
    categoria: string;
    geojson: string;
    cor: string;
    criado_por?: string | null;
}): Promise<void> {
    const now = new Date().toISOString();
    await upsertGeoLayer({
        id: layer.id,
        nome: layer.nome,
        tipo: layer.tipo,
        categoria: layer.categoria,
        geojson: layer.geojson,
        cor: layer.cor,
        criado_por: layer.criado_por,
        criado_em: now,
        atualizado_em: now,
    });
}

export async function toggleGeoLayerVisivel(id: string, visivel: boolean): Promise<void> {
    await toggleGeoLayerVisivelLookup(id, visivel);
}

export async function deleteGeoLayer(id: string): Promise<void> {
    await deleteGeoLayerLookup(id);
}
