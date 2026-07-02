/**
 * Geometria leve (Fase 3 — georreferenciamento).
 * O projeto mantém geo-math próprio em vez de depender de turf (ver ADR-038).
 *
 * Convenção de coordenadas: `[lng, lat]` (GeoJSON), igual ao resto do app
 * (computeCentroid em useMapData.ts).
 */

/** Coordenada `[lng, lat]`. */
export type LngLat = [number, number];

/**
 * Point-in-polygon por ray-casting. Suporta Polygon e MultiPolygon do GeoJSON.
 * Retorna `false` para geometrias inválidas (não lança).
 */
export function pointInPolygon(point: LngLat, geojson: unknown): boolean {
    if (!Array.isArray(point) || point.length < 2) return false;
    const [x, y] = point;
    if (typeof x !== "number" || typeof y !== "number" || Number.isNaN(x) || Number.isNaN(y)) return false;

    const gj = geojson as { type?: string; coordinates?: unknown };
    if (!gj || typeof gj !== "object") return false;

    if (gj.type === "Polygon") {
        return pointInPolygonRings([x, y], gj.coordinates as number[][][]);
    }
    if (gj.type === "MultiPolygon") {
        const polys = (gj.coordinates as number[][][][]) ?? [];
        for (const poly of polys) {
            if (pointInPolygonRings([x, y], poly)) return true;
        }
        return false;
    }
    return false;
}

function pointInPolygonRings(point: [number, number], rings: number[][][]): boolean {
    if (!Array.isArray(rings) || rings.length === 0) return false;
    const [x, y] = point;
    // Primeiro anel = exterior; demais = buracos. Dentro do exterior e fora dos buracos.
    const inside = rayCast([x, y], rings[0]);
    if (!inside) return false;
    for (let i = 1; i < rings.length; i++) {
        if (rayCast([x, y], rings[i])) return false; // está num buraco
    }
    return true;
}

function rayCast(point: [number, number], ring: number[][]): boolean {
    const [x, y] = point;
    let inside = false;
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = (yi > y) !== (yj > y) &&
            x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-18) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Distância great-circle em metros entre dois pontos `[lng, lat]`.
 * Fórmula de Haversine com raio terrestre médio 6371000 m.
 */
export function haversineMeters(a: LngLat, b: LngLat): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
