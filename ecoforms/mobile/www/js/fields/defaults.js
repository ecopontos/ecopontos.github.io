// Shared defaults helper for fields (centraliza defaultToNow, dynamic defaults e formatos)
//
// Context object (second argument):
//   { now?: Date|Function, user?: {nome?,name?,email?}, device?: {location?}, formValues?: Record<string,any> }
// Backward compat: passing Date/Function/number as second arg is treated as { now: value }

const _visitedFields = new Set();

function _getUserFromGlobal() {
  try {
    if (typeof window !== 'undefined' && window.authManager && window.authManager.currentUser) {
      return window.authManager.currentUser;
    }
  } catch (_) { /* offline / not initialized */ }
  return null;
}

function _resolveUserField(field, context) {
  if (context && context.user) return context.user;

  // Fallback to global authManager
  const globalUser = _getUserFromGlobal();
  if (globalUser) return globalUser;

  return null;
}

function _resolveFormField(fieldName, formValues, currentFieldId) {
  if (!formValues || typeof formValues !== 'object') return undefined;

  // Cycle detection
  if (_visitedFields.has(currentFieldId)) {
    console.warn(`[defaults] Referencia ciclica detectada no campo "${currentFieldId}" ao resolver "form.${fieldName}"`);
    return null;
  }

  _visitedFields.add(currentFieldId);
  const value = formValues[fieldName];
  _visitedFields.delete(currentFieldId);

  return value !== undefined ? value : null;
}

export function getBrazilDateTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: parts.month,
    day: parts.day,
    hours: parts.hour,
    minutes: parts.minute,
    seconds: parts.second
  };
}

function _formatDefaultToNow(field, _now) {
  const t = (field.type || field.tipo || '').toString();
  const brazilNow = getBrazilDateTimeParts(_now);

  if (t === 'datetime-local' || t === 'datetime') {
    return `${brazilNow.year}-${brazilNow.month}-${brazilNow.day}T${brazilNow.hours}:${brazilNow.minutes}`;
  }
  if (t === 'date') {
    return `${brazilNow.year}-${brazilNow.month}-${brazilNow.day}`;
  }
  if (t === 'time') {
    return `${brazilNow.hours}:${brazilNow.minutes}`;
  }
  return null;
}

function _getTypeFallback(field) {
  switch (field.type) {
    case 'number':
      return 0;
    case 'checkbox':
      return false;
    case 'chips':
    case 'chipsmultiple':
      return [];
    case 'select':
    case 'radio':
      if (field.defaultValue !== undefined) return field.defaultValue;
      return field.multiple ? [] : '';
    case 'file':
      return null;
    default:
      return field.defaultValue !== undefined ? field.defaultValue : '';
  }
}

export function computeDefaultValue(field = {}, context = null) {
  // Backward compat: accept Date, function, or number as shorthand for { now: value }
  let _now = new Date();
  let _user = null;
  let _device = null;
  let _formValues = {};

  if (context instanceof Date) {
    _now = context;
  } else if (typeof context === 'function') {
    _now = context();
  } else if (context && typeof context === 'object') {
    if (context.now instanceof Date) _now = context.now;
    else if (typeof context.now === 'function') _now = context.now();
    else if (context.now) _now = new Date(context.now);
    _user = context.user || null;
    _device = context.device || null;
    _formValues = context.formValues || {};
  }

  // If explicit value provided, use it
  if (field.value !== undefined && field.value !== null) return field.value;

  // Dynamic default expressions via field.default (spec: DefaultExpression)
  const defaultExpr = field.default;
  if (typeof defaultExpr === 'string') {
    switch (defaultExpr) {
      case 'now':
        return _formatDefaultToNow(field, _now);
      case 'user.name': {
        const u = _resolveUserField('nome', { user: _user });
        return (u && (u.nome || u.name)) || '';
      }
      case 'user.email': {
        const u = _resolveUserField('email', { user: _user });
        return (u && u.email) || '';
      }
      case 'device.location':
        return (_device && _device.location) || null;
    }
    // form.fieldX cross-field reference
    if (defaultExpr.startsWith('form.')) {
      const fieldName = defaultExpr.substring(5);
      const resolved = _resolveFormField(fieldName, _formValues, field.id || field.name);
      return resolved;
    }
  }

  // Legacy defaultToNow (boolean flag)
  if (field.defaultToNow) {
    const nowVal = _formatDefaultToNow(field, _now);
    if (nowVal !== null) return nowVal;
  }

  // Type-specific fallbacks
  return _getTypeFallback(field);
}

// Expose to global for legacy inline scripts
if (typeof window !== 'undefined') {
  window.computeDefaultValue = computeDefaultValue;
}
