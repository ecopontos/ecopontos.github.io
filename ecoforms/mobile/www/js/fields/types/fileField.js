import BaseField from './BaseField.js';

export default class FileField extends BaseField {
  constructor(config) {
    super(config);
    this.accept = config.accept || '';
    this.multiple = config.multiple || false;
  }

  renderInput() {
    const fieldId = this.config.id;
    const placeholder = this.config.placeholder || 'Selecione ou arraste arquivo(s)...';
    
    return `
      <div class="file-upload-wrapper" data-field-type="file">
        <div class="file-upload-drop" id="${fieldId}-drop" style="
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          background: #fafafa;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        " tabindex="0" role="button" aria-label="Upload de arquivo">
          <div class="file-upload-text">
            <span class="file-upload-primary" style="color: #666; font-size: 14px;">${this.escapeHtml(placeholder)}</span>
            <div class="file-upload-secondary" style="color: #999; font-size: 12px; margin-top: 5px;">
              ${this.multiple ? 'Múltiplos arquivos permitidos' : 'Apenas um arquivo'}
            </div>
          </div>
          <input 
            type="file" 
            id="${fieldId}" 
            name="${this.config.name || this.config.id}" 
            ${this.config.required ? 'required' : ''}
            ${this.accept ? `accept="${this.accept}"` : ''}
            ${this.multiple ? 'multiple' : ''}
            class="file-hidden-input"
            style="display: none;"
            aria-hidden="true"
          />
        </div>
        <div class="file-upload-list" id="${fieldId}-list" aria-live="polite" style="margin-top: 10px;"></div>
        <style>
          #${fieldId}-drop:hover {
            border-color: #007bff !important;
            background: #f8f9fa !important;
          }
          #${fieldId}-drop.dragover {
            border-color: #007bff !important;
            background: #e3f2fd !important;
          }
          #${fieldId}-list ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          #${fieldId}-list li {
            padding: 8px 12px;
            background: #f8f9fa;
            border-radius: 4px;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          #${fieldId}-list .file-size {
            color: #666;
            font-size: 12px;
          }
        </style>
      </div>`;
  }

  bindEvents() {
    super.bindEvents();
    
    const input = document.getElementById(this.config.id);
    const drop = document.getElementById(`${this.config.id}-drop`);
    const list = document.getElementById(`${this.config.id}-list`);

    const renderList = (files) => {
      if (!list) return;
      if (!files || !files.length) { 
        list.innerHTML = '';
        // Restaurar texto original
        const primaryText = drop.querySelector('.file-upload-primary');
        if (primaryText) {
          primaryText.textContent = this.config.placeholder || 'Selecione ou arraste arquivo(s)...';
        }
        return;
      }
      
      // Atualizar texto principal
      const primaryText = drop.querySelector('.file-upload-primary');
      if (primaryText) {
        const fileText = files.length === 1 ? `1 arquivo selecionado` : `${files.length} arquivos selecionados`;
        primaryText.textContent = fileText;
      }
      
      // Mostrar lista de arquivos
      list.innerHTML = `<ul>${Array.from(files).map(f => 
        `<li>
          <span>${f.name}</span> 
          <span class="file-size">(${(f.size/1024).toFixed(1)} KB)</span>
        </li>`
      ).join('')}</ul>`;
    };

    if (input) {
      input.addEventListener('change', (e) => {
        const files = e.target.files;
        this.value = this.multiple ? Array.from(files) : files[0];
        renderList(files);
        if (typeof this.trigger === 'function') {
          this.trigger('change', this.value);
        }
      });
    }
    
    if (drop && input) {
      const activate = () => input.click();
      drop.addEventListener('click', activate);
      drop.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter' || e.key === ' ') { 
          e.preventDefault(); 
          activate(); 
        } 
      });
      
      ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, (e) => { 
        e.preventDefault(); 
        drop.classList.add('dragover'); 
      }));
      
      ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, (e) => { 
        e.preventDefault(); 
        drop.classList.remove('dragover'); 
      }));
      
      drop.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files) {
          try {
            input.files = e.dataTransfer.files; // some browsers allow assignment
          } catch (err) {
            // Fallback for browsers that don't allow direct assignment
            console.debug('Direct file assignment not supported, using DataTransfer');
          }
          const evt = new Event('change', { bubbles:true });
          input.dispatchEvent(evt);
        }
      });
    }
  }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
  window.FileField = FileField;
}