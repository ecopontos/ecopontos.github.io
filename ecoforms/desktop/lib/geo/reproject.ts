/**
 * Reprojeção de geometrias GeoJSON entre sistemas de referência.
 * Usado para converter cadastros municipais em SIRGAS 2000 / UTM (coordenadas
 * projetadas, em metros) para WGS84 (lon/lat em graus), exigido por
 * GeoJSON/MapLibre e pelos filtros de bbox em SQLite.
 */
import proj4 from 'proj4';

export const EPSG_31982 = 'EPSG:31982';
export const EPSG_31981 = 'EPSG:31981';
export const WGS84 = 'EPSG:4326';

// SIRGAS 2000 / UTM zone 22S — RS/SC, longitude central -51°
proj4.defs(EPSG_31982, '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');
// SIRGAS 2000 / UTM zone 21S — oeste do RS, longitude central -57°
proj4.defs(EPSG_31981, '+proj=utm +zone=21 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');

/**
 * Heurística: coordenadas WGS84 válidas têm lon em [-180,180] e lat em [-90,90].
 * Valores muito maiores (ex.: ~750000/~6950000) indicam CRS projetado (UTM, em metros).
 */
export function looksProjected(coord: number[]): boolean {
    return Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90;
}

function transformRing(ring: number[][], fromEpsg: string): number[][] {
    return ring.map(coord => proj4(fromEpsg, WGS84, [coord[0], coord[1]]));
}

/**
 * Reprojeta uma geometria Polygon/MultiPolygon de `fromEpsg` para WGS84.
 * Retorna uma cópia — não modifica `geom`.
 */
export function reprojectGeometry(geom: GeoJSON.Geometry, fromEpsg: string): GeoJSON.Geometry {
    if (geom.type === 'Polygon') {
        return { type: 'Polygon', coordinates: geom.coordinates.map(ring => transformRing(ring, fromEpsg)) };
    }
    if (geom.type === 'MultiPolygon') {
        return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly => poly.map(ring => transformRing(ring, fromEpsg))) };
    }
    return geom;
}
