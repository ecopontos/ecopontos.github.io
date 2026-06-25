import InputFieldBase from './InputFieldBase.js';

/**
 * Campo de texto genérico para formulários
 * Suporta validação básica, placeholder e transformações de valor
 * Refatorado para usar InputFieldBase (Phase 3 consolidation)
 */
export default class TextField extends InputFieldBase {
  constructor(config) {
    super(config);
  }

  /**
   * Override to specify this is a text input
   */
  getInputType(config) {
    return config.type || 'text';
  }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
  window.TextField = TextField;
}