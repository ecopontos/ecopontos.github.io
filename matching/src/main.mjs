import { MALHA_GZ_B64 } from '../data/malha.gz.b64.js';
import { decodeNetworkBrowser } from './decode-browser.mjs';
import { roadsFromGeoJSON, buildNetwork } from './roadnetwork.mjs';
import { parseFile, splitTrajetos } from './parse.mjs';
import { runMatching } from './engine.mjs';
import { runMatchingDuckDB } from './engine-duckdb.mjs';
import { getSelectedEngine, renderFileList, renderSummaryTable } from './ui.mjs';
import { renderMap } from './map.mjs';
import { wireDownloads } from './downloads.mjs';

let NET = null;
window.__resultados = [];

async function processFiles(fileList) {
  const entries = [...fileList].map((f) => ({ name: f.name, status: 'processando…' }));
  renderFileList(entries);
  const engine = getSelectedEngine();
  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const trajetos = splitTrajetos(parseFile(buf, f.name), f.name);
      for (const trajeto of trajetos) {
        const result = await runMatching(trajeto, NET, {
          engine,
          duckdbFn: engine === 'duckdb' ? runMatchingDuckDB : null,
          onFallback: () => { entries[i].status = 'DuckDB indisponível → usei JS'; renderFileList(entries); },
        });
        // Dedupe por trajeto.id (placa|dia): reenviar o mesmo arquivo (ou um
        // arquivo cobrindo a mesma placa+dia) substitui a entrada anterior
        // em vez de duplicá-la na tabela/mapa/downloads. A acumulação entre
        // uploads distintos é intencional e deve ser preservada.
        window.__resultados = window.__resultados.filter((r) => r.trajeto.id !== trajeto.id);
        window.__resultados.push({ trajeto, result });
      }
      entries[i].status = entries[i].status?.includes('JS') ? entries[i].status : 'pronto';
    } catch (err) {
      entries[i].status = `erro: ${err.message}`;
    }
    renderFileList(entries);
  }
  renderSummaryTable(window.__resultados);
  renderMap(NET, window.__resultados);
  wireDownloads(window.__resultados);
}

async function boot() {
  const fc = await decodeNetworkBrowser(MALHA_GZ_B64);
  NET = buildNetwork(roadsFromGeoJSON(fc));
  document.getElementById('status').textContent = `Malha carregada: ${NET.roads.length} vias. Solte seus arquivos.`;
  const drop = document.getElementById('drop');
  const input = document.getElementById('file');
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => processFiles(input.files));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.background = '#eef'; });
  drop.addEventListener('dragleave', () => { drop.style.background = ''; });
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.style.background = '';
    processFiles(e.dataTransfer.files);
  });
}
boot();
