/**
 * Douglas-Peucker geometry simplification for GeoJSON.
 * Preserves polygon topology (no broken rings).
 */

// Tolerance in degrees (approximate)
// zoom 16: ~1m → 0.00001°
// zoom 14: ~10m → 0.0001°
// zoom 12: ~100m → 0.001°
// zoom 10: ~1km → 0.01°
// zoom 8:  ~10km → 0.1°
const ZOOM_TOLERANCE: Record<number, number> = {
    16: 0.00001,
    15: 0.00002,
    14: 0.00005,
    13: 0.0001,
    12: 0.0002,
    11: 0.0005,
    10: 0.001,
    9:  0.002,
    8:  0.005,
    7:  0.01,
};

export function getTolerance(zoom: number): number {
    const z = Math.max(7, Math.min(16, Math.round(zoom)));
    return ZOOM_TOLERANCE[z];
}

function pointToLineDistance(point: number[], lineStart: number[], lineEnd: number[]): number {
    const [px, py] = point;
    const [ax, ay] = lineStart;
    const [bx, by] = lineEnd;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return Math.hypot(px - ax, py - ay);

    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = ax + t * dx;
    const projY = ay + t * dy;

    return Math.hypot(px - projX, py - projY);
}

function simplifyRing(ring: number[][], tolerance: number): number[][] {
    if (ring.length <= 3) return ring;

    let maxDist = 0;
    let maxIdx = 0;
    const first = ring[0];
    const last = ring[ring.length - 1];

    for (let i = 1; i < ring.length - 1; i++) {
        const dist = pointToLineDistance(ring[i], first, last);
        if (dist > maxDist) {
            maxDist = dist;
            maxIdx = i;
        }
    }

    if (maxDist > tolerance) {
        const left = ring.slice(0, maxIdx + 1);
        const right = ring.slice(maxIdx);
        const simplifiedLeft = simplifyRing(left, tolerance);
        const simplifiedRight = simplifyRing(right, tolerance);
        return [...simplifiedLeft.slice(0, -1), ...simplifiedRight];
    }

    return [first, last];
}

function ensureRingClosed(ring: number[][]): number[][] {
    if (ring.length < 3) return ring;
    const [first] = ring;
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        return [...ring, [...first]];
    }
    return ring;
}

export function simplifyPolygon(coords: number[][][], tolerance: number): number[][][] {
    return coords
        .map(ring => ensureRingClosed(simplifyRing(ring, tolerance)))
        .filter(ring => ring.length >= 4); // min 4 points for closed ring
}

export function simplifyMultiPolygon(coords: number[][][][], tolerance: number): number[][][][] {
    return coords
        .map(polygon => simplifyPolygon(polygon, tolerance))
        .filter(polygon => polygon.length > 0);
}

export function simplifyGeometry(geom: GeoJSON.Geometry, tolerance: number): GeoJSON.Geometry {
    if (geom.type === 'Polygon') {
        return { ...geom, coordinates: simplifyPolygon(geom.coordinates, tolerance) };
    }
    if (geom.type === 'MultiPolygon') {
        return { ...geom, coordinates: simplifyMultiPolygon(geom.coordinates, tolerance) };
    }
    return geom;
}

export function countVertices(geom: GeoJSON.Geometry): number {
    if (geom.type === 'Polygon') {
        return geom.coordinates.reduce((sum, ring) => sum + ring.length, 0);
    }
    if (geom.type === 'MultiPolygon') {
        return geom.coordinates.reduce(
            (sum, polygon) => sum + polygon.reduce((s, ring) => s + ring.length, 0),
            0
        );
    }
    return 0;
}
