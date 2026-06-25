import BaseField from './BaseField.js';

export default class SelectorModalField extends BaseField {
  constructor(config) {
    super(config);
    this.options = config.options || [];
    this.modalTitle = config.modalTitle || 'Selecione uma opção';
  }

  render() {
    const fieldId = this.config.id;
    const selectedLabel = this.getSelectedLabel();
    
    const inputHtml = `
      <div class="selector-modal-container">
        <button type="button" class="selector-trigger" id="${fieldId}-trigger">
          ${selectedLabel || this.config.placeholder || 'Selecione...'}
          <span class="selector-arrow">▼</span>
        </button>
        
        <div class="selector-modal" id="${fieldId}-modal" style="display: none;">
          <div class="modal-header">
            <h3>${this.modalTitle}</h3>
            <button type="button" class="close-modal" id="${fieldId}-close">×</button>
          </div>
          <div class="modal-content">
            ${this.options.map(option => `
              <div class="modal-option ${this.value === option.value ? 'selected' : ''}" data-value="${option.value}">
                ${option.icon ? `<span class="option-icon">${option.icon}</span>` : ''}
                <span class="option-label">${option.label}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <input type="hidden" id="${fieldId}" name="${this.config.name || this.config.id}" value="${this.value || ''}" ${this.config.required ? 'required' : ''} />
      </div>
    `;
    return this.wrapField(inputHtml);
  }

  bindEvents() {
    super.bindEvents();
    
    const trigger = document.getElementById(`${this.config.id}-trigger`);
    const modal = document.getElementById(`${this.config.id}-modal`);
    const closeBtn = document.getElementById(`${this.config.id}-close`);
    const hiddenInput = document.getElementById(this.config.id);
    
    // Verificar se os elementos existem antes de acessá-los
    if (!trigger || !modal || !closeBtn || !hiddenInput) {
      console.warn(`SelectorModalField: Elementos DOM não encontrados para ${this.config.id}`);
      return;
    }
    
    const options = modal.querySelectorAll('.modal-option');
    
    // Abrir modal
    trigger.addEventListener('click', () => {
      modal.style.display = 'block';
    });
    
    // Fechar modal
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
    
    // Selecionar opção
    options.forEach(option => {
      option.addEventListener('click', (event) => {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.querySelector('.option-label').textContent;
        
        // Atualizar valor
        this.value = value;
        hiddenInput.value = value;
        trigger.textContent = label;
        
        // Atualizar UI
        options.forEach(opt => opt.classList.remove('selected'));
        event.currentTarget.classList.add('selected');
        
        // Fechar modal
        modal.style.display = 'none';
        
        this.trigger('change', this.value);
      });
    });
    
    // Fechar ao clicar fora
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  getSelectedLabel() {
    if (!this.value) return '';
    const selected = this.options.find(opt => opt.value === this.value);
    return selected ? selected.label : '';
  }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
  window.SelectorModalField = SelectorModalField;
}