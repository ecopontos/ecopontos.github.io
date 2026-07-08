import { toRoutesGeoJSON, toPointsGeoJSON, toRoutesCSV, toBatchCSV } from './outputs.mjs';

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function wireDownloads(resultados) {
  const box = document.getElementById('downloads');
  box.innerHTML = '';
  resultados.forEach(({ trajeto, result }, i) => {
    const tag = `${trajeto.placa}_${trajeto.dia}`;
    const row = document.createElement('div');
    row.style.margin = '4px 0';
    row.innerHTML = `<strong>${trajeto.placa} — ${trajeto.dia}:</strong> `;
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label; b.style.marginRight = '6px';
      b.onclick = fn; row.appendChild(b);
    };
    mk('ruas .geojson', () => download(`ruas_percorridas_${tag}.geojson`,
      JSON.stringify(toRoutesGeoJSON(result.segmentos)), 'application/geo+json'));
    mk('pontos .geojson', () => download(`pontos_gps_matched_${tag}.geojson`,
      JSON.stringify(toPointsGeoJSON(result.pontos_casados)), 'application/geo+json'));
    mk('ruas .csv', () => download(`ruas_percorridas_${tag}.csv`,
      toRoutesCSV(result.segmentos), 'text/csv'));
    box.appendChild(row);
  });
  const b = document.createElement('button');
  b.textContent = 'baixar resumo do lote (.csv)';
  b.onclick = () => download('resumo_lote.csv',
    toBatchCSV(resultados.map((r) => r.result.resumo)), 'text/csv');
  box.appendChild(b);
}
