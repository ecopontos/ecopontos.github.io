import { beforeEach, describe, expect, it, vi } from 'vitest';

const adapterState = {
  query: vi.fn(async () => []),
  execute: vi.fn(async () => {}),
};

vi.mock('../www/js/adapters/CapacitorSqliteAdapter.js', () => ({
  sqliteAdapter: adapterState,
}));

const cryptoState = {
  decryptJson: vi.fn(async () => null),
};

const indexState = {
  pullEvents: vi.fn(async () => []),
};

const eventBusState = {
  dispatch: vi.fn(async () => {}),
};

describe('mobile InboundService', () => {
  beforeEach(() => {
    adapterState.query.mockReset();
    adapterState.execute.mockReset();
    adapterState.query.mockImplementation(async (sql) => {
      if (String(sql).includes('sync_device_log')) return [{ seq: 0 }];
      if (String(sql).includes('log_eventos_aplicados')) return [];
      return [];
    });
    cryptoState.decryptJson.mockReset();
    indexState.pullEvents.mockReset();
    eventBusState.dispatch.mockReset();
  });

  it('rejects malformed payloads before dispatch', async () => {
    const { InboundService } = await import('../www/js/sync/InboundService.js');

    cryptoState.decryptJson.mockResolvedValue({
      v: 2,
      id: 'evt-1',
      type: 'task.criada',
      source: {
        device_id: 'device-1',
        routing_id: 'setor-1',
        routing_type: 'setor',
        module: 'ecoforms-mobile',
        app_version: '1.0.0',
      },
      aggregate: { type: 'task', id: 'task-1' },
      time: '2026-06-15T12:00:00.000Z',
      schema_version: 1,
      seq: 1,
      prev_event_id: null,
      correlation_id: null,
      causation_id: null,
      stream_id: null,
      data: null,
      checksum: 'sha256:test',
    });
    indexState.pullEvents.mockResolvedValue([{ id: 'evt-1', payload_enc: 'enc', seq: 1 }]);
    const inbound = new InboundService(cryptoState, indexState, eventBusState, 'setor-local');
    const result = await inbound.pull(['setor-remote']);

    expect(result.processed).toBe(0);
    expect(result.errors.some((e) => e.includes('Invalid EventEnvelope'))).toBe(true);
    expect(eventBusState.dispatch).not.toHaveBeenCalled();
  });
});
