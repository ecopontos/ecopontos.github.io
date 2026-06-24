import type { SyncStoragePort } from '../../infrastructure/sync/SyncStoragePort';
import type { StoredFile } from '../../application/ports/FileStoragePort';

/**
 * Fake SyncStoragePort para testes — armazena blobs em memória.
 * Suporta as duas sobrecargas de upload/download/list (2-arg e 3-arg).
 */
export class FakeSyncStorage implements SyncStoragePort {
    private store = new Map<string, Uint8Array>();

    // Acesso direto para assertions
    getKeys(): string[] { return Array.from(this.store.keys()); }
    getRaw(path: string): Uint8Array | undefined { return this.store.get(path); }
    clear(): void { this.store.clear(); }

    upload(bucket: string, path: string, data: Blob | ArrayBuffer | Uint8Array, _ct?: string): Promise<StoredFile>;
    upload(path: string, data: Blob | ArrayBuffer | Uint8Array, _ct?: string): Promise<StoredFile>;
    async upload(...args: unknown[]): Promise<StoredFile> {
        const path = typeof args[1] === 'string' ? `${args[0]}/${args[1]}` : (args[0] as string);
        const data = typeof args[1] === 'string' ? args[2] : args[1];
        const bytes = await toUint8Array(data as Blob | ArrayBuffer | Uint8Array);
        this.store.set(path, bytes);
        return { path, size: bytes.length } as StoredFile;
    }

    download(bucket: string, path: string): Promise<Blob>;
    download(path: string): Promise<Blob>;
    async download(...args: unknown[]): Promise<Blob> {
        const path = args.length === 2 ? `${args[0]}/${args[1]}` : (args[0] as string);
        const data = this.store.get(path);
        if (!data) throw new Error(`not found: ${path}`);
        const ab = new ArrayBuffer(data.byteLength);
        new Uint8Array(ab).set(data);
        return new Blob([ab]);
    }

    list(bucket: string, prefix?: string): Promise<string[]>;
    list(prefix?: string): Promise<string[]>;
    async list(...args: unknown[]): Promise<string[]> {
        // Normaliza: se 2 args, junta bucket+prefix; se 1 arg, usa como prefix
        const prefix = args.length === 2
            ? `${args[0]}/${args[1] ?? ''}`
            : ((args[0] as string) ?? '');
        return Array.from(this.store.keys())
            .filter(k => k.startsWith(prefix))
            .map(k => {
                // Retorna apenas o filename (sem o prefix), como o Storage real faria
                const rel = k.slice(prefix.length);
                return rel.startsWith('/') ? rel.slice(1) : rel;
            });
    }

    async ensureBucket(): Promise<{ ok: boolean }> {
        return { ok: true };
    }
}

async function toUint8Array(data: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    return new Uint8Array(await data.arrayBuffer());
}
