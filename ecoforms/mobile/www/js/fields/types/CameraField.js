import BaseField from './BaseField.js';
// import { Camera, CameraResultType, CameraSource } from '../../vendor/camera-bundled.js';

// Polyfills for missing exports from camera-bundled.js
const CameraResultType = { Uri: 'uri', Base64: 'base64', DataUrl: 'dataUrl' };
const CameraSource = { Prompt: 'PROMPT', Camera: 'CAMERA', Photos: 'PHOTOS' };

// Try to get Camera from Capacitor global or mock it
const Camera = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera)
  ? window.Capacitor.Plugins.Camera
  : {
    getPhoto: async () => {
      console.warn('Camera plugin not found, using mock');
      // Simple file input fallback could go here, but for now just warn
      return { dataUrl: '' };
    },
    pickImages: async () => { return { photos: [] }; }
  };

export default class CameraField extends BaseField {
  constructor(config) {
    super(config);
    // Register global functions for this field instance
    this.setupGlobalFunctions();
  }

  setupGlobalFunctions() {
    const fieldId = this.config.id;

    // Helper to convert DataURL to File
    window[`dataURLtoFile_${fieldId}`] = (dataurl, filename) => {
      var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    };

    window[`takePicture_${fieldId}`] = async () => {
      try {
        const image = await BaseField.importLibrary('Camera').getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: BaseField.importLibrary('CameraResultType').DataUrl,
          source: BaseField.importLibrary('CameraSource').Prompt
        });

        if (image.dataUrl) {
          const previewContainer = document.getElementById(`${fieldId}_preview_container`);
          const preview = document.getElementById(`${fieldId}_preview`);
          const area = document.getElementById(`${fieldId}-area`);
          const statusInput = document.getElementById(`${fieldId}_status`);

          // Mostrar preview
          if (preview) preview.src = image.dataUrl;
          if (previewContainer) previewContainer.style.display = 'block';
          if (area) area.style.display = 'none';

          // Criar arquivo
          const filename = 'photo_' + Date.now() + '.' + image.format;
          // Call the window-attached function we just defined
          const file = window[`dataURLtoFile_${fieldId}`](image.dataUrl, filename);

          // Atualizar Alpine
          if (window.Alpine && window.formData) {
            window.formData[fieldId] = file;
          }

          // Atualizar status para validação
          if (statusInput) statusInput.value = 'valid';
        }
      } catch (error) {
        console.warn('Câmera fechada ou erro:', error);
        console.error(error);
      }
    };

    window[`clearPicture_${fieldId}`] = () => {
      const previewContainer = document.getElementById(`${fieldId}_preview_container`);
      const area = document.getElementById(`${fieldId}-area`);
      const statusInput = document.getElementById(`${fieldId}_status`);

      if (previewContainer) previewContainer.style.display = 'none';
      if (area) area.style.display = 'block';

      if (window.Alpine && window.formData) {
        window.formData[fieldId] = null;
      }
      if (statusInput) statusInput.value = '';
    };
  }

  renderInput() {
    const fieldId = this.config.id;
    const placeholder = this.config.placeholder || 'Tirar ou selecionar foto...';

    return `
      <div class="camera-field">
        <div class="camera-upload-area" id="${fieldId}-area" style="
          border: 2px dashed var(--color-primary, #1E3A5F);
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          background: #f0fdfa;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        " onclick="window.takePicture_${fieldId}()">
          <div class="camera-upload-text">
            <span style="color: var(--color-primary, #1E3A5F); font-weight: 600; font-size: 14px;">📷 ${this.escapeHtml(placeholder)}</span>
          </div>
          <!-- Hidden input for validation status only -->
          <input 
            type="text" 
            id="${fieldId}_status" 
            ${this.config.required ? 'required' : ''}
            style="opacity: 0; height: 0; width: 0; position: absolute;"
          />
        </div>
        <div class="camera-preview" id="${fieldId}_preview_container" style="margin-top: 10px; display: none; text-align: center;">
          <img id="${fieldId}_preview" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
          <button type="button" onclick="window.clearPicture_${fieldId}()" style="
            display: block;
            margin: 8px auto;
            background: #ef4444;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
          ">Remover Foto</button>
        </div>
      </div>
      <style>
        #${fieldId}-area:active {
          transform: scale(0.98);
          background: #ccfbf1 !important;
        }
      </style>
    `;
  }
}

// Helper to bridge the module imports to the global scope functions
BaseField.importLibrary = (name) => {
  if (name === 'Camera') return Camera;
  if (name === 'CameraResultType') return CameraResultType;
  if (name === 'CameraSource') return CameraSource;
  return null;
};

if (typeof window !== 'undefined') {
  window.CameraField = CameraField;
}