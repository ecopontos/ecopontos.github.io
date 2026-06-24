
/**
 * Serviço de Armazenamento Local (System Files)
 * Gerencia o salvamento e recuperação de arquivos no AppData do usuário
 */

import { BaseDirectory, writeFile, readFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';

// Network path for photo backup (UNC format)
// Configure via environment variable; leave empty to disable network backup.
const NETWORK_PHOTO_PATH = process.env.NEXT_PUBLIC_NETWORK_PHOTO_PATH || '';

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
     * Salva um arquivo no sistema de arquivos local (AppData)
     * E tenta copiar para o caminho de rede configurado
     * @param file Arquivo a ser salvo
     * @param subPath Caminho relativo para organizar (ex: '{formId}/{recordId}')
     * @returns Caminho relativo do arquivo (ex: 'storage/form_123/record_abc/123456.jpg')
     */
    async saveFile(file: File, subPath: string = 'uploads'): Promise<string> {
        // Estrutura base: ecoforms_data/storage
        const baseFolder = 'storage';
        const targetFolder = `${baseFolder}/${subPath}`;

        // Gerar nome único seguro
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}_${safeName}`;
        const filePath = `${targetFolder}/${fileName}`;

        // Converter File para Uint8Array
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // 1. Salvar localmente (obrigatório)
        try {
            const dirExists = await exists(targetFolder, { baseDir: BaseDirectory.AppData });
            if (!dirExists) {
                await mkdir(targetFolder, { baseDir: BaseDirectory.AppData, recursive: true });
            }
            await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.AppData });
            console.log(`✅ Arquivo salvo localmente: ${filePath}`);
        } catch (error) {
            console.error('❌ Erro ao salvar arquivo localmente:', error);
            throw error; // Local save is required
        }

        // 2. Copiar para rede (opcional, não bloqueia em caso de erro)
        if (NETWORK_PHOTO_PATH) {
            try {
                const networkFilePath = `${NETWORK_PHOTO_PATH}\\${fileName}`;
                // writeFile with absolute path (no baseDir) for network share
                await writeFile(networkFilePath, uint8Array);
                console.log(`✅ Arquivo copiado para rede: ${networkFilePath}`);
            } catch (networkError) {
                console.warn(`⚠️ Não foi possível copiar para a rede (${NETWORK_PHOTO_PATH}):`, networkError);
                // Não lança erro - salvamento local já foi bem sucedido
            }
        }

        return filePath;
    }

    /**
     * Recupera a URL para exibição de uma imagem (asset://)
     * @param relativePath Caminho relativo (ex: 'storage/...')
     */
    async getFileUrl(relativePath: string): Promise<string> {
        try {
            if (!relativePath) return '';

            // Se já for uma URL completa (http/https/asset/blob), retorna ela mesma
            if (relativePath.startsWith('http') || relativePath.startsWith('asset') || relativePath.startsWith('blob')) {
                return relativePath;
            }

            // Remover prefixo opfs:// se existir (legado)
            const cleanPath = relativePath.replace('opfs://', '');

            const appData = await appDataDir();
            const fullPath = await join(appData, cleanPath);
            return convertFileSrc(fullPath);
        } catch (error) {
            console.error(`❌ Erro ao gerar URL do arquivo (${relativePath}):`, error);
            return '';
        }
    }

    /**
     * Recupera o objeto File original lendo do disco
     */
    async getFile(relativePath: string): Promise<File> {
        try {
            // Remover prefixo opfs:// se existir (legado)
            const cleanPath = relativePath.replace('opfs://', '');

            // Extrair nome do arquivo
            const fileName = cleanPath.split('/').pop() || 'unknown';

            const contents = await readFile(cleanPath, { baseDir: BaseDirectory.AppData });

            // Tentar adivinhar tipo pelo nome (muito simples) ou default
            let type = 'application/octet-stream';
            if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) type = 'image/jpeg';
            if (fileName.endsWith('.png')) type = 'image/png';

            return new File([contents], fileName, { type });
        } catch (error) {
            console.error(`❌ Erro ao ler arquivo do disco (${relativePath}):`, error);
            throw error;
        }
    }
}
