export function normalizeHeader(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const REQUIRED = {
  lat: ['latitude', 'lat'],
  lon: ['longitude', 'lon', 'lng'],
  ts: ['datadoevento', 'dataevento', 'datahora', 'datagps'],
  speed: ['velocidade', 'speed', 'vel'],
  ignicao: ['ignicao'],
  placa: ['placa'],
};

export function findColumns(headers) {
  const norm = headers.map(normalizeHeader);
  const idx = {};
  const missing = [];
  for (const [canon, aliases] of Object.entries(REQUIRED)) {
    const pos = norm.findIndex((h) => aliases.includes(h));
    if (pos === -1) missing.push(canon);
    else idx[canon] = pos;
  }
  if (missing.length) throw new Error(`Colunas faltando: ${missing.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}`);
  return idx;
}
