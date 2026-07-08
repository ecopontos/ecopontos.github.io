import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const result = await build({
  entryPoints: [here('../src/main.mjs')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false,
  legalComments: 'none',
});
const appJs = result.outputFiles[0].text;
const leafletCss = readFileSync(here('../node_modules/leaflet/dist/leaflet.css'), 'utf8');
const template = readFileSync(here('../templates/index.html'), 'utf8');

const html = template
  .replace('/*__LEAFLET_CSS__*/', () => leafletCss)
  .replace('/*__APP_JS__*/', () => appJs);
writeFileSync(here('../matching.html'), html);
console.log(`matching.html gerado: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
