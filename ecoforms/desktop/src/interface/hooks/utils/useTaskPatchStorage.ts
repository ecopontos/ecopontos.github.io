import { useMemo } from 'react';
import { getUiSupabaseClient } from './useSupabaseClient';
import type { TaskPatchFile } from '@/components/kanban/PatchHistoryPanel';

export interface TaskPatchStorage {
    uploadTaskPatch(userId: string, taskId: string, payload: unknown): Promise<string>;
    listTaskPatches(userId: string, taskId: string): Promise<TaskPatchFile[]>;
    loadTaskPatchPayloads(userId: string, taskId: string): Promise<Record<string, unknown>[]>;
}

class SupabaseTaskPatchStorage implements TaskPatchStorage {
    private readonly bucket = 'sync-bucket';

    async uploadTaskPatch(userId: string, taskId: string, payload: unknown): Promise<string> {
        const timestamp = Date.now();
        const patchPath = `users/${userId}/inbox/${taskId}/patches/${timestamp}.json`;
        const client = getUiSupabaseClient();
        const { error } = await client.storage.from(this.bucket).upload(
            patchPath,
            JSON.stringify(payload),
            { contentType: 'application/json', upsert: true },
        );

        if (error) {
            throw error;
        }

        return patchPath;
    }

    async listTaskPatches(userId: string, taskId: string): Promise<TaskPatchFile[]> {
        const client = getUiSupabaseClient();
        const { data, error } = await client.storage
            .from(this.bucket)
            .list(`users/${userId}/inbox/${taskId}/patches/`);

        if (error) {
            throw error;
        }

        return (data ?? []).map((item) => ({
            created_at: item.created_at ?? null,
            last_modified: item.updated_at ?? null,
        }));
    }

    async loadTaskPatchPayloads(userId: string, taskId: string): Promise<Record<string, unknown>[]> {
        const client = getUiSupabaseClient();
        const prefix = `users/${userId}/inbox/${taskId}/patches/`;
        const { data, error } = await client.storage.from(this.bucket).list(prefix);

        if (error) {
            throw error;
        }

        const sorted = [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
        const payloads: Record<string, unknown>[] = [];

        for (const fileEntry of sorted) {
            const { data: blob, error: downloadError } = await client.storage
                .from(this.bucket)
                .download(`${prefix}${fileEntry.name}`);

            if (downloadError) {
                throw downloadError;
            }

            if (!blob) {
                continue;
            }

            const raw = await blob.text();
            payloads.push(JSON.parse(raw) as Record<string, unknown>);
        }

        return payloads;
    }
}

export function useTaskPatchStorage(): TaskPatchStorage {
    return useMemo(() => new SupabaseTaskPatchStorage(), []);
}
