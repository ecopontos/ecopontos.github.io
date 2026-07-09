import { loadSchema, validateAgainstSchema } from './schema-validator.js';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateEventEnvelope(envelope) {
  const errors = [];
  if (!isRecord(envelope)) return ['envelope deve ser um objeto'];
  if (envelope.v !== 2) errors.push('v deve ser 2');
  if (!isNonEmptyString(envelope.id)) errors.push('id é obrigatório');
  if (!isNonEmptyString(envelope.type)) errors.push('type é obrigatório');
  if (!isNonEmptyString(envelope.time)) errors.push('time é obrigatório');
  if (!isRecord(envelope.source)) {
    errors.push('source deve ser um objeto');
  } else {
    if (!isNonEmptyString(envelope.source.routing_id)) errors.push('source.routing_id é obrigatório');
    if (!isNonEmptyString(envelope.source.routing_type)) errors.push('source.routing_type é obrigatório');
    if (!isNonEmptyString(envelope.source.module)) errors.push('source.module é obrigatório');
    if (!isNonEmptyString(envelope.source.app_version)) errors.push('source.app_version é obrigatório');
  }
  if (!isRecord(envelope.aggregate)) {
    errors.push('aggregate deve ser um objeto');
  } else {
    if (!isNonEmptyString(envelope.aggregate.type)) errors.push('aggregate.type é obrigatório');
    if (!isNonEmptyString(envelope.aggregate.id)) errors.push('aggregate.id é obrigatório');
  }
  if (envelope.data === null || envelope.data === undefined) {
    errors.push('data é obrigatório');
  } else if (typeof envelope.data !== 'object') {
    errors.push('data deve ser um objeto ou array');
  }
  if (!isNonEmptyString(envelope.checksum)) errors.push('checksum é obrigatório');
  return errors;
}

async function validateBySchema(domain, data) {
  const schema = await loadSchema(domain);
  if (!schema) return [];
  const result = validateAgainstSchema(data, schema);
  return result.valid ? [] : result.errors;
}

export async function validateInboundPayload(envelope) {
  const type = String(envelope.type || '');
  if (type.startsWith('task.')) {
    if (!isRecord(envelope.data)) return ['data deve ser um objeto'];
    return validateBySchema('task', envelope.data);
  }
  if (type === 'client.criado' || type === 'client.atualizado' || type === 'crm.cliente.criado' || type === 'crm.cliente.atualizado') {
    if (!isRecord(envelope.data)) return ['data deve ser um objeto'];
    return validateBySchema('client', envelope.data);
  }
  return [];
}

export async function assertValidInboundEnvelope(envelope) {
  const errors = validateEventEnvelope(envelope);
  if (errors.length > 0) {
    throw new Error(`Invalid EventEnvelope: ${errors.join('; ')}`);
  }
  const payloadErrors = await validateInboundPayload(envelope);
  if (payloadErrors.length > 0) {
    throw new Error(`Invalid EventPayload for ${envelope.type}: ${payloadErrors.join('; ')}`);
  }
}
