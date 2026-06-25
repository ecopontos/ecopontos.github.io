import type { FileStoragePort, StoredFile } from '../../application/ports/FileStoragePort';
import { getSupabaseClient } from '../persistence/supabase/supabaseClient';

const DEFAULT_BUCKET = 'sync-bucket';

export class SupabaseFileStorage implements FileStoragePort {
    private bucket: string = DEFAULT_BUCKET;

    setBucket(bucket: string): void {
        this.bucket = bucket;
    }

    private getBucket(b?: string): string {
        return b ?? this.bucket;
    }

    private requireClient() {
        const client = getSupabaseClient();
        if (!client) throw new Error('Supabase not configured — file storage unavailable in standalone mode');
        return client;
    }

    async upload(
        bucketOrPath: string,
        pathOrData: string | Blob | ArrayBuffer | Uint8Array,
        dataOrContent?: Blob | ArrayBuffer | Uint8Array | string,
        contentType?: string,
    ): Promise<StoredFile> {
        let bucket: string;
        let path: string;
        let data: Blob | ArrayBuffer | Uint8Array;

        if (typeof pathOrData === 'string') {
            bucket = bucketOrPath;
            path = pathOrData;
            data = dataOrContent as Blob | ArrayBuffer | Uint8Array;
        } else {
            bucket = this.bucket;
            path = bucketOrPath;
            data = pathOrData;
            contentType = dataOrContent as string | undefined;
        }

        const client = this.requireClient();
        const { error } = await client.storage.from(bucket).upload(path, data, {
            contentType,
            upsert: true,
        });
        if (error) throw error;
        const { data: urlData } = client.storage.from(bucket).getPublicUrl(path);
        return { path, publicUrl: urlData.publicUrl };
    }

    async download(bucketOrPath: string, path?: string): Promise<Blob> {
        let bucket: string;
        let actualPath: string;

        if (path === undefined) {
            bucket = this.bucket;
            actualPath = bucketOrPath;
        } else {
            bucket = bucketOrPath;
            actualPath = path;
        }

        const client = this.requireClient();
        const { data, error } = await client.storage.from(bucket).download(actualPath);
        if (error) throw error;
        return data;
    }

    async remove(bucketOrPaths: string | string[], paths?: string[]): Promise<void> {
        let bucket: string;
        let actualPaths: string[];

        if (Array.isArray(bucketOrPaths)) {
            bucket = this.bucket;
            actualPaths = bucketOrPaths;
        } else if (Array.isArray(paths)) {
            bucket = bucketOrPaths;
            actualPaths = paths;
        } else {
            bucket = this.bucket;
            actualPaths = [];
        }

        const client = this.requireClient();
        const { error } = await client.storage.from(bucket).remove(actualPaths);
        if (error) throw error;
    }

    async list(bucketOrPrefix?: string | undefined, prefix?: string | undefined): Promise<string[]> {
        let bucket: string;
        let actualPrefix: string | undefined;

        if (prefix !== undefined) {
            bucket = bucketOrPrefix as string;
            actualPrefix = prefix;
        } else {
            bucket = this.bucket;
            actualPrefix = bucketOrPrefix;
        }

        const client = this.requireClient();
        const { data, error } = await client.storage.from(bucket).list(actualPrefix);
        if (error) throw error;
        return (data ?? []).map((f) => f.name);
    }

    async ensureBucket(bucketName?: string): Promise<{ ok: boolean; reason?: string }> {
        const client = getSupabaseClient();
        if (!client) return { ok: false, reason: 'Supabase not configured (standalone mode)' };

        const name = bucketName ?? this.bucket;
        const { error: listErr } = await client.storage.from(name).list('', { limit: 1 });
        if (!listErr) return { ok: true };

        const { error: createErr } = await client.storage.createBucket(name, {
            public: false,
            fileSizeLimit: 52428800,
        });

        if (!createErr) {
            console.log(`[Storage] Bucket "${name}" criado com sucesso.`);
            return { ok: true };
        }

        if (createErr.message?.toLowerCase().includes('already exist')) {
            return { ok: true };
        }

        return { ok: false, reason: createErr.message };
    }

    getPublicUrl(bucketOrPath: string, path?: string): string {
        let bucket: string;
        let actualPath: string;

        if (path === undefined) {
            bucket = this.bucket;
            actualPath = bucketOrPath;
        } else {
            bucket = bucketOrPath;
            actualPath = path;
        }

        const client = this.requireClient();
        return client.storage.from(bucket).getPublicUrl(actualPath).data.publicUrl;
    }
}
