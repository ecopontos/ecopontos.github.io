export interface SyncOutbox {
    write(
        type: string,
        data: Record<string, unknown>,
        options?: { aggregateId?: string; streamId?: string },
    ): Promise<void>;
}
