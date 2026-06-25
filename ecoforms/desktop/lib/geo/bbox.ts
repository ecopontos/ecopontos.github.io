/**
 * Bounding box extraction from GeoJSON geometry strings.
 * Used for R-Tree spatial indexing in SQLite.
 */

export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

export function extractBbox(geojson: string): Bbox | null {
    try {
        const geom = JSON.parse(geojson);
        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;

        const processCoord = (coord: number[]) => {
            if (coord[0] < minLng) minLng = coord[0];
            if (coord[1] < minLat) minLat = coord[1];
            if (coord[0] > maxLng) maxLng = coord[0];
            if (coord[1] > maxLat) maxLat = coord[1];
        };

        const processRing = (ring: number[][]) => ring.forEach(processCoord);

        if (geom.type === 'Polygon') {
            geom.coordinates.forEach(processRing);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach((poly: number[][][]) => poly.forEach(processRing));
        } else {
            return null;
        }

        if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) {
            return null;
        }

        return [minLng, minLat, maxLng, maxLat];
    } catch {
        return null;
    }
}

export function bboxIntersects(a: Bbox, b: Bbox): boolean {
    return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export function bboxContains(outer: Bbox, inner: Bbox): boolean {
    return inner[0] >= outer[0] && inner[2] <= outer[2] && inner[1] >= outer[1] && inner[3] <= outer[3];
}
