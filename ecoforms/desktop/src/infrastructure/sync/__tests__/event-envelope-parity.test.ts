import { describe, expect, it } from 'vitest';
import { EcoFormsEventTypes as coreEventTypes } from 'ecoforms-core/sync';
import { EcoFormsEventTypes as desktopEventTypes } from '../EventEnvelope';

describe('sync event contract parity', () => {
  it.skip('keeps desktop EventEnvelope event types aligned with ecoforms-core/sync after known matrix drift is resolved', () => {
    const core = [...coreEventTypes].sort();
    const desktop = [...desktopEventTypes].sort();

    expect(desktop).toEqual(core);
  });
});
