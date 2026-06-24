import InputFieldBase from './InputFieldBase.js';

/**
 * Campo para entrada de números.
 * Refatorado para usar InputFieldBase (Phase 3 consolidation)
 */
export default class NumberField extends InputFieldBase {
  constructor(config) {
    // Força o tipo 'number' e adiciona classe específica
    const numberConfig = { ...config, type: 'number' };
    super(numberConfig);
    
    // Adicionar classe específica para number
    this.config.attributes = this.config.attributes || {};
    const existing = this.config.attributes.class || '';
    this.config.attributes.class = (existing ? existing + ' ' : '') + 'number-field';
  }

  /**
   * Override to specify this is a number input
   */
  getInputType(config) {
    return 'number';
  }

  /**
   * Transform value to ensure it's a valid number
   */
  transformValue(value) {
    // Don't transform empty values
    if (value === '' || value === null || value === undefined) {
      return value;
    }
    
    // Ensure numeric values are properly formatted
    const numValue = parseFloat(value);
    return isNaN(numValue) ? value : numValue;
  }
}

// Opcional: registrar no window para acesso global, se necessário
if (typeof window !== 'undefined') {
  window.NumberField = NumberField;
}
