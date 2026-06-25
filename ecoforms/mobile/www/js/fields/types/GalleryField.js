import BaseField from './BaseField.js';
// import { Camera, CameraResultType } from '../../vendor/camera-bundled.js';

// Polyfills
const CameraResultType = { Uri: 'uri', Base64: 'base64', DataUrl: 'dataUrl' };
const Camera = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera)
  ? window.Capacitor.Plugins.Camera
  : {
    getPhoto: async () => { return { dataUrl: '' }; },
    pickImages: async () => { console.warn('Gallery mock'); return { photos: [] }; }
  };

export default class GalleryField extends BaseField {
  constructor(config) {
    super(config);
  }

  render() {
    const fieldId = this.config.id;
    const label = this.config.label;
    const placeholder = this.config.placeholder || 'Adicionar fotos...';

    const styles = `
      .gallery-field-container {
        border: 2px dashed var(--color-primary, #1E3A5F);
        border-radius: 8px;
        padding: 16px;
        text-align: center;
        background: #f0fdfa;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .gallery-field-container:active {
        background: #ccfbf1 !important;
      }
      .gallery-preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      .gallery-image-item {
        position: relative;
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
        background: #eee;
      }
      .gallery-image-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .gallery-remove-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(0,0,0,0.5);
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
    `;

    // --- Definições de funções globais para este campo específico ---
    // (Movido para fora da string template para garantir execução)

    // Inicializa array no formData se necessário
    if (window.Alpine && window.formData) {
      if (!Array.isArray(window.formData[fieldId])) {
        window.formData[fieldId] = [];
      }
    }

    window[`pickImages_${fieldId}`] = async function () {
      try {
        // Camera.pickImages requires permission on Android 13+ sometimes handled automatically
        const result = await BaseField.importLibrary('Camera').pickImages({
          quality: 80,
          limit: 10 // Max 10 photos at once
        });

        const photos = result.photos;
        if (!photos || photos.length === 0) return;

        const currentFiles = window.formData[fieldId] || [];
        const processingMsg = document.createElement('div');
        processingMsg.textContent = 'Processando...';
        processingMsg.style.textAlign = 'center';
        const grid = document.getElementById(`${fieldId}_preview_grid`);
        if (grid) grid.after(processingMsg);

        for (const photo of photos) {
          // Convert webPath (blob url or file path) to Blob
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const filename = 'gallery_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.' + photo.format;
          const file = new File([blob], filename, { type: blob.type });

          currentFiles.push(file);
        }

        if (grid) processingMsg.remove();

        // Update Alpine
        if (window.Alpine && window.formData) {
          window.formData[fieldId] = [...currentFiles]; // Trigger reactivity
        }

        window[`renderGalleryPreviews_${fieldId}`]();

      } catch (error) {
        console.warn('Gallery pick cancelled or failed:', error);
      }
    };

    window[`renderGalleryPreviews_${fieldId}`] = function () {
      const grid = document.getElementById(`${fieldId}_preview_grid`);
      if (!grid) return;

      const files = (window.Alpine && window.formData && window.formData[fieldId]) || [];

      grid.innerHTML = files.map((file, index) => `
          <div class="gallery-image-item">
            <img src="${URL.createObjectURL(file)}">
            <button type="button" class="gallery-remove-btn" onclick="window.removeGalleryImage_${fieldId}(${index})">✕</button>
          </div>
        `).join('');
    };

    window[`removeGalleryImage_${fieldId}`] = function (index) {
      const files = window.formData[fieldId] || [];
      files.splice(index, 1);
      if (window.Alpine && window.formData) {
        window.formData[fieldId] = [...files];
      }
      window[`renderGalleryPreviews_${fieldId}`]();
    };

    return `
      <div class="field-container" data-field-type="gallery" x-init="window.renderGalleryPreviews_${fieldId}()">
        <label class="field-label" for="${fieldId}">${label}</label>
        
        <div class="gallery-preview-grid" id="${fieldId}_preview_grid"></div>
        
        <div class="gallery-field-container" style="margin-top: 10px;" onclick="window.pickImages_${fieldId}()">
          <div class="gallery-upload-text">
            <span style="color: var(--color-primary, #1E3A5F); font-weight: 600;">➕ ${this.escapeHtml(placeholder)}</span>
          </div>
        </div>

      </div>
      <style>${styles}</style>
    `;
  }
}

// Helper to bridge imports (redundant if CameraField handles it, but safe to duplicate or check existence)
if (!BaseField.importLibrary) {
  BaseField.importLibrary = (name) => {
    if (name === 'Camera') return Camera;
    if (name === 'CameraResultType') return CameraResultType;
    if (name === 'CameraSource') return CameraResultType;
    return null;
  };
}
