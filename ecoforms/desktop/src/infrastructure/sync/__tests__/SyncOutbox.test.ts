import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock de lazy-sync: getTransport/getLanTransport controlados.
const getTransportMock = vi.fn();
const getLanTransportMock = vi.fn();
vi.mock('../lazy-sync', () => ({
    getTransport: () => getTransportMock(),
    getLanTransport: () => getLanTransportMock(),
}));

import { SyncOutbox } from '../SyncOutbox';

describe('SyncOutbox', () => {
    beforeEach(() => {
        getTransportMock.mockReset();
        getLanTransportMock.mockReset();
    });

    it('loga warning e descarta evento quando transport é null', async () => {
        getTransportMock.mockReturnValue(null);
        getLanTransportMock.mockReturnValue(null);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const outbox = new SyncOutbox();
        await outbox.write('task.criada', { id: 't-1' });

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[SyncOutbox] transport not ready'),
            'task.criada',
        );
        warnSpy.mockRestore();
    });

    it('publica no transport quando disponível', async () => {
        const publish = vi.fn().mockResolvedValue(undefined);
        getTransportMock.mockReturnValue({ publish });
        getLanTransportMock.mockReturnValue(null);

        const outbox = new SyncOutbox();
        await outbox.write('task.criada', { id: 't-1', titulo: 'X' });

        expect(publish).toHaveBeenCalledTimes(1);
        expect(publish.mock.calls[0][0]).toMatchObject({
            type: 'task.criada',
            aggregate_type: 'task',
            aggregate_id: 't-1',
        });
    });

    it('dispara triggerPush do LanTransport quando presente', async () => {
        const publish = vi.fn().mockResolvedValue(undefined);
        const triggerPush = vi.fn();
        getTransportMock.mockReturnValue({ publish });
        getLanTransportMock.mockReturnValue({ triggerPush });

        const outbox = new SyncOutbox();
        await outbox.write('task.criada', { id: 't-2' });

        expect(triggerPush).toHaveBeenCalledTimes(1);
    });
});
