/**
 * ActionRegistry (Mobile) — espelho do desktop/src/application/actions/ActionRegistry.ts
 *
 * Registra acoes de workflow para o mobile usando os mesmos IDs canonicos
 * definidos em UNIVERSAL_ACTIONS. O mobile so publica eventos via SyncAdapter;
 * as acoes efetivas (INSERT/UPDATE) sao executadas pelo desktop.
 *
 * IDs canonicos (AD-016):
 *   aceitar, rejeitar, devolver, reencaminhar, encaminhar, solicitar, criar_tarefa
 */

const registry = new Map();

export function registerAction(config) {
  if (registry.has(config.id)) {
    console.warn(`Action "${config.id}" ja registrada — sobrescrevendo.`);
  }
  registry.set(config.id, config);
}

export function getAction(id) {
  return registry.get(id) || null;
}

export function getAvailableActions(formData, userRole) {
  return Array.from(registry.values()).filter((action) => {
    if (action.requiredRoles && !action.requiredRoles.includes(userRole)) return false;
    if (action.enabledWhen) {
      return evaluateVisibilityRules(action.enabledWhen, formData);
    }
    return true;
  });
}

function evaluateVisibilityRules(rules, formData) {
  if (!rules || rules.length === 0) return true;
  return rules.reduce((result, rule, index) => {
    let conditionMet = evaluateCondition(formData[rule.fieldId], rule);
    if (rule.negate) conditionMet = !conditionMet;
    if (index === 0) return conditionMet;
    const logic = rule.logic || 'AND';
    return logic === 'AND' ? result && conditionMet : result || conditionMet;
  }, true);
}

function evaluateCondition(fieldValue, rule) {
  const { operator, value, values } = rule;
  const normalized = fieldValue === undefined || fieldValue === null ? '' : fieldValue;

  switch (operator) {
    case 'eq': return String(normalized) === String(value);
    case 'neq': return String(normalized) !== String(value);
    case 'gt': return Number(normalized) > Number(value);
    case 'gte': return Number(normalized) >= Number(value);
    case 'lt': return Number(normalized) < Number(value);
    case 'lte': return Number(normalized) <= Number(value);
    case 'contains': return String(normalized).toLowerCase().includes(String(value).toLowerCase());
    case 'startsWith': return String(normalized).toLowerCase().startsWith(String(value).toLowerCase());
    case 'endsWith': return String(normalized).toLowerCase().endsWith(String(value).toLowerCase());
    case 'in': return values && values.length > 0 ? values.some(v => String(normalized) === String(v)) : false;
    case 'notIn': return values && values.length > 0 ? !values.some(v => String(normalized) === String(v)) : true;
    case 'empty': return normalized === '' || normalized === null || normalized === undefined || (Array.isArray(normalized) && normalized.length === 0);
    case 'notEmpty': return normalized !== '' && normalized !== null && normalized !== undefined && (!Array.isArray(normalized) || normalized.length > 0);
    default: return true;
  }
}

export function clearActions() {
  registry.clear();
}