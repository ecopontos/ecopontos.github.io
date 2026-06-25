/**
 * ChipsField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 * @typedef {import('../../types/form').FieldOption} FieldOption
 */

import BaseField from './BaseField.js';

/**
 * Campo de chips/tags modernizado
 * - Seleção múltipla visual
 * - Adicionar/remover chips
 * - Usa Alpine stores
 */
export default class ChipsFieldV2 extends BaseField {
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

    return `
      <div x-data="chipsField_${fieldId}" x-init="init()">
        <!-- Selected chips display -->
        <div class="chips-container flex flex-wrap gap-2 mb-3">
          <template x-for="chip in selectedChips" :key="chip.value">
            <div class="chip inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
              <span x-show="chip.icon" x-text="chip.icon"></span>
              <span x-text="chip.label"></span>
              <button type="button" 
                      @click="removeChip(chip)"
                      class="chip-remove hover:text-blue-900"
                      :aria-label="'Remover ' + chip.label">
                ×
              </button>
            </div>
          </template>
          
          <div x-show="selectedChips.length === 0" class="text-gray-400 italic text-sm">
            Nenhum item selecionado
          </div>
        </div>
        
        <!-- Available options -->
        <div x-show="!loading && availableOptions.length > 0" 
             class="chips-options flex flex-wrap gap-2">
          <template x-for="option in availableOptions" :key="option.value">
            <button type="button"
                    @click="addChip(option)"
                    class="chip-option px-3 py-1 border border-gray-300 rounded-full hover:bg-gray-50 transition">
              <span x-show="option.icon" x-text="option.icon"></span>
              <span x-text="option.label"></span>
            </button>
          </template>
        </div>
        
        <!-- Loading state -->
        <div x-show="loading" class="text-sm text-gray-500" style="display: none;">
          <span class="inline-block animate-spin">⏳</span> Carregando opções...
        </div>
        
        <!-- Error state -->
        <div x-show="error" class="text-sm text-red-500 mt-2" style="display: none;">
          <span>⚠️</span> <span x-text="error"></span>
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
      allOptions: [],

      /** @type {FieldOption[]} */
      selectedChips: [],

      loading: true,
      error: null,

      get availableOptions() {
        // Opções que ainda não foram selecionadas
        const selectedValues = this.selectedChips.map(c => c.value);
        return this.allOptions.filter(opt => !selectedValues.includes(opt.value));
      },

      async init() {
        try {
          // Carregar opções
          const { options, loading, error } = window.useFieldOptions(field);

          Alpine.effect(() => {
            this.allOptions = options;
            this.loading = loading;
            this.error = error;
          });

          // Inicializar chips selecionados do store
          const formStore = Alpine.store('form');
          const currentValue = formStore.getFieldValue('${field.id}');

          const isMultiple = field.multiple !== false; // Default true if not specified, or check type?
          // Note: Basic Chips might imply single? Let's assume config.multiple governs. 

          if (currentValue) {
            if (Array.isArray(currentValue)) {
              this.selectedChips = currentValue
                .map(val => this.allOptions.find(opt => opt.value === val))
                .filter(Boolean);
            } else {
              // Single value case
              const found = this.allOptions.find(opt => opt.value === currentValue);
              if (found) this.selectedChips = [found];
            }
          }

          console.log(`✅ ChipsField '${field.id}' initialized`);
        } catch (err) {
          console.error(`❌ Error initializing ChipsField '${field.id}':`, err);
          this.error = err.message;
          this.loading = false;
        }
      },

      addChip(option) {
        const isMultiple = field.multiple !== false;

        if (isMultiple) {
          // Prevent duplicates
          if (!this.selectedChips.find(c => c.value === option.value)) {
            this.selectedChips.push(option);
          }
        } else {
          // Single select: replace
          this.selectedChips = [option];
        }
        this.updateFormData();
      },

      removeChip(chip) {
        const index = this.selectedChips.findIndex(c => c.value === chip.value);
        if (index > -1) {
          this.selectedChips.splice(index, 1);
          this.updateFormData();
        }
      },

      updateFormData() {
        const isMultiple = field.multiple !== false;

        if (isMultiple) {
          const values = this.selectedChips.map(c => c.value);
          Alpine.store('form').setFieldValue('${field.id}', values);
        } else {
          // Single value
          const value = this.selectedChips.length > 0 ? this.selectedChips[0].value : null;
          Alpine.store('form').setFieldValue('${field.id}', value);
        }
      }
    };
  }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
  window.ChipsFieldV2 = ChipsFieldV2;
}

export { ChipsFieldV2 };
