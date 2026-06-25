/**
 * GalleryField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 */

import BaseField from './BaseField.js';

/**
 * Campo de galeria modernizado
 * - Upload de múltiplas fotos
 * - Preview em grid
 * - Reordenação
 * - Usa Alpine stores
 */
export default class GalleryFieldV2 extends BaseField {
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
    const maxPhotos = this.config.maxFiles || this.config.maxPhotos || 10;
    const accept = this.config.accept || 'image/*';
    const isMultiple = this.config.multiple !== false; // Default true for gallery

    return `
      <div x-data="galleryField_${fieldId}" x-init="init()">
        <!-- Grid de fotos -->
        <div x-show="photos.length > 0" 
             class="gallery-grid grid grid-cols-3 gap-3 mb-3">
          <template x-for="(photo, index) in photos" :key="index">
            <div class="gallery-item relative group">
              <img :src="photo.dataUrl" 
                   :alt="'Foto ' + (index + 1)"
                   class="w-full h-32 object-cover rounded border border-gray-300">
              
              <!-- Overlay com ações -->
              <div class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <button type="button"
                        @click="removePhoto(index)"
                        class="bg-red-600 text-white rounded-full w-8 h-8 hover:bg-red-700"
                        :aria-label="'Remover foto ' + (index + 1)">
                  🗑️
                </button>
              </div>
              
              <!-- Número da foto -->
              <div class="absolute top-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                <span x-text="index + 1"></span>/<span x-text="photos.length"></span>
              </div>
            </div>
          </template>
        </div>
        
        <!-- Botão adicionar fotos -->
        <div x-show="photos.length < ${maxPhotos}">
          <label class="btn-add-photos px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer inline-block">
            📷 Adicionar Fotos (<span x-text="photos.length"></span>/${maxPhotos})
            <input type="file"
                   accept="${accept}"
                   ${isMultiple ? 'multiple' : ''}
                   @change="handleFilesSelect($event)"
                   class="hidden">
          </label>
        </div>
        
        <!-- Mensagem quando vazio -->
        <div x-show="photos.length === 0" class="text-gray-400 italic text-sm border-2 border-dashed border-gray-300 rounded p-8 text-center">
          📷 Nenhuma foto adicionada<br>
          <span class="text-xs">Clique no botão acima para adicionar</span>
        </div>
        
        <!-- Limite atingido -->
        <div x-show="photos.length >= ${maxPhotos}" class="text-sm text-orange-600 mt-2">
          ⚠️ Limite de ${maxPhotos} fotos atingido
        </div>
        
        <!-- Error message -->
        <div x-show="error" class="text-sm text-red-500 mt-2" style="display: none;">
          <span>⚠️</span> <span x-text="error"></span>
        </div>
        
        <!-- Info -->
        <div class="text-xs text-gray-500 mt-2">
          💡 As fotos serão redimensionadas automaticamente
        </div>
      </div>
    `;
  }

  /**
   * Retorna dados Alpine para o campo
   */
  getAlpineData() {
    const field = this.config;
    const maxPhotos = field.maxFiles || field.maxPhotos || 10;
    const maxWidth = field.maxWidth || 1920;
    const maxHeight = field.maxHeight || 1080;
    const quality = field.quality || 0.8;

    return {
      photos: [],
      error: null,

      init() {
        // Carregar fotos existentes do store
        const formStore = Alpine.store('form');
        const currentValue = formStore.getFieldValue('${field.id}');

        if (Array.isArray(currentValue)) {
          this.photos = currentValue;
        }

        console.log(`✅ GalleryField '${field.id}' initialized with ${this.photos.length} photos`);
      },

      async handleFilesSelect(event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        // Verificar limite
        const remaining = maxPhotos - this.photos.length;
        if (remaining <= 0) {
          this.error = 'Limite de fotos atingido';
          return;
        }

        const filesToProcess = files.slice(0, remaining);
        this.error = null;

        try {
          // Processar cada foto
          for (const file of filesToProcess) {
            if (!file.type.startsWith('image/')) continue;

            const dataUrl = await this.resizeImage(file, this._maxWidth, this._maxHeight, this._quality);

            this.photos.push({
              dataUrl: dataUrl,
              size: this.formatFileSize(dataUrl.length),
              timestamp: new Date().toISOString(),
              filename: file.name
            });
          }

          // Atualizar form store
          this.updateFormData();

          console.log(`📷 ${filesToProcess.length} photos added to gallery`);
        } catch (err) {
          console.error('Photo processing error:', err);
          this.error = 'Erro ao processar imagens: ' + err.message;
        }

        // Limpar input
        event.target.value = '';
      },

      removePhoto(index) {
        this.photos.splice(index, 1);
        this.updateFormData();
        console.log(`🗑️ Photo ${index + 1} removed`);
      },

      updateFormData() {
        const formStore = Alpine.store('form');
        formStore.setFieldValue('${field.id}', this.photos);
      },

      resizeImage(file, maxWidth, maxHeight, quality) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
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

              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);

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
      }
    };
  }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
  window.GalleryFieldV2 = GalleryFieldV2;
}

export { GalleryFieldV2 };
