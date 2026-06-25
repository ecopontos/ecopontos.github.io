import BaseField from './BaseField.js';
import { computeDefaultValue } from '../defaults.js';

export default class DateTimeField extends BaseField {
    renderInput() {
        // BaseField já sanitiza e coloca em config.id
        const fieldId = this.config.id;
        // Use the resolved value (this.value) so defaultToNow is reflected in the rendered input
        const resolvedValue = this.value || this.getDefaultValue() || '';

        return `<input 
            type="datetime-local" 
            id="${fieldId}" 
            name="${this.config.name || this.config.id}" 
            x-model="formData['${fieldId}']"
            ${resolvedValue ? `value="${this.escapeHtml(resolvedValue)}"` : ''}
            ${this.config.required ? 'required' : ''}
            ${this.config.min ? `min="${this.config.min}"` : ''}
            ${this.config.max ? `max="${this.config.max}"` : ''}
            ${this.config.step ? `step="${this.config.step}"` : ''}
            ${this.config.defaultToNow || this.config.autoCurrent ? 'data-default-to-now="true" @change="$el.dataset.modified = \'true\'"' : ''}
            class="form-input datetime-field"
        />`;
    }

    getDefaultValue() {
        return computeDefaultValue({
            type: this.config.type || this.config.tipo,
            defaultToNow: this.config.defaultToNow,
            value: this.config.value,
            defaultValue: this.config.defaultValue
        });
    }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
    window.DateTimeField = DateTimeField;
}