/**
 * SelectField v2 - Versão modernizada usando hooks e Alpine stores
 * @typedef {import('../../types/form').FormField} FormField
 * @typedef {import('../../types/form').FieldOption} FieldOption
 */

import BaseField from './BaseField.js';

/**
 * SelectField modernizado
 * - Usa Alpine stores ao invés de window.*
 * - Usa hooks para carregar opções
 * - TypeScript via JSDoc
 * - Código mais limpo e testável
 */
export default class SelectFieldV2 extends BaseField {
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
        const isMultiple = !!this.config.multiple;
        const showEmpty = !this.config.required && !isMultiple;
        const emptyLabel = this.config.emptyOptionLabel || 'Selecione...';

        return `
      <div x-data="selectField_${fieldId}" x-init="init()">
        <select
          id="${fieldId}"
          name="${this.config.name || fieldId}"
          ${this.config.required ? 'required' : ''}
          ${isMultiple ? 'multiple' : ''}
          class="form-input select-field"
          x-model="$store.form.data['${fieldId}']"
          :disabled="loading"
          aria-label="${this.escapeHtml(this.config.label || fieldId)}">
          
          ${showEmpty ? `<option value="">${this.escapeHtml(emptyLabel)}</option>` : ''}
          
          <template x-for="option in options" :key="option.value">
            <option :value="option.value" x-text="option.label"></option>
          </template>
        </select>
        
        <!-- Loading indicator -->
        <div x-show="loading" class="text-sm text-gray-500 mt-1" style="display: none;">
          <span class="inline-block animate-spin">⏳</span> Carregando opções...
        </div>
        
        <!-- Error message -->
        <div x-show="error" class="text-sm text-red-500 mt-1" style="display: none;">
          <span>⚠️</span> <span x-text="error"></span>
        </div>
      </div>
    `;
    }

    /**
     * Retorna dados Alpine para o campo
     * Usa hook useFieldOptions para carregar opções
     */
    getAlpineData() {
        const field = this.config;

        return {
            /** @type {FieldOption[]} */
            options: [],
            loading: true,
            error: null,

            async init() {
                try {
                    // Usar hook para carregar opções
                    const { options, loading, error } = window.useFieldOptions(field);

                    // Observar mudanças reativas
                    Alpine.effect(() => {
                        this.options = options;
                        this.loading = loading;
                        this.error = error;
                    });

                    // Log para debug
                    console.log(`✅ SelectField '${field.id}' initialized with ${this.options.length} options`);
                } catch (err) {
                    console.error(`❌ Error initializing SelectField '${field.id}':`, err);
                    this.error = err.message;
                    this.loading = false;
                }
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.SelectFieldV2 = SelectFieldV2;
}

export { SelectFieldV2 };
