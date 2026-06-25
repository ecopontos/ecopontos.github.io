import type { FileStoragePort, StoredFile } from '../../application/ports/FileStoragePort';

export class InMemoryStorageAdapter implements FileStoragePort {
    private store = new Map<string, Uint8Array>();

    async upload(
        bucket: string,
        path: string,
        data: Blob | ArrayBuffer | Uint8Array,
        _contentType?: string
    ): Promise<StoredFile> {
        let bytes: Uint8Array;
        if (data instanceof Uint8Array) {
            bytes = data;
        } else if (data instanceof ArrayBuffer) {
            bytes = new Uint8Array(data);
        } else {
            bytes = new Uint8Array(await data.arrayBuffer());
        }
        this.store.set(this.key(bucket, path), bytes);
        return { path };
    }

    async download(bucket: string, path: string): Promise<Blob> {
        const bytes = this.store.get(this.key(bucket, path));
        if (!bytes) throw new Error(`Arquivo não encontrado: ${path}`);
        return new Blob([bytes.buffer as ArrayBuffer]);
    }

    async remove(bucket: string, paths: string[]): Promise<void> {
        for (const path of paths) {
            this.store.delete(this.key(bucket, path));
        }
    }

    async list(bucket: string, prefix?: string): Promise<string[]> {
        const bucketPrefix = `${bucket}/`;
        const fullPrefix = prefix ? `${bucket}/${prefix}` : bucketPrefix;
        return Array.from(this.store.keys())
            .filter(k => k.startsWith(fullPrefix))
            .map(k => k.slice(bucketPrefix.length));
    }

    getPublicUrl(bucket: string, path: string): string {
        return `http://localhost/mock/${bucket}/${path}`;
    }

    clear(): void {
        this.store.clear();
    }

    private key(bucket: string, path: string): string {
        return `${bucket}/${path}`;
    }
}
