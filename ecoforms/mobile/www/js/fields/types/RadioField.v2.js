/**
 * RadioField v2 - Versão modernizada usando hooks e Alpine stores
 * @typedef {import('../../types/form').FormField} FormField
 * @typedef {import('../../types/form').FieldOption} FieldOption
 */

import BaseField from './BaseField.js';

/**
 * RadioField modernizado
 * - Usa Alpine stores ao invés de window.*
 * - Usa hooks para carregar opções
 * - TypeScript via JSDoc
 * - Layout responsivo
 */
export default class RadioFieldV2 extends BaseField {
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
        const layout = this.config.layout || 'vertical'; // 'vertical' ou 'horizontal'

        return `
      <div x-data="radioField_${fieldId}" x-init="init()">
        <!-- Loading state -->
        <div x-show="loading" class="text-sm text-gray-500" style="display: none;">
          <span class="inline-block animate-spin">⏳</span> Carregando opções...
        </div>
        
        <!-- Radio options -->
        <div x-show="!loading" 
             class="radio-group ${layout === 'horizontal' ? 'radio-group-horizontal' : 'radio-group-vertical'}"
             role="radiogroup"
             :aria-label="'${this.escapeHtml(this.config.label || fieldId)}'">
          
          <template x-for="(option, index) in options" :key="option.value">
            <label class="radio-option" :for="'${fieldId}_' + index">
              <input
                type="radio"
                :id="'${fieldId}_' + index"
                name="${fieldId}"
                :value="option.value"
                x-model="$store.form.data['${fieldId}']"
                ${this.config.required ? 'required' : ''}
                class="radio-input">
              
              <span class="radio-label">
                <!-- Icon se disponível -->
                <span x-show="option.icon" x-text="option.icon" class="radio-icon"></span>
                
                <!-- Label -->
                <span x-text="option.label" class="radio-text"></span>
                
                <!-- Description se disponível -->
                <span x-show="option.description" 
                      x-text="option.description" 
                      class="radio-description"></span>
              </span>
            </label>
          </template>
        </div>
        
        <!-- Error message -->
        <div x-show="error" class="text-sm text-red-500 mt-2" style="display: none;">
          <span>⚠️</span> <span x-text="error"></span>
        </div>
        
        <!-- No options message -->
        <div x-show="!loading && options.length === 0" 
             class="text-sm text-gray-500 italic"
             style="display: none;">
          Nenhuma opção disponível
        </div>
      </div>
    `;
    }

    /**
     * Retorna dados Alpine para o campo
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

                    console.log(`✅ RadioField '${field.id}' initialized with ${this.options.length} options`);
                } catch (err) {
                    console.error(`❌ Error initializing RadioField '${field.id}':`, err);
                    this.error = err.message;
                    this.loading = false;
                }
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.RadioFieldV2 = RadioFieldV2;
}

export { RadioFieldV2 };
