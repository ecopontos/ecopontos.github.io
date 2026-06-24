import { useMemo } from 'react';
import { getContainer } from '../../../infrastructure/container';

/**
 * Acesso ao FileStoragePort para upload/download de arquivos.
 * Usado por GalleryGrid, TaskAttachments, StorageStatusCard.
 */
export function useFileStorage() {
    return useMemo(() => getContainer().fileStorage, []);
}
