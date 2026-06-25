import BaseField from './BaseField.js';

export default class CardsRadioField extends BaseField {
  constructor(config) {
    super(config);
  }

  renderInput() {
    const fieldId = this.config.id;
    const options = this.config.options || [];
    
    let cardsHtml = '';
    
    options.forEach((option, index) => {
      const value = typeof option === 'object' ? option.value : option;
      const label = typeof option === 'object' ? option.label : option;
      const description = typeof option === 'object' ? option.description : '';
      const icon = typeof option === 'object' ? option.icon : '';
      const radioId = `${fieldId}_${index}`;
      const checked = this.config.value === value ? 'checked' : '';
      
      cardsHtml += `
        <div class="card-radio-option">
          <input 
            type="radio" 
            id="${radioId}" 
            name="${fieldId}" 
            value="${this.escapeHtml(value)}" 
            ${checked}
            ${this.config.required ? 'required' : ''}
            class="card-radio-input"
            x-model="formData['${fieldId}']"
            style="display: none;"
          />
          <label for="${radioId}" class="card-radio-label" style="display: block; padding: 15px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; margin-bottom: 10px;">
            ${icon ? `<div class="card-icon">${icon}</div>` : ''}
            <div class="card-title" style="font-weight: bold;">${this.escapeHtml(label)}</div>
            ${description ? `<div class="card-description" style="font-size: 0.9em; color: #666;">${this.escapeHtml(description)}</div>` : ''}
          </label>
        </div>
      `;
    });
    
    return `
      <div class="cards-radio-group">
        ${cardsHtml}
        <style>
          .card-radio-input:checked + .card-radio-label {
            border-color: #007bff !important;
            background-color: #f0f8ff !important;
          }
        </style>
      </div>
    `;
  }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
  window.CardsRadioField = CardsRadioField;
}