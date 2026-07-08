export function getSelectedEngine() {
  return document.getElementById('engine').value;
}

export function renderFileList(entries) {
  const ul = document.getElementById('files');
  ul.innerHTML = '';
  for (const e of entries) {
    const li = document.createElement('li');
    li.textContent = `${e.name} — ${e.status}`;
    ul.appendChild(li);
  }
}

export function renderSummaryTable(resultados) {
  const t = document.getElementById('summary');
  const cols = ['arquivo', 'placa', 'dia', 'inicio', 'fim', 'n_ruas', 'n_pontos', 'dist_total_km', 'pct_dist_acima_30m'];
  const fmt = (v) => (v instanceof Date ? v.toLocaleString('pt-BR') : v);
  const head = `<tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>`;
  const body = resultados.map(({ result }) =>
    `<tr>${cols.map((c) => `<td>${fmt(result.resumo[c])}</td>`).join('')}</tr>`).join('');
  t.innerHTML = head + body;
}
