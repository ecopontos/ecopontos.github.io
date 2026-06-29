
import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';

export class OfflineStorageService {
    private static instance: OfflineStorageService;

    private constructor() { }

    public static getInstance(): OfflineStorageService {
        if (!OfflineStorageService.instance) {
            OfflineStorageService.instance = new OfflineStorageService();
        }
        return OfflineStorageService.instance;
    }

    /**
     * Salva um arquivo no AppData via comando Rust.
     * @param file Arquivo a ser salvo
     * @param subPath Caminho relativo para organizar (ex: '{userId}')
     * @returns Caminho relativo do arquivo (ex: 'storage/{userId}/123456.jpg')
     */
    async saveFile(file: File, subPath: string = 'uploads'): Promise<string> {
        const { invoke } = await import('@tauri-apps/api/core');
        const arrayBuffer = await file.arrayBuffer();
        const data = Array.from(new Uint8Array(arrayBuffer));
        return invoke<string>('offline_storage_save_file', {
            subPath,
            fileName: file.name,
            data,
        });
    }

    /**
     * Recupera a URL para exibição de uma imagem (asset://)
     * @param relativePath Caminho relativo (ex: 'storage/...')
     */
    async getFileUrl(relativePath: string): Promise<string> {
        try {
            if (!relativePath) return '';

            if (relativePath.startsWith('http') || relativePath.startsWith('asset') || relativePath.startsWith('blob')) {
                return relativePath;
            }

            const cleanPath = relativePath.replace('opfs://', '');

            const appData = await appDataDir();
            const fullPath = await join(appData, cleanPath);
            return convertFileSrc(fullPath);
        } catch (error) {
            console.error(`Erro ao gerar URL do arquivo (${relativePath}):`, error);
            return '';
        }
    }

    /**
     * Recupera o objeto File original lendo do disco via comando Rust.
     */
    async getFile(relativePath: string): Promise<File> {
        const { invoke } = await import('@tauri-apps/api/core');
        const cleanPath = relativePath.replace('opfs://', '');
        const fileName = cleanPath.split('/').pop() || 'unknown';

        const bytes = await invoke<number[]>('offline_storage_read_file', {
            relativePath: cleanPath,
        });

        let type = 'application/octet-stream';
        if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) type = 'image/jpeg';
        if (fileName.endsWith('.png')) type = 'image/png';

        return new File([new Uint8Array(bytes)], fileName, { type });
    }
}
