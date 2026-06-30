import { useMemo } from 'react';
import { getSupabaseClient } from '@/src/infrastructure/persistence/supabase/supabaseClient';

interface StorageFile {
    name: string;
    id: string | null;
    updated_at: string | null;
    created_at: string | null;
    last_accessed_at: string | null;
    metadata: Record<string, unknown> | null;
}

export interface GalleryItem {
    name: string;
    url: string;
    isFolder: boolean;
    path: string;
    bucket: string;
    metadata?: { size?: number; created_at?: string | number | Date; [key: string]: unknown };
    previewUrl?: string | null;
    previewName?: string | null;
    recordDate?: string | Date | null;
    formTitle?: string | null;
}

export interface GalleryStoragePort {
    listItems(currentPath: string): Promise<GalleryItem[]>;
    deleteImage(item: Pick<GalleryItem, 'bucket' | 'path'>): Promise<void>;
}

class SupabaseGalleryStorage implements GalleryStoragePort {
    private async processBucketItems(
        bucket: string,
        internalPath: string,
    ): Promise<GalleryItem[]> {
        const client = getSupabaseClient();
        const { data, error } = await client.storage
            .from(bucket)
            .list(internalPath, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' },
            });

        if (error) {
            console.warn(`Erro ao listar ${bucket}/${internalPath}:`, error);
            return [];
        }

        return Promise.all(
            (data || []).map(async (item: StorageFile) => {
                const actuallyFolder = item.id === null;
                const fullInternalPath = internalPath ? `${internalPath}/${item.name}` : item.name;
                const { data: publicData } = client.storage.from(bucket).getPublicUrl(fullInternalPath);

                let previewUrl: string | null = null;
                let previewName: string | null = null;

                if (actuallyFolder) {
                    try {
                        const previewListPath = bucket === 'sync-bucket' && !internalPath.includes('/images')
                            ? `${fullInternalPath}/images`
                            : fullInternalPath;

                        const { data: folderContent, error: folderError } = await client.storage
                            .from(bucket)
                            .list(previewListPath, {
                                limit: 5,
                                offset: 0,
                                sortBy: { column: 'created_at', order: 'desc' },
                            });

                        if (!folderError && folderContent?.length) {
                            const fileEntries = folderContent.filter((entry) => entry.id !== null);
                            if (fileEntries.length) {
                                const firstFile = fileEntries[0];
                                const { data: previewPublic } = client.storage
                                    .from(bucket)
                                    .getPublicUrl(`${previewListPath}/${firstFile.name}`);
                                previewUrl = previewPublic.publicUrl;
                                previewName = firstFile.name;
                            }
                        }
                    } catch {
                    }
                }

                return {
                    name: item.name,
                    url: publicData.publicUrl,
                    isFolder: actuallyFolder,
                    path: fullInternalPath,
                    bucket,
                    metadata: item.metadata ?? undefined,
                    previewUrl,
                    previewName,
                };
            }),
        );
    }

    async listItems(currentPath: string): Promise<GalleryItem[]> {
        const allProcessedItems: GalleryItem[] = [];

        if (!currentPath) {
            const legacyUsers = await this.processBucketItems('form-images', '');
            const newUsers = await this.processBucketItems('sync-bucket', 'users');
            const userMap = new Map<string, GalleryItem>();

            [...legacyUsers, ...newUsers].forEach((item) => {
                if (!item.isFolder) return;
                const existing = userMap.get(item.name);
                if (!existing) {
                    userMap.set(item.name, item);
                    return;
                }
                if (item.previewUrl) {
                    existing.previewUrl = item.previewUrl;
                    existing.previewName = item.previewName;
                }
            });

            allProcessedItems.push(...Array.from(userMap.values()));
        } else {
            const legacyFiles = await this.processBucketItems('form-images', currentPath);
            const newFiles = await this.processBucketItems('sync-bucket', `users/${currentPath}/images`);
            allProcessedItems.push(...legacyFiles, ...newFiles);
        }

        if (!currentPath) {
            return this.enrichRootFolders(allProcessedItems);
        }

        return allProcessedItems;
    }

    async deleteImage(item: Pick<GalleryItem, 'bucket' | 'path'>): Promise<void> {
        const client = getSupabaseClient();
        const { error } = await client.storage.from(item.bucket).remove([item.path]);
        if (error) {
            throw error;
        }
    }

    private async enrichRootFolders(items: GalleryItem[]): Promise<GalleryItem[]> {
        const folderNames = Array.from(new Set(items.filter((item) => item.isFolder).map((item) => item.name)));
        if (!folderNames.length) {
            return items;
        }

        try {
            const client = getSupabaseClient();
            const { data: metaRows, error } = await client
                .from('suite')
                .select('owner_id, created_at, payload_json')
                .in('owner_id', folderNames);

            if (error || !metaRows) {
                return items;
            }

            const metaMap = new Map<string, { formTitle: string | null; recordDate: string | null }>();
            metaRows.forEach((row: {
                owner_id: string;
                payload_json: string | Record<string, unknown>;
                created_at?: string;
            }) => {
                if (metaMap.has(row.owner_id)) {
                    return;
                }

                const dados = (typeof row.payload_json === 'string'
                    ? JSON.parse(row.payload_json)
                    : row.payload_json) as { contexto?: { form_titulo?: string; data_registro?: string } };

                metaMap.set(row.owner_id, {
                    formTitle: dados?.contexto?.form_titulo || null,
                    recordDate: dados?.contexto?.data_registro || row.created_at || null,
                });
            });

            return items.map((item) => {
                if (!item.isFolder) {
                    return item;
                }

                const meta = metaMap.get(item.name);
                return {
                    ...item,
                    formTitle: meta?.formTitle || null,
                    recordDate: meta?.recordDate || null,
                };
            });
        } catch (error) {
            console.warn('Falha ao enriquecer pastas:', error);
            return items;
        }
    }
}

export function useGalleryStorage(): GalleryStoragePort {
    return useMemo(() => new SupabaseGalleryStorage(), []);
}
