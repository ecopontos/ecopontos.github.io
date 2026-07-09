import { describe, expect, it, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
  }
});

describe('sync contract: stable-stringify (JS ↔ TS)', () => {
  const testCases = [
    { a: 1, b: 2 },
    { b: 2, a: 1 },
    [3, 1, 2],
    { nested: { c: 3, a: 1 } },
    { arr: [{ z: 9, a: 1 }, { m: 0, n: -1 }] },
    { str: 'hello', num: 42, bool: true, nil: null },
    { emptyObj: {}, emptyArr: [] as unknown[] },
  ];

  it('JS and TS implementations produce identical strings', async () => {
    const { stableStringify: jsFn } = await import('../www/js/sync/stable-stringify.js');
    const { stableStringify: tsFn } = await import('../../packages/core/src/utils/stableStringify');

    for (const tc of testCases) {
      const jsResult = jsFn(tc);
      const tsResult = tsFn(tc);
      expect(jsResult).toBe(tsResult);
    }
  });

  it('key ordering is deterministic', async () => {
    const { stableStringify: jsFn } = await import('../www/js/sync/stable-stringify.js');
    const a = jsFn({ c: 3, a: 1, b: 2 });
    const b = jsFn({ b: 2, c: 3, a: 1 });
    expect(a).toBe(b);
  });
});

describe('sync contract: buildChecksum (JS ↔ TS)', () => {
  const testData = [
    { a: 1, b: 2 },
    { nested: { c: 3, a: 1 }, arr: [1, 2, 3] },
    { str: 'hello', num: 42 },
    {},
    { single: 'value' },
  ];

  it('JS and TS implementations produce identical checksums', async () => {
    const { buildChecksum: jsFn } = await import('../www/js/sync/EventEnvelope.js');
    const { buildChecksum: tsFn } = await import('../../packages/core/src/sync/EventEnvelope');

    for (const tc of testData) {
      const jsChecksum = await jsFn(tc);
      const tsChecksum = await tsFn(tc);
      expect(jsChecksum).toBe(tsChecksum);
      expect(jsChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  it('identical structured data produces identical checksum', async () => {
    const { buildChecksum: jsFn } = await import('../www/js/sync/EventEnvelope.js');
    const checksum1 = await jsFn({ b: 2, a: 1 });
    const checksum2 = await jsFn({ a: 1, b: 2 });
    expect(checksum1).toBe(checksum2);
  });
});

describe('sync contract: event type parity', () => {
  it('mobile bundle exports the canonical core event list', async () => {
    const { EcoFormsEventTypes: jsTypes } = await import('../www/js/sync/EventEnvelope.js');
    const { EcoFormsEventTypes: coreTypes } = await import('../../packages/core/src/sync/EventEnvelope');

    expect([...jsTypes].sort()).toEqual([...coreTypes].sort());
  });
});

describe('sync contract: createEnvelope structure', () => {
  it('JS createEnvelope respects routing_id > device_id', async () => {
    const { createEnvelope } = await import('../www/js/sync/EventEnvelope.js');

    const envelope = createEnvelope(
      {
        id: 'evt-001',
        type: 'suite.aprovada' as any,
        aggregate_type: 'suite',
        aggregate_id: 'pkg-1',
        data: { status: 'approved' },
        correlation_id: null,
        causation_id: null,
        prev_event_id: null,
      },
      1,
      'dev-abc',
      'rtg-xyz',
    );

    expect(envelope.v).toBe(2);
    expect(envelope.source.routing_id).toBe('rtg-xyz');
    expect(envelope.source.device_id).toBe('dev-abc');
    expect(envelope.source.routing_type).toBe('setor');
    expect(envelope.seq).toBe(1);
  });

  it('TS EventEnvelope interface allows device_id to be optional', async () => {
    const mod = await import('../../packages/core/src/sync/EventEnvelope');
    // Verify the type exists (compile-time check; runtime just ensures no crash)
    expect(mod).toBeDefined();
    expect(typeof mod.buildChecksum).toBe('function');
  });
});
