/**
 * TextareaField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 */

import BaseField from './BaseField.js';

/**
 * Campo textarea modernizado
 * - Contador de caracteres
 * - Auto-resize opcional
 * - Usa Alpine stores
 */
export default class TextareaFieldV2 extends BaseField {
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
        const rows = this.config.rows || 4;
        const maxlength = this.config.maxlength;
        const showCounter = maxlength && this.config.showCounter !== false;
        const autoResize = this.config.autoResize === true;

        return `
      <div x-data="textareaField_${fieldId}" x-init="init()">
        <textarea
          id="${fieldId}"
          name="${this.config.name || fieldId}"
          x-model="$store.form.data['${fieldId}']"
          ${this.config.required ? 'required' : ''}
          ${maxlength ? `maxlength="${maxlength}"` : ''}
          ${this.config.placeholder ? `placeholder="${this.escapeHtml(this.config.placeholder)}"` : ''}
          rows="${rows}"
          ${autoResize ? `@input="resize()"` : ''}
          x-ref="textarea"
          class="form-input textarea-input"
          aria-label="${this.escapeHtml(this.config.label || fieldId)}"></textarea>
        
        ${showCounter ? `
          <div class="text-sm text-gray-600 mt-1 text-right">
            <span x-text="($store.form.data['${fieldId}'] || '').length"></span>
            <span>/</span>
            <span>${maxlength}</span>
            <span>caracteres</span>
          </div>
        ` : ''}
      </div>
    `;
    }

    /**
     * Retorna dados Alpine para o campo
     */
    getAlpineData() {
        const field = this.config;
        const autoResize = field.autoResize === true;

        if (!autoResize) {
            return {};
        }

        return {
            init() {
                // Auto-resize inicial
                this.resize();
            },

            resize() {
                const textarea = this.$refs.textarea;
                if (!textarea) return;

                // Reset height to auto to get correct scrollHeight
                textarea.style.height = 'auto';

                // Set height to scrollHeight
                textarea.style.height = textarea.scrollHeight + 'px';
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.TextareaFieldV2 = TextareaFieldV2;
}

export { TextareaFieldV2 };
