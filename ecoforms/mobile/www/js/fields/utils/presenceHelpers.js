// Shared helpers for presence fields
export function normalizeValue(v) {
  try {
    return String(v ?? '').trim().toLowerCase();
  } catch (_) {
    return '';
  }
}

export function isSentinel(v) {
  const s = normalizeValue(v);
  if (!s) return true;
  const sentinels = new Set(['__none__', '__null__', '__empty__']);
  return sentinels.has(s);
}

export function ensureId(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj.id !== undefined && obj.id !== null && obj.id !== '') return obj;
  // attempt to reuse common keys
  if (obj.uuid) { obj.id = obj.uuid; return obj; }
  if (obj.value) { obj.id = obj.value; return obj; }
  if (obj.label) { obj.id = String(obj.label).replace(/\s+/g,'_').toLowerCase(); return obj; }
  if (obj.nome) { obj.id = String(obj.nome).replace(/\s+/g,'_').toLowerCase(); return obj; }
  // fallback generated id
  obj.id = `__gen_${Math.random().toString(36).slice(2,9)}`;
  return obj;
}

export function getGroupValue(formData, groupField) {
  // prefer formData
  try {
    if (formData && formData[groupField] !== undefined && formData[groupField] !== null) return formData[groupField];
  } catch (_) {}
  // fallback to DOM (name or id)
  try {
    if (typeof document !== 'undefined') {
      const el = document.querySelector(`[name="${groupField}"]`) || document.getElementById(groupField);
      if (el) {
        // input/select/textarea
        if ('value' in el) return el.value;
        // data-* or text content
        return el.getAttribute('data-value') || el.textContent || null;
      }
    }
  } catch (_) {}
  return null;
}

// compute a readable contrast color for #RRGGBB (returns '#000' or '#fff')
export function contrastColor(hex) {
  try {
    if (!hex || typeof hex !== 'string') return '#fff';
    const h = hex.replace('#','');
    if (h.length !== 6) return '#fff';
    const r = parseInt(h.substring(0,2),16);
    const g = parseInt(h.substring(2,4),16);
    const b = parseInt(h.substring(4,6),16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#000' : '#fff';
  } catch(_) { return '#fff'; }
}
