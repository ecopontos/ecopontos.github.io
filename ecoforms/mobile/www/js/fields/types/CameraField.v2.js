/**
 * CameraField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 */

import BaseField from './BaseField.js';

/**
 * Campo de câmera modernizado
 * - Captura de foto via câmera
 * - Preview da imagem
 * - Usa Alpine stores
 */
export default class CameraFieldV2 extends BaseField {
    /**
     * @param {FormField} config
     */
    constructor(config) {
        super(config);
    }

    /**
     * Renderiza o input do campo
     * @returns {string} HTML do campo
     */
    renderInput() {
        const fieldId = this.config.id;

        return `
      <div x-data="cameraField_${fieldId}" x-init="init()">
        <!-- Preview da foto -->
        <div x-show="hasPhoto" class="photo-preview mb-3">
          <div class="relative inline-block">
            <img :src="photoDataUrl" 
                 alt="Foto capturada"
                 class="max-w-full h-auto rounded border border-gray-300"
                 style="max-height: 300px;">
            
            <button type="button"
                    @click="removePhoto()"
                    class="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 hover:bg-red-700">
              ×
            </button>
          </div>
          
          <div class="text-sm text-gray-600 mt-2">
            <span x-text="photoSize"></span>
          </div>
        </div>
        
        <!-- Botões de captura -->
        <div x-show="!hasPhoto" class="camera-controls flex gap-2">
          <!-- Input file (mobile camera) -->
          <label class="btn-camera px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer inline-block">
            📷 Tirar Foto
            <input type="file"
                   accept="image/*"
                   capture="environment"
                   @change="handleFileSelect($event)"
                   class="hidden">
          </label>
          
          <!-- Input file (gallery) -->
          <label class="btn-gallery px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 cursor-pointer inline-block">
            🖼️ Galeria
            <input type="file"
                   accept="image/*"
                   @change="handleFileSelect($event)"
                   class="hidden">
          </label>
        </div>
        
        <!-- Error message -->
        <div x-show="error" class="text-sm text-red-500 mt-2" style="display: none;">
          <span>⚠️</span> <span x-text="error"></span>
        </div>
        
        <!-- Help text -->
        <div class="text-xs text-gray-500 mt-2">
          💡 A foto será redimensionada automaticamente para otimizar o armazenamento
        </div>
      </div>
    `;
    }

    /**
     * Retorna dados Alpine para o campo
     */
    getAlpineData() {
        const field = this.config;
        const maxWidth = field.maxWidth || 1920;
        const maxHeight = field.maxHeight || 1080;
        const quality = field.quality || 0.8;

        return {
            photoDataUrl: null,
            photoSize: null,
            error: null,

            get hasPhoto() {
                return !!this.photoDataUrl;
            },

            init() {
                // Carregar foto existente do store
                const formStore = Alpine.store('form');
                const currentValue = formStore.getFieldValue('${field.id}');

                if (currentValue && typeof currentValue === 'object') {
                    this.photoDataUrl = currentValue.dataUrl;
                    this.photoSize = currentValue.size;
                }

                console.log(`✅ CameraField '${field.id}' initialized`);
            },

            async handleFileSelect(event) {
                const file = event.target.files?.[0];
                if (!file) return;

                // Validar tipo
                if (!file.type.startsWith('image/')) {
                    this.error = 'Por favor, selecione uma imagem';
                    return;
                }

                this.error = null;

                try {
                    // Redimensionar e comprimir imagem
                    const dataUrl = await this.resizeImage(file, maxWidth, maxHeight, quality);

                    this.photoDataUrl = dataUrl;
                    this.photoSize = this.formatFileSize(dataUrl.length);

                    // Atualizar form store
                    const formStore = Alpine.store('form');
                    formStore.setFieldValue('${field.id}', {
                        dataUrl: dataUrl,
                        size: this.photoSize,
                        timestamp: new Date().toISOString(),
                        filename: file.name
                    });

                    console.log(`📷 Photo captured: ${this.photoSize}`);
                } catch (err) {
                    console.error('Photo processing error:', err);
                    this.error = 'Erro ao processar imagem: ' + err.message;
                }

                // Limpar input
                event.target.value = '';
            },

            resizeImage(file, maxWidth, maxHeight, quality) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();

                    reader.onload = (e) => {
                        const img = new Image();

                        img.onload = () => {
                            // Calcular dimensões mantendo aspect ratio
                            let width = img.width;
                            let height = img.height;

                            if (width > maxWidth) {
                                height = (height * maxWidth) / width;
                                width = maxWidth;
                            }

                            if (height > maxHeight) {
                                width = (width * maxHeight) / height;
                                height = maxHeight;
                            }

                            // Criar canvas e redimensionar
                            const canvas = document.createElement('canvas');
                            canvas.width = width;
                            canvas.height = height;

                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);

                            // Converter para data URL
                            const dataUrl = canvas.toDataURL('image/jpeg', quality);
                            resolve(dataUrl);
                        };

                        img.onerror = reject;
                        img.src = e.target.result;
                    };

                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            },

            formatFileSize(base64Length) {
                const bytes = (base64Length * 3) / 4;
                if (bytes < 1024) return bytes + ' B';
                if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            },

            removePhoto() {
                this.photoDataUrl = null;
                this.photoSize = null;

                const formStore = Alpine.store('form');
                formStore.setFieldValue('${field.id}', null);

                console.log(`🗑️ Photo removed`);
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.CameraFieldV2 = CameraFieldV2;
}

export { CameraFieldV2 };
