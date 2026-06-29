import type { FileStoragePort, StoredFile } from '../../application/ports/FileStoragePort';

function key(bucket: string, pathValue: string): string {
    return bucket + '::' + pathValue;
}

export class FakeFileStorage implements FileStoragePort {
    private readonly files = new Map<string, Uint8Array>();
    public uploads: Array<{ bucket: string; path: string }> = [];
    public downloads: Array<{ bucket: string; path: string }> = [];
    public removals: Array<{ bucket: string; paths: string[] }> = [];
    public lists: Array<{ bucket: string; prefix?: string }> = [];

    seed(bucket: string, pathValue: string, data: string | Uint8Array): void {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        this.files.set(key(bucket, pathValue), bytes);
    }

    async upload(bucket: string, pathValue: string, data: Blob | ArrayBuffer | Uint8Array): Promise<StoredFile> {
        const bytes = data instanceof Blob
            ? new Uint8Array(await data.arrayBuffer())
            : data instanceof ArrayBuffer
                ? new Uint8Array(data)
                : data;
        this.files.set(key(bucket, pathValue), bytes);
        this.uploads.push({ bucket, path: pathValue });
        return { path: pathValue };
    }

    async download(bucket: string, pathValue: string): Promise<Blob> {
        this.downloads.push({ bucket, path: pathValue });
        const bytes = this.files.get(key(bucket, pathValue));
        if (!bytes) {
            throw new Error('Arquivo nao encontrado: ' + bucket + '/' + pathValue);
        }
        return new Blob([bytes as unknown as BlobPart]);
    }

    async remove(bucket: string, paths: string[]): Promise<void> {
        this.removals.push({ bucket, paths: [...paths] });
        for (const pathValue of paths) {
            this.files.delete(key(bucket, pathValue));
        }
    }

    async list(bucket: string, prefix?: string): Promise<string[]> {
        this.lists.push({ bucket, prefix });
        const effectivePrefix = prefix ?? '';
        const bucketPrefix = key(bucket, '');
        return Array.from(this.files.keys())
            .filter((entry) => entry.startsWith(bucketPrefix))
            .map((entry) => entry.slice(bucketPrefix.length))
            .filter((pathValue) => pathValue.startsWith(effectivePrefix));
    }

    getPublicUrl(bucket: string, pathValue: string): string {
        return 'fake://' + bucket + '/' + pathValue;
    }
}
