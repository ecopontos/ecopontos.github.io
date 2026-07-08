import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const malhaPath = root + 'malha_OSM.geojson';
if (!existsSync(malhaPath)) {
  throw new Error('malha_OSM.geojson não encontrado em: ' + malhaPath);
}
const fc = JSON.parse(readFileSync(malhaPath, 'utf8'));
if (!Array.isArray(fc.features)) {
  throw new Error('GeoJSON inválido: propriedade "features" ausente ou não é um array');
}

const round = (c) => c.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
const slim = {
  type: 'FeatureCollection',
  features: fc.features
    .filter((f) => f.geometry?.type === 'LineString')
    .map((f) => ({
      type: 'Feature',
      properties: { name: f.properties?.name ?? null, highway: f.properties?.highway ?? '' },
      geometry: { type: 'LineString', coordinates: round(f.geometry.coordinates) },
    })),
};

const b64 = gzipSync(Buffer.from(JSON.stringify(slim)), { level: 9 }).toString('base64');
writeFileSync(fileURLToPath(new URL('../data/malha.gz.b64.js', import.meta.url)),
  `export const MALHA_GZ_B64 = ${JSON.stringify(b64)};\n`);
console.log(`malha: ${slim.features.length} linhas, blob ${(b64.length / 1024 / 1024).toFixed(2)} MB (base64)`);
