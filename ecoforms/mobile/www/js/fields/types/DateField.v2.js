/**
 * DateField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 */

import BaseField from './BaseField.js';

function getBrazilNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hours: parts.hour,
    minutes: parts.minute,
  };
}

/**
 * Campo de data modernizado
 * - Auto-preenchimento com data atual
 * - Validação de min/max
 * - Usa Alpine stores
 */
export default class DateFieldV2 extends BaseField {
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
        const autoCurrent = this.config.autoCurrent || this.config.defaultToNow;

        return `
      <div x-data="dateField_${fieldId}" x-init="init()">
        <input
          type="date"
          id="${fieldId}"
          name="${this.config.name || fieldId}"
          x-model="$store.form.data['${fieldId}']"
          ${this.config.required ? 'required' : ''}
          ${this.config.min ? `min="${this.config.min}"` : ''}
          ${this.config.max ? `max="${this.config.max}"` : ''}
          ${autoCurrent ? 'data-default-to-now="true" @change="$el.dataset.modified = \'true\'"' : ''}
          class="form-input date-input"
          aria-label="${this.escapeHtml(this.config.label || fieldId)}">
      </div>
    `;
    }

    /**
     * Retorna dados Alpine para o campo
     */
    getAlpineData() {
        const field = this.config;
        const autoCurrent = field.autoCurrent || field.defaultToNow;

        return {
            init() {
                // Auto-preencher com data atual se configurado
                if (autoCurrent) {
                    const formStore = Alpine.store('form');
                    const currentValue = formStore.getFieldValue('${field.id}');

                    if (!currentValue) {
                        const now = getBrazilNow();
                        const dateStr = `${now.year}-${now.month}-${now.day}`;
                        formStore.setFieldValue('${field.id}', dateStr);
                        console.log(`📅 DateField '${field.id}' auto-filled with current date: ${dateStr}`);
                    }
                }
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.DateFieldV2 = DateFieldV2;
}

export { DateFieldV2 };
