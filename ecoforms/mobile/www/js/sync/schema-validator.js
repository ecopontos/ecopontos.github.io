const schemas = {};

async function loadTaskSchema() {
  const mod = await import('../../../../packages/core/src/sync/schemas/task-schema.json', { assert: { type: 'json' } });
  return mod.default;
}

async function loadClientSchema() {
  const mod = await import('../../../../packages/core/src/sync/schemas/client-schema.json', { assert: { type: 'json' } });
  return mod.default;
}

export async function loadSchema(name) {
  if (schemas[name]) return schemas[name];
  try {
    let schema = null;
    switch (name) {
      case 'task':
        schema = await loadTaskSchema();
        break;
      case 'client':
        schema = await loadClientSchema();
        break;
      default:
        schema = null;
    }
    schemas[name] = schema;
    return schema;
  } catch (_) {
    return null;
  }
}

function validateField(value, fieldDef, path) {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return fieldDef.nullable ? null : `${path}: esperado ${fieldDef.type}`;
  }
  if (fieldDef.type === 'string' && typeof value !== 'string') return `${path}: esperado string`;
  if (fieldDef.type === 'number' && typeof value !== 'number') return `${path}: esperado number`;
  if (fieldDef.type === 'boolean' && typeof value !== 'boolean') return `${path}: esperado boolean`;
  if (fieldDef.type === 'array' && !Array.isArray(value)) return `${path}: esperado array`;
  if (fieldDef.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) return `${path}: esperado object`;
  if (fieldDef.enum && !fieldDef.enum.includes(value)) return `${path}: valor '${value}' fora do enum ${JSON.stringify(fieldDef.enum)}`;
  return null;
}

export function validateAgainstSchema(data, schema) {
  if (!schema || !schema.fields) {
    return { valid: true, errors: [] };
  }
  const errors = [];
  for (const [name, def] of Object.entries(schema.fields)) {
    if (data[name] === undefined) {
      if (schema.required && schema.required.includes(name)) {
        errors.push(`${schema.domain}.${name}: campo obrigatorio ausente`);
      }
      continue;
    }
    const err = validateField(data[name], def, `${schema.domain}.${name}`);
    if (err) errors.push(err);
  }
  return { valid: errors.length === 0, errors };
}
