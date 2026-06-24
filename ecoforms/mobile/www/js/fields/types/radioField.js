import BaseField from './BaseField.js';

export default class RadioField extends BaseField {
  constructor(config) {
    super(config);
  }

  renderInput() {
    const fieldId = this.config.id;
    const options = this.config.options || [];
    
    let radioHtml = '';
    
    options.forEach((option, index) => {
      const value = typeof option === 'object' ? option.value : option;
      const label = typeof option === 'object' ? option.label : option;
      const radioId = `${fieldId}_${index}`;
      const checked = this.config.value === value ? 'checked' : '';
      
      radioHtml += `
        <div class="radio-option">
          <input 
            type="radio" 
            id="${radioId}" 
            name="${fieldId}" 
            value="${this.escapeHtml(value)}" 
            ${checked}
            ${this.config.required ? 'required' : ''}
            class="radio-input"
            x-model="formData['${fieldId}']"
          />
          <label for="${radioId}" class="radio-label">${this.escapeHtml(label)}</label>
        </div>
      `;
    });
    
    return `<div class="radio-group">${radioHtml}</div>`;
  }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
  window.RadioField = RadioField;
}