/**
 * CheckboxField v2 - Versão modernizada usando hooks e Alpine stores
 * @typedef {import('../../types/form').FormField} FormField
 * @typedef {import('../../types/form').FieldOption} FieldOption
 */

import BaseField from './BaseField.js';

/**
 * CheckboxField modernizado
 * - Suporta checkbox único ou múltiplo
 * - Usa Alpine stores ao invés de window.*
 * - Usa hooks para carregar opções
 * - TypeScript via JSDoc
 */
export default class CheckboxFieldV2 extends BaseField {
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
        const isMultiple = this.config.multiple !== false; // Default: true para checkbox
        const layout = this.config.layout || 'vertical';

        // Checkbox único (boolean)
        if (!isMultiple) {
            return this.renderSingleCheckbox();
        }

        // Checkboxes múltiplos (array)
        return this.renderMultipleCheckboxes();
    }

    /**
     * Renderiza checkbox único (valor boolean)
     * @returns {string}
     */
    renderSingleCheckbox() {
        const fieldId = this.config.id;
        const label = this.config.label || this.config.id;

        return `
      <div x-data="checkboxField_${fieldId}" x-init="init()">
        <label class="checkbox-single" for="${fieldId}">
          <input
            type="checkbox"
            id="${fieldId}"
            name="${fieldId}"
            x-model="$store.form.data['${fieldId}']"
            ${this.config.required ? 'required' : ''}
            class="checkbox-input">
          
          <span class="checkbox-label">
            <span class="checkbox-text">${this.escapeHtml(label)}</span>
            ${this.config.description ? `
              <span class="checkbox-description text-sm text-gray-600">
                ${this.escapeHtml(this.config.description)}
              </span>
            ` : ''}
          </span>
        </label>
      </div>
    `;
    }

    /**
     * Renderiza checkboxes múltiplos (valor array)
     * @returns {string}
     */
    renderMultipleCheckboxes() {
        const fieldId = this.config.id;
        const layout = this.config.layout || 'vertical';

        return `
      <div x-data="checkboxField_${fieldId}" x-init="init()">
        <!-- Loading state -->
        <div x-show="loading" class="text-sm text-gray-500" style="display: none;">
          <span class="inline-block animate-spin">⏳</span> Carregando opções...
        </div>
        
        <!-- Checkbox options -->
        <div x-show="!loading" 
             class="checkbox-group ${layout === 'horizontal' ? 'checkbox-group-horizontal' : 'checkbox-group-vertical'}"
             role="group"
             :aria-label="'${this.escapeHtml(this.config.label || fieldId)}'">
          
          <template x-for="(option, index) in options" :key="option.value">
            <label class="checkbox-option" :for="'${fieldId}_' + index">
              <input
                type="checkbox"
                :id="'${fieldId}_' + index"
                :name="'${fieldId}[]'"
                :value="option.value"
                x-model="selectedValues"
                @change="updateFormData()"
                class="checkbox-input">
              
              <span class="checkbox-label">
                <!-- Icon se disponível -->
                <span x-show="option.icon" x-text="option.icon" class="checkbox-icon"></span>
                
                <!-- Label -->
                <span x-text="option.label" class="checkbox-text"></span>
                
                <!-- Description se disponível -->
                <span x-show="option.description" 
                      x-text="option.description" 
                      class="checkbox-description"></span>
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
        
        <!-- Selected count -->
        <div x-show="options.length > 0 && selectedValues.length > 0" 
             class="text-sm text-gray-600 mt-2"
             style="display: none;">
          <span x-text="selectedValues.length"></span> 
          <span x-text="selectedValues.length === 1 ? 'item selecionado' : 'itens selecionados'"></span>
        </div>
      </div>
    `;
    }

    /**
     * Retorna dados Alpine para o campo
     */
    getAlpineData() {
        const field = this.config;
        const isMultiple = field.multiple !== false;

        return {
            /** @type {FieldOption[]} */
            options: [],
            loading: isMultiple, // Só carrega se for múltiplo
            error: null,

            /** @type {any[]} */
            selectedValues: [],

            async init() {
                // Checkbox único não precisa carregar opções
                if (!isMultiple) {
                    this.loading = false;
                    return;
                }

                try {
                    // Usar hook para carregar opções
                    const { options, loading, error } = window.useFieldOptions(field);

                    // Observar mudanças reativas
                    Alpine.effect(() => {
                        this.options = options;
                        this.loading = loading;
                        this.error = error;
                    });

                    // Inicializar valores selecionados do store
                    const formStore = Alpine.store('form');
                    const currentValue = formStore.getFieldValue('${field.id}');
                    if (Array.isArray(currentValue)) {
                        this.selectedValues = [...currentValue];
                    }

                    console.log(`✅ CheckboxField '${field.id}' initialized with ${this.options.length} options`);
                } catch (err) {
                    console.error(`❌ Error initializing CheckboxField '${field.id}':`, err);
                    this.error = err.message;
                    this.loading = false;
                }
            },

            /**
             * Atualiza o form store quando checkboxes mudam
             */
            updateFormData() {
                const formStore = Alpine.store('form');
                formStore.setFieldValue('${field.id}', this.selectedValues);
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.CheckboxFieldV2 = CheckboxFieldV2;
}

export { CheckboxFieldV2 };
