import { useMemo } from 'react';
import { useContainer } from './useContainer';

/**
 * Acesso ao FileStoragePort para upload/download de arquivos.
 * Usado por GalleryGrid, TaskAttachments, StorageStatusCard.
 */
export function useFileStorage() {
    const container = useContainer();
    return useMemo(() => container.fileStorage, [container]);
}
