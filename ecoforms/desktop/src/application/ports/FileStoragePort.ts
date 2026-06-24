export interface StoredFile {
    path: string;
    publicUrl?: string;
}

export interface FileStoragePort {
    upload(bucket: string, path: string, data: Blob | ArrayBuffer | Uint8Array, contentType?: string): Promise<StoredFile>;
    download(bucket: string, path: string): Promise<Blob>;
    remove(bucket: string, paths: string[]): Promise<void>;
    list(bucket: string, prefix?: string): Promise<string[]>;
    getPublicUrl(bucket: string, path: string): string;
}
