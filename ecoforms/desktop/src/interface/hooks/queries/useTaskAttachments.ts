import { useCallback } from 'react';
import { useFileStorage } from '../utils/useFileStorage';

const BUCKET = 'task-attachments';

export interface AttachmentInfo {
    path: string;
    publicUrl: string;
    name: string;
}

/**
 * Hook para gerenciar attachments de tarefas via FileStoragePort.
 * Substitui chamadas diretas a supabase.storage em TaskAttachments.
 */
export function useTaskAttachments() {
    const storage = useFileStorage();

    const upload = useCallback(async (taskId: string, file: File): Promise<AttachmentInfo> => {
        const path = `tasks/${taskId}/${Date.now()}_${file.name}`;
        const arrayBuffer = await file.arrayBuffer();
        const result = await storage.upload(BUCKET, path, new Uint8Array(arrayBuffer), file.type);
        return {
            path: result.path,
            publicUrl: result.publicUrl || storage.getPublicUrl(BUCKET, result.path),
            name: file.name,
        };
    }, [storage]);

    const download = useCallback(async (path: string): Promise<Blob> => {
        return storage.download(BUCKET, path);
    }, [storage]);

    const remove = useCallback(async (paths: string[]): Promise<void> => {
        return storage.remove(BUCKET, paths);
    }, [storage]);

    const list = useCallback(async (taskId: string): Promise<string[]> => {
        return storage.list(BUCKET, `tasks/${taskId}/`);
    }, [storage]);

    return { upload, download, remove, list };
}
