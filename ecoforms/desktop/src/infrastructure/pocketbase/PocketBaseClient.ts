import type { PocketBaseConfig } from './PocketBaseConfig';

export interface PocketBaseListResponse<T> {
    items: T[];
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}

export class PocketBaseHttpError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = 'PocketBaseHttpError';
    }
}

export class PocketBaseClient {
    constructor(private readonly config: Pick<PocketBaseConfig, 'baseUrl' | 'timeoutMs'>) {}

    async listRecords<T>(
        collection: string,
        params: Record<string, string | number | boolean> = {},
    ): Promise<PocketBaseListResponse<T>> {
        return this.request<PocketBaseListResponse<T>>('GET', collection, undefined, params);
    }

    async getRecord<T>(collection: string, id: string): Promise<T> {
        return this.request<T>('GET', collection, id);
    }

    async createRecord<T>(collection: string, body: Record<string, unknown>): Promise<T> {
        return this.request<T>('POST', collection, undefined, undefined, body);
    }

    async updateRecord<T>(collection: string, id: string, body: Record<string, unknown>): Promise<T> {
        return this.request<T>('PATCH', collection, id, undefined, body);
    }

    async upsertRecord<T>(collection: string, id: string, body: Record<string, unknown>): Promise<T> {
        try {
            return await this.updateRecord<T>(collection, id, body);
        } catch (error) {
            if (error instanceof PocketBaseHttpError && error.status === 404) {
                return this.createRecord<T>(collection, { ...body, id });
            }
            throw error;
        }
    }

    async deleteRecord(collection: string, id: string): Promise<void> {
        await this.request<void>('DELETE', collection, id);
    }

    private async request<T>(
        method: string,
        collection: string,
        id?: string,
        params?: Record<string, string | number | boolean>,
        body?: Record<string, unknown>,
    ): Promise<T> {
        const controller = new AbortController();
        const timeout = globalThis.setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
            const url = this.buildUrl(collection, id, params);
            const response = await fetch(url, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new PocketBaseHttpError(`PocketBase ${method} ${url.pathname} failed`, response.status);
            }

            if (response.status === 204) {
                return undefined as T;
            }

            return await response.json() as T;
        } finally {
            globalThis.clearTimeout(timeout);
        }
    }

    private buildUrl(
        collection: string,
        id?: string,
        params: Record<string, string | number | boolean> = {},
    ): URL {
        const pathParts = [
            this.config.baseUrl,
            'api',
            'collections',
            encodeURIComponent(collection),
            'records',
            id ? encodeURIComponent(id) : undefined,
        ];
        const url = new URL(pathParts.filter(Boolean).join('/'));

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }

        return url;
    }
}
