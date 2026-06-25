class FileUploadService {
    constructor() {
        this.maxUploadBytes = 5 * 1024 * 1024;
        this.autoCompressImages = true;
        this.compressionQuality = 0.8;
        this.maxImageWidth = 1920;
        this.userId = '00000000-0000-0000-0000-000000000000';
        this.supabaseClient = null;
    }

    configure({ maxUploadBytes, autoCompressImages, compressionQuality, maxImageWidth, userId, supabaseClient } = {}) {
        if (maxUploadBytes !== undefined) this.maxUploadBytes = maxUploadBytes;
        if (autoCompressImages !== undefined) this.autoCompressImages = autoCompressImages;
        if (compressionQuality !== undefined) this.compressionQuality = Math.max(0.1, Math.min(1, compressionQuality));
        if (maxImageWidth !== undefined) this.maxImageWidth = Math.max(800, maxImageWidth);
        if (userId !== undefined) this.userId = userId;
        if (supabaseClient !== undefined) this.supabaseClient = supabaseClient;
    }

    async uploadFile(file, bucket = 'sync-bucket', path = null) {
        let processedFile = file;

        if (this.autoCompressImages && file.type.startsWith('image/') && file.size > 1024 * 1024) {
            try {
                processedFile = await FileUploadService._compressImage(file, this.maxImageWidth, this.compressionQuality);
            } catch (error) {
                console.warn('⚠️ Falha na compressão, usando arquivo original:', error);
                processedFile = file;
            }
        }

        const allowedMimes = ['image/jpeg', 'image/png'];
        const mime = processedFile.type || (processedFile instanceof Blob ? processedFile.type : null);
        if (mime && !allowedMimes.includes(mime)) {
            throw new Error(`Tipo de arquivo não permitido: ${mime}`);
        }
        if (processedFile.size && processedFile.size > this.maxUploadBytes) {
            throw new Error(`Arquivo maior que o máximo permitido (${this.maxUploadBytes} bytes)`);
        }

        const filename = path || `users/${this.userId}/images/${Date.now()}_${(processedFile.name || 'upload').replace(/\s+/g, '_')}`;

        if (this.supabaseClient) {
            const { data, error } = await this.supabaseClient.storage.from(bucket).upload(filename, processedFile, { upsert: false });
            if (error) throw error;
            const { data: publicData } = this.supabaseClient.storage.from(bucket).getPublicUrl(filename);
            return { path: filename, url: publicData?.publicUrl || null };
        }

        try {
            const serverPath = `${bucket}/${filename}`;
            const uploadUrl = `/api/upload?path=${encodeURIComponent(serverPath)}`;
            const resp = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': processedFile.type || 'application/octet-stream' },
                body: processedFile
            });
            if (!resp.ok) throw new Error(`Upload proxy failed: ${resp.status} ${await resp.text()}`);
            const signedResp = await fetch(`/api/signed-url?path=${encodeURIComponent(serverPath)}&op=download&expires=3600`);
            if (!signedResp.ok) throw new Error(`Signed URL request failed: ${signedResp.status} ${await signedResp.text()}`);
            const signedJson = await signedResp.json();
            return { path: serverPath, url: signedJson.url };
        } catch (e) {
            throw new Error(`Fallback upload failed: ${e.message}`);
        }
    }

    async uploadFilesInRecord(record) {
        let copy;
        try { copy = structuredClone(record); } catch (_) { copy = JSON.parse(JSON.stringify(record)); }
        copy._storagePaths = copy._storagePaths || {};
        copy._uploadErrors = [];

        let totalFilesToUpload = 0;
        let successfulUploads = 0;

        const handleItemUpload = async (item, fieldKey) => {
            totalFilesToUpload++;
            try {
                let fileToUpload = item;
                if (item && typeof item === 'object' && item.dataUrl) fileToUpload = item.dataUrl;

                if (typeof fileToUpload === 'string' && fileToUpload.startsWith('data:')) {
                    const res = await fetch(fileToUpload);
                    const blob = await res.blob();
                    const ext = (blob.type && blob.type.split('/')[1]) ? `.${blob.type.split('/')[1].split(';')[0]}` : '.jpg';
                    fileToUpload = new File([blob], `upload_${Date.now()}${ext}`, { type: blob.type });
                }

                const isFile = (typeof File !== 'undefined' && fileToUpload instanceof File) ||
                               (typeof Blob !== 'undefined' && fileToUpload instanceof Blob);

                if (isFile) {
                    const { url, path } = await this.uploadFile(fileToUpload);
                    copy._storagePaths[fieldKey] = path;
                    successfulUploads++;
                    if (item && typeof item === 'object' && item.dataUrl) {
                        return { ...item, url, storagePath: path, dataUrl: null, uploadedAt: new Date().toISOString() };
                    }
                    return url;
                }

                totalFilesToUpload--;
                return item;
            } catch (err) {
                copy._uploadErrors.push({ field: fieldKey, error: err.message || String(err), timestamp: new Date().toISOString() });
                return item;
            }
        };

        const processRecursive = async (obj, currentPath = '') => {
            if (!obj || typeof obj !== 'object') return obj;
            if (obj instanceof File || obj instanceof Blob) return await handleItemUpload(obj, currentPath);
            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    obj[i] = await processRecursive(obj[i], currentPath ? `${currentPath}[${i}]` : `[${i}]`);
                }
                return obj;
            }
            if (obj.dataUrl && typeof obj.dataUrl === 'string' && obj.dataUrl.startsWith('data:')) {
                return await handleItemUpload(obj, currentPath);
            }
            for (const key of Object.keys(obj)) {
                if (key === '_storagePaths' || key === '_uploadErrors' || key === 'metadata') continue;
                const val = obj[key];
                const itemPath = currentPath ? `${currentPath}.${key}` : key;
                if (typeof val === 'string' && val.startsWith('data:')) {
                    obj[key] = await handleItemUpload(val, itemPath);
                } else if (val && typeof val === 'object') {
                    obj[key] = await processRecursive(val, itemPath);
                }
            }
            return obj;
        };

        if (copy.data || copy.dados) {
            if (copy.data) copy.data = await processRecursive(copy.data, 'data');
            if (copy.dados) copy.dados = await processRecursive(copy.dados, 'dados');
        } else {
            for (const key of Object.keys(copy)) {
                if (key === '_storagePaths' || key === '_uploadErrors' || key === 'id' || key === 'uuid') continue;
                copy[key] = await processRecursive(copy[key], key);
            }
        }

        if (copy._uploadErrors.length > 0) {
            throw new Error(`Falha no upload de arquivos: ${copy._uploadErrors.length} upload(s) falharam.`);
        }
        delete copy._uploadErrors;
        return copy;
    }

    static async _compressImage(file, maxWidth, quality) {
        if (typeof CameraField !== 'undefined' && CameraField.compressImage) {
            return CameraField.compressImage(file, maxWidth, quality);
        }
        console.warn('⚠️ CameraField.compressImage não disponível, retornando arquivo original');
        return file;
    }
}

if (typeof window !== 'undefined') {
    window.FileUploadService = FileUploadService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FileUploadService };
}
