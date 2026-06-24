/**
 * TimeField v2 - Versão modernizada
 * @typedef {import('../../types/form').FormField} FormField
 */

import BaseField from './BaseField.js';
import { getBrazilDateTimeParts } from '../defaults.js';

/**
 * Campo de hora modernizado
 * - Auto-preenchimento com hora atual (America/Sao_Paulo)
 * - Atualiza a cada minuto quando defaultToNow/autoCurrent
 * - Usa Alpine stores
 */
export default class TimeFieldV2 extends BaseField {
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
      <div x-data="timeField_${fieldId}" x-init="init()">
        <input
          type="time"
          id="${fieldId}"
          name="${this.config.name || fieldId}"
          x-model="$store.form.data['${fieldId}']"
          ${this.config.required ? 'required' : ''}
          ${this.config.min ? `min="${this.config.min}"` : ''}
          ${this.config.max ? `max="${this.config.max}"` : ''}
          ${this.config.step ? `step="${this.config.step}"` : ''}
          ${autoCurrent ? 'data-default-to-now="true" @change="$el.dataset.modified = \'true\'"' : ''}
          class="form-input time-input"
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
                let intervalId = null;

                const setCurrentTime = () => {
                    const formStore = Alpine.store('form');
                    const currentValue = formStore.getFieldValue('${field.id}');

                    if (!currentValue) {
                        const now = getBrazilDateTimeParts(new Date());
                        const timeStr = `${now.hours}:${now.minutes}`;
                        formStore.setFieldValue('${field.id}', timeStr);
                        console.log(`⏰ TimeField '${field.id}' auto-filled with current time: ${timeStr}`);
                    }
                };

                if (autoCurrent) {
                    setCurrentTime();

                    intervalId = setInterval(() => {
                        const inputEl = document.getElementById('${field.id}');
                        if (inputEl && inputEl.dataset.modified) {
                            return; // não sobrescrever valor manual
                        }

                        const now = getBrazilDateTimeParts(new Date());
                        const newTime = `${now.hours}:${now.minutes}`;

                        if (inputEl && inputEl.value !== newTime) {
                            inputEl.value = newTime;
                            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                        }

                        Alpine.store('form').setFieldValue('${field.id}', newTime);
                    }, 60000);

                    // Tenta limpar no `x-on:destroyed` quando suportado
                    const el = document.getElementById('${field.id}');
                    if (el) {
                        el.__timeFieldInterval = intervalId;
                    }
                }
            }
        };
    }
}

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.TimeFieldV2 = TimeFieldV2;
}

export { TimeFieldV2 };
