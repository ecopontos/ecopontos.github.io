/**
 * ADR-014 Fase A: bundle ecoforms-core → mobile/www/js/ecoforms-core.js
 * Run via: npm run build-core (chamado automaticamente pelo npm run build)
 */
import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

await build({
    entryPoints: [path.join(root, 'packages/core/src/index.ts')],
    outfile: path.join(__dirname, '../www/js/ecoforms-core.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: false,
});

console.log('[build-core] ecoforms-core.js gerado em www/js/');
