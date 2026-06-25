import InputFieldBase from './InputFieldBase.js';

/**
 * Campo de área de texto para formulários.
 * Refatorado para usar InputFieldBase (Phase 3 consolidation)
 */
export default class TextAreaField extends InputFieldBase {
  constructor(config) {
    super(config);
  }

  /**
   * Override to specify this uses textarea tag
   */
  getTagName(config) {
    return 'textarea';
  }

  /**
   * Override to specify this is a textarea input
   */
  getInputType(config) {
    return 'textarea';
  }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
  window.TextAreaField = TextAreaField;
}