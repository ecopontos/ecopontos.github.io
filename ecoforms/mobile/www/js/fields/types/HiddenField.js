import BaseField from './BaseField.js';

/**
 * Campo Oculto (Hidden)
 * Renderiza um input type="hidden" sem wrappers visuais
 */
export default class HiddenField extends BaseField {
  constructor(config) {
    super(config);
  }

  /**
   * Override render to return JUST the input, no wrappers
   */
  render() {
    const fieldId = this.config.id;
    const value = this.value !== undefined && this.value !== null ? this.value : '';
    
    // Ensure we have the x-model for Alpine binding if needed, 
    // but hidden fields might just use name/value standard form submission
    // We add x-model to keep it in sync with Alpine data if present
    const alpineModel = `x-model="formData['${fieldId}']"`;

    return `<input type="hidden" id="${fieldId}" name="${this.config.name || fieldId}" value="${this.escapeHtml(value)}" ${alpineModel} />`;
  }
}

if (typeof window !== 'undefined') {
  window.HiddenField = HiddenField;
}
