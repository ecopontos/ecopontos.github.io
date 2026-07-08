import * as XLSX from 'xlsx';
import { findColumns } from './columns.mjs';

export function parseTimestamp(v) {
  if (v instanceof Date) return v;
  const s = String(v).trim();
  // Formato real do CSV do fornecedor: DD/MM/YYYY HH:MM:SS (dia sempre primeiro,
  // sem adivinhação de locale — new Date() nativo interpretaria como MM/DD/YYYY).
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})$/);
  if (br) {
    const [, dd, mm, yyyy, hh, mi, ss] = br;
    const ddN = Number(dd);
    const mmN = Number(mm);
    const hhN = Number(hh);
    const miN = Number(mi);
    const ssN = Number(ss);
    // O construtor Date(y, m, d, ...) do JS nunca retorna NaN para valores
    // fora do intervalo — ele "estoura" silenciosamente para outra data
    // válida (ex.: mês 13 vira janeiro do ano seguinte). Validamos os
    // limites explicitamente para não reintroduzir corrupção silenciosa.
    if (
      mmN < 1 || mmN > 12 ||
      ddN < 1 || ddN > 31 ||
      hhN < 0 || hhN > 23 ||
      miN < 0 || miN > 59 ||
      ssN < 0 || ssN > 59
    ) {
      throw new Error(`Timestamp inválido: ${v}`);
    }
    const d = new Date(Number(yyyy), mmN - 1, ddN, hhN, miN, ssN);
    if (Number.isNaN(d.getTime())) throw new Error(`Timestamp inválido: ${v}`);
    return d;
  }
  // Formato ISO-ish usado pelos fixtures de teste existentes: YYYY-MM-DD HH:MM:SS
  const iso = s.replace(' ', 'T');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Timestamp inválido: ${v}`);
  return d;
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseFile(buffer, filename) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const isCsv = /\.csv$/i.test(String(filename ?? ''));
  // SheetJS's CSV parser misreads UTF-8 bytes as latin1 when given raw
  // 'array' input without a BOM (accented headers like "Ignição" become
  // "IgniÃ§Ã£o"). Decoding to text ourselves and reading as type:'string'
  // avoids the mojibake. XLSX binaries carry their own encoding metadata,
  // so those are read as 'array' unchanged.
  // raw:true desliga a coerção automática de tipo/data do SheetJS, que
  // adivinha datas ambíguas DD/MM/YYYY como MM/DD/YYYY (troca dia/mês).
  // Com raw:true as células de data chegam como string literal e são
  // interpretadas explicitamente por parseTimestamp() acima.
  const wb = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(bytes), { type: 'string', cellDates: true, raw: true })
    : XLSX.read(bytes, { type: 'array', cellDates: true, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (!rows.length) throw new Error(`Arquivo vazio: ${filename}`);
  const idx = findColumns(rows[0].map(String));
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const lat = toNumber(r[idx.lat]);
    const lon = toNumber(r[idx.lon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    out.push({
      seq: 0,
      ts: parseTimestamp(r[idx.ts]),
      lat, lon,
      speed: toNumber(r[idx.speed]) || 0,
      ignicao: String(r[idx.ignicao] ?? ''),
      placa: String(r[idx.placa] ?? '').trim(),
    });
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

export function splitTrajetos(records, filename) {
  const groups = new Map();
  for (const r of records) {
    const key = `${r.placa}|${dayKey(r.ts)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const trajetos = [];
  for (const [key, pts] of groups) {
    pts.sort((a, b) => a.ts - b.ts);
    pts.forEach((p, i) => { p.seq = i + 1; });
    const [placa, dia] = key.split('|');
    trajetos.push({ id: key, placa, dia, arquivo: filename, pontos: pts });
  }
  return trajetos;
}
