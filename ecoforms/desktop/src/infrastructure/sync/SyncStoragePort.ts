import type { StoredFile } from '../../application/ports/FileStoragePort';

export interface SyncStoragePort {
    upload(bucket: string, path: string, data: Blob | ArrayBuffer | Uint8Array, contentType?: string): Promise<StoredFile>;
    upload(path: string, data: Blob | ArrayBuffer | Uint8Array, contentType?: string): Promise<StoredFile>;
    download(bucket: string, path: string): Promise<Blob>;
    download(path: string): Promise<Blob>;
    list(bucket: string, prefix?: string): Promise<string[]>;
    list(prefix?: string): Promise<string[]>;
    ensureBucket(bucketName?: string): Promise<{ ok: boolean; reason?: string }>;
}