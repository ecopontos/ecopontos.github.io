import { getTransport, getLanTransport } from './lazy-sync';

export class SyncOutbox {
    async write(
        type: string,
        data: Record<string, unknown>,
        options?: { aggregateId?: string; streamId?: string },
    ): Promise<void> {
        const transport = getTransport();
        if (!transport) return;
        await transport.publish({
            type,
            data,
            aggregate_type: type.split('.')[0],
            aggregate_id: options?.aggregateId ?? (data['id'] as string | undefined) ?? '',
            stream_id: options?.streamId,
        });

        const lanTransport = getLanTransport();
        if (lanTransport) {
            lanTransport.triggerPush();
        }
    }
}
