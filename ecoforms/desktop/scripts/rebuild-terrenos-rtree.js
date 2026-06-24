#!/usr/bin/env node
/**
 * Reconstrói `terrenos_rtree` a partir de `terrenos.bbox_min/max_lng/lat`.
 *
 * O índice R-Tree foi populado no import original com bbox calculado a
 * partir do geojson ainda em SIRGAS 2000 / UTM 22S (metros), antes da
 * reprojeção (ver scripts/reproject-terrenos.js). Após a reprojeção, as
 * colunas `terrenos.bbox_*` já estão em WGS84, mas `terrenos_rtree` ficou
 * com valores antigos (mistura de metros e graus) — incompatível com as
 * queries de viewport em useTerrenosInViewport (zoom >= 12).
 *
 * Uso: node scripts/rebuild-terrenos-rtree.js [caminho-do-banco]
 */
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_PATH = process.argv[2] || path.join(process.env.APPDATA || '', 'com.ecoforms.desktop', 'ecoforms.db');

console.log(`Banco: ${DB_PATH}`);
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.run(
        `INSERT OR REPLACE INTO terrenos_rtree (id, min_lng, max_lng, min_lat, max_lat)
         SELECT rowid, bbox_min_lng, bbox_max_lng, bbox_min_lat, bbox_max_lat
         FROM terrenos
         WHERE bbox_min_lng IS NOT NULL AND bbox_max_lng IS NOT NULL
           AND bbox_min_lat IS NOT NULL AND bbox_max_lat IS NOT NULL`,
        function (err) {
            if (err) {
                console.error('Erro:', err.message);
                db.close();
                process.exitCode = 1;
                return;
            }
            console.log(`Concluído. linhas afetadas=${this.changes}`);
            db.close();
        }
    );
});
