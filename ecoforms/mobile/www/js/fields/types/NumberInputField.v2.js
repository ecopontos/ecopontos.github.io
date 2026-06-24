/**
 * NumberInputField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 */

import BaseField from './BaseField.js';

/**
 * Campo numérico modernizado
 * - Validação de min/max
 * - Suporte a step
 * - Usa Alpine stores
 */
export default class NumberInputFieldV2 extends BaseField {
    /**
     * @param {FormField} config
     */
    constructor(config) {
        super(config);
    }

    /**
     * Renderiza o input do campo
     * @returns {string} HTML do campo
     */
    renderInput() {
        const fieldId = this.config.id;
        const min = this.config.min !== undefined ? this.config.min : '';
        const max = this.config.max !== undefined ? this.config.max : '';
        const step = this.config.step !== undefined ? this.config.step : 'any';

        return `
      <input
        type="number"
        id="${fieldId}"
        name="${this.config.name || fieldId}"
        x-model.number="$store.form.data['${fieldId}']"
        ${this.config.required ? 'required' : ''}
        ${min !== '' ? `min="${min}"` : ''}
        ${max !== '' ? `max="${max}"` : ''}
        ${step !== '' ? `step="${step}"` : ''}
        ${this.config.placeholder ? `placeholder="${this.escapeHtml(this.config.placeholder)}"` : ''}
        class="form-input number-input"
        aria-label="${this.escapeHtml(this.config.label || fieldId)}">
    `;
    }

    /**
     * Retorna dados Alpine para o campo
     */
    getAlpineData() {
        return {}; // Input simples não precisa de dados Alpine
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.NumberInputFieldV2 = NumberInputFieldV2;
}

export { NumberInputFieldV2 };
