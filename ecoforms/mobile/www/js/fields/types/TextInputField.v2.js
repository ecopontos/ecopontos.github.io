/**
 * TextInputField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 */

import BaseField from './BaseField.js';

/**
 * Campo de texto modernizado
 * - Suporta autocomplete via dataSource
 * - Usa Alpine stores
 * - TypeScript via JSDoc
 */
export default class TextInputFieldV2 extends BaseField {
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
        const hasDataSource = !!(this.config.dataSource || this.config.source);

        // Se tem dataSource, usar autocomplete
        if (hasDataSource) {
            return this.renderAutocomplete();
        }

        // Input de texto simples
        return `
      <input
        type="text"
        id="${fieldId}"
        name="${this.config.name || fieldId}"
        x-model="$store.form.data['${fieldId}']"
        ${this.config.required ? 'required' : ''}
        ${this.config.placeholder ? `placeholder="${this.escapeHtml(this.config.placeholder)}"` : ''}
        ${this.config.maxlength ? `maxlength="${this.config.maxlength}"` : ''}
        ${this.config.pattern ? `pattern="${this.escapeHtml(this.config.pattern)}"` : ''}
        class="form-input text-input"
        aria-label="${this.escapeHtml(this.config.label || fieldId)}">
    `;
    }

    /**
     * Renderiza input com autocomplete
     * @returns {string}
     */
    renderAutocomplete() {
        const fieldId = this.config.id;

        return `
      <div x-data="textInputField_${fieldId}" x-init="init()">
        <div class="relative">
          <input
            type="text"
            id="${fieldId}"
            name="${this.config.name || fieldId}"
            x-model="inputValue"
            @input="handleInput()"
            @focus="showSuggestions = true"
            @blur="hideSuggestions()"
            ${this.config.required ? 'required' : ''}
            ${this.config.placeholder ? `placeholder="${this.escapeHtml(this.config.placeholder)}"` : ''}
            class="form-input text-input"
            autocomplete="off"
            aria-label="${this.escapeHtml(this.config.label || fieldId)}"
            :aria-expanded="showSuggestions && filteredOptions.length > 0">
          
          <!-- Suggestions dropdown -->
          <div x-show="showSuggestions && filteredOptions.length > 0"
               class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
               style="display: none;"
               role="listbox">
            <template x-for="(option, index) in filteredOptions" :key="option.value">
              <div @mousedown.prevent="selectOption(option)"
                   class="px-4 py-2 cursor-pointer hover:bg-blue-50"
                   :class="{ 'bg-blue-100': index === selectedIndex }"
                   role="option">
                <span x-text="option.label"></span>
              </div>
            </template>
          </div>
        </div>
        
        <!-- Loading indicator -->
        <div x-show="loading" class="text-sm text-gray-500 mt-1" style="display: none;">
          <span class="inline-block animate-spin">⏳</span> Carregando sugestões...
        </div>
      </div>
    `;
    }

    /**
     * Retorna dados Alpine para o campo
     */
    getAlpineData() {
        const field = this.config;
        const hasDataSource = !!(field.dataSource || field.source);

        if (!hasDataSource) {
            return {}; // Input simples não precisa de dados Alpine
        }

        return {
            inputValue: '',
            options: [],
            filteredOptions: [],
            showSuggestions: false,
            selectedIndex: -1,
            loading: true,

            async init() {
                // Carregar opções
                const { options, loading } = window.useFieldOptions(field);

                Alpine.effect(() => {
                    this.options = options;
                    this.loading = loading;
                });

                // Inicializar valor do store
                const formStore = Alpine.store('form');
                const currentValue = formStore.getFieldValue('${field.id}');
                if (currentValue) {
                    this.inputValue = currentValue;
                }

                console.log(`✅ TextInputField '${field.id}' initialized with autocomplete`);
            },

            handleInput() {
                const value = this.inputValue.toLowerCase();

                // Atualizar form store
                Alpine.store('form').setFieldValue('${field.id}', this.inputValue);

                // Filtrar opções
                if (value.length > 0) {
                    this.filteredOptions = this.options.filter(opt =>
                        opt.label.toLowerCase().includes(value)
                    ).slice(0, 10); // Limitar a 10 sugestões
                } else {
                    this.filteredOptions = [];
                }

                this.selectedIndex = -1;
            },

            selectOption(option) {
                this.inputValue = option.label;
                Alpine.store('form').setFieldValue('${field.id}', option.value);
                this.showSuggestions = false;
                this.filteredOptions = [];
            },

            hideSuggestions() {
                setTimeout(() => {
                    this.showSuggestions = false;
                }, 200);
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.TextInputFieldV2 = TextInputFieldV2;
}

export { TextInputFieldV2 };
