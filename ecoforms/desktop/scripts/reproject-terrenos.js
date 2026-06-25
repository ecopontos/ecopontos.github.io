#!/usr/bin/env node
/**
 * Migração one-off: reprojeta `terrenos.geojson` (e centroid_lat/lng, area_m2,
 * bbox_*) de SIRGAS 2000 / UTM 22S (EPSG:31982) para WGS84 (EPSG:4326).
 *
 * Cadastros municipais importados via TerrenoImport.tsx antes da reprojeção
 * automática ficaram com coordenadas projetadas (metros), incompatíveis com
 * GeoJSON/MapLibre e com os filtros de bbox em useTerrenosInViewport.
 *
 * Uso: node scripts/reproject-terrenos.js [caminho-do-banco]
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const proj4 = require('proj4');

proj4.defs('EPSG:31982', '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');

const DB_PATH = process.argv[2] || path.join(process.env.APPDATA || '', 'com.ecoforms.desktop', 'ecoforms.db');

function looksProjected(coord) {
    return Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90;
}

function transformRing(ring) {
    return ring.map(c => proj4('EPSG:31982', 'EPSG:4326', [c[0], c[1]]));
}

function reprojectGeometry(geom) {
    if (geom.type === 'Polygon') {
        return { type: 'Polygon', coordinates: geom.coordinates.map(transformRing) };
    }
    if (geom.type === 'MultiPolygon') {
        return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly => poly.map(transformRing)) };
    }
    return geom;
}

function ringCentroid(ring) {
    const n = ring.length - 1;
    let sumLng = 0, sumLat = 0;
    for (let i = 0; i < n; i++) { sumLng += ring[i][0]; sumLat += ring[i][1]; }
    return [sumLng / n, sumLat / n];
}

function ringAreaM2(ring) {
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

function computeCentroid(geom) {
    if (geom.type === 'Polygon') return ringCentroid(geom.coordinates[0]);
    if (geom.type === 'MultiPolygon') {
        let totalArea = 0, weightedLng = 0, weightedLat = 0;
        for (const polygon of geom.coordinates) {
            const area = ringAreaM2(polygon[0]);
            const [lng, lat] = ringCentroid(polygon[0]);
            totalArea += area;
            weightedLng += lng * area;
            weightedLat += lat * area;
        }
        return totalArea > 0 ? [weightedLng / totalArea, weightedLat / totalArea] : ringCentroid(geom.coordinates[0][0]);
    }
    return null;
}

function computeAreaM2(geom) {
    if (geom.type === 'Polygon') return ringAreaM2(geom.coordinates[0]);
    if (geom.type === 'MultiPolygon') {
        let total = 0;
        for (const polygon of geom.coordinates) total += ringAreaM2(polygon[0]);
        return total;
    }
    return null;
}

function extractBbox(geom) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    const processCoord = (c) => {
        if (c[0] < minLng) minLng = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[0] > maxLng) maxLng = c[0];
        if (c[1] > maxLat) maxLat = c[1];
    };
    const processRing = (ring) => ring.forEach(processCoord);
    if (geom.type === 'Polygon') geom.coordinates.forEach(processRing);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(poly => poly.forEach(processRing));
    else return null;
    if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) return null;
    return [minLng, minLat, maxLng, maxLat];
}

console.log(`Banco: ${DB_PATH}`);
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.all('SELECT id, geojson FROM terrenos', [], (err, rows) => {
        if (err) { console.error('Erro ao ler terrenos:', err.message); db.close(); process.exitCode = 1; return; }
        console.log(`Total: ${rows.length} terrenos`);

        const update = db.prepare(`UPDATE terrenos SET geojson=?, centroid_lat=?, centroid_lng=?, area_m2=?,
            bbox_min_lng=?, bbox_min_lat=?, bbox_max_lng=?, bbox_max_lat=?, atualizado_em=datetime('now') WHERE id=?`);

        let migrated = 0, skipped = 0, errors = 0;
        db.run('BEGIN');
        for (const row of rows) {
            try {
                const geom = JSON.parse(row.geojson);
                const coord = geom.type === 'Polygon' ? geom.coordinates[0]?.[0]
                    : geom.type === 'MultiPolygon' ? geom.coordinates[0]?.[0]?.[0]
                    : null;
                if (!coord || !looksProjected(coord)) { skipped++; continue; }

                const reprojected = reprojectGeometry(geom);
                const centroid = computeCentroid(reprojected);
                const area = computeAreaM2(reprojected);
                const bbox = extractBbox(reprojected);

                update.run(
                    JSON.stringify(reprojected),
                    centroid ? centroid[1] : null,
                    centroid ? centroid[0] : null,
                    area != null ? Math.round(area) : null,
                    bbox ? bbox[0] : null,
                    bbox ? bbox[1] : null,
                    bbox ? bbox[2] : null,
                    bbox ? bbox[3] : null,
                    row.id
                );
                migrated++;
                if (migrated % 20000 === 0) console.log(`  ... ${migrated} migrados`);
            } catch (e) {
                errors++;
                console.error(`Erro no terreno ${row.id}:`, e.message);
            }
        }
        update.finalize();
        db.run('COMMIT', (err) => {
            if (err) console.error('Erro no commit:', err.message);
            console.log(`Concluído. migrados=${migrated} skipped=${skipped} erros=${errors}`);
            db.close();
        });
    });
});
