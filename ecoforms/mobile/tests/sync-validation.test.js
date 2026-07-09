import { describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { assertValidInboundEnvelope, validateEventEnvelope, validateInboundPayload } from '../www/js/sync/EventValidation.js';
import { validateAgainstSchema } from '../www/js/sync/schema-validator.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

function envelope(type, data) {
  return {
    v: 2,
    id: 'evt-1',
    type,
    source: {
      device_id: 'device-1',
      routing_id: 'setor-1',
      routing_type: 'setor',
      module: 'ecoforms-mobile',
      app_version: '1.0.0',
    },
    aggregate: { type: type.split('.')[0], id: 'agg-1' },
    time: '2026-06-15T12:00:00.000Z',
    schema_version: 1,
    seq: 1,
    prev_event_id: null,
    correlation_id: null,
    causation_id: null,
    stream_id: null,
    data,
    checksum: 'sha256:test',
  };
}

describe('mobile sync validation', () => {
  it('accepts canonical task envelope', async () => {
    const env = envelope('task.criada', {
      id: 'task-1',
      titulo: 'Tarefa',
      status: 'a_fazer',
      prioridade: 'media',
      criado_por: 'user-1',
    });
    expect(validateEventEnvelope(env)).toEqual([]);
    expect(await validateInboundPayload(env)).toEqual([]);
    await expect(assertValidInboundEnvelope(env)).resolves.toBeUndefined();
  });

  it('rejects missing checksum and malformed data before dispatch', async () => {
    const env = envelope('task.criada', null);
    env.checksum = '';
    expect(validateEventEnvelope(env).length).toBeGreaterThan(0);
    await expect(assertValidInboundEnvelope(env)).rejects.toThrow('Invalid EventEnvelope');
  });

  it('rejects invalid task payload by schema', async () => {
    const env = envelope('task.criada', {
      id: 'task-1',
      titulo: 'Tarefa',
      status: 'feito',
      prioridade: 'media',
      criado_por: 'user-1',
    });
    await expect(validateInboundPayload(env)).resolves.toContain('task.status: valor \'feito\' fora do enum ["a_fazer","em_progresso","concluido","cancelado"]');
  });



  it('accepts unknown event payload arrays after envelope validation', async () => {
    const env = envelope('custom.evento', [{ id: 'x1' }]);
    expect(validateEventEnvelope(env)).toEqual([]);
    await expect(validateInboundPayload(env)).resolves.toEqual([]);
  });

  it('rejects null for schema object fields', () => {
    const result = validateAgainstSchema(
      { metadata: null },
      { domain: 'test', required: ['metadata'], fields: { metadata: { type: 'object' } } },
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('test.metadata: esperado object');
  });

  it('accepts client payloads', async () => {
    const env = envelope('client.criado', {
      id: 'cli-1',
      uuid: 'uuid-1',
      Cliente: 'Cliente A',
    });
    expect(await validateInboundPayload(env)).toEqual([]);
  });
});
