// js/fields/types/GroupField.js
import BaseField from './BaseField.js';
import { FieldFactory } from '../FieldFactory.js';

export default class GroupField extends BaseField {
  constructor(config = {}) {
    super(config);
    this.subFields = [];
    this.initSubFields();
  }

  initSubFields() {
    if (this.config.campos && Array.isArray(this.config.campos)) {
      this.subFields = this.config.campos.map(fieldConfig => {
        // Pass the Alpine instance and formData to subfields
        return FieldFactory.create(fieldConfig, this.config.formData, this.Alpine);
      });
    }
  }

  render() {
    const groupId = this.config.id;
    const groupLabel = this.config.label ? `<legend class="group-legend">${this.escapeHtml(this.config.label)}</legend>` : '';
    const groupDesc = this.config.description ? `<div class="group-description"><small>${this.escapeHtml(this.config.description)}</small></div>` : '';

    // Render all subfields
    const subFieldsHtml = this.subFields.map(field => field.render()).join('\n');

    return `
      <fieldset class="field-group" id="${groupId}" data-field-type="group">
        ${groupLabel}
        ${groupDesc}
        <div class="group-fields">
          ${subFieldsHtml}
        </div>
      </fieldset>
    `;
  }

  renderInput() {
    // GroupField doesn't render a single input, it renders subfields
    return '';
  }

  getValue() {
    // Return an object with all subfield values
    const groupValue = {};
    this.subFields.forEach(field => {
      const fieldId = field.config.id;
      const fieldValue = field.getValue();
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        groupValue[fieldId] = fieldValue;
      }
    });
    return groupValue;
  }

  setValue(value) {
    if (value && typeof value === 'object') {
      this.subFields.forEach(field => {
        const fieldId = field.config.id;
        if (value.hasOwnProperty(fieldId)) {
          field.setValue(value[fieldId]);
        }
      });
    }
  }

  validate() {
    let isValid = true;
    this.subFields.forEach(field => {
      if (!field.validate()) {
        isValid = false;
      }
    });
    this.isValid = isValid;
    return isValid;
  }

  getDefaultValue() {
    return {};
  }

  getAlpineData() {
    // GroupField doesn't provide Alpine data directly - subfields handle their own data
    return null;
  }

  registerAlpineComponent() {
    // Register Alpine component for the group itself
    super.registerAlpineComponent();

    // Register Alpine components for all subfields
    this.subFields.forEach(field => {
      if (typeof field.registerAlpineComponent === 'function') {
        try {
          field.registerAlpineComponent();
          console.debug(`GroupField: Registrado Alpine para subcampo ${field.config.id}`);
        } catch (error) {
          console.warn(`GroupField: Erro ao registrar Alpine para subcampo ${field.config.id}:`, error);
        }
      }
      
      // Also manually register Alpine data for subfields if Alpine is available
      if (this.Alpine && typeof field.getAlpineData === 'function') {
        const fieldData = field.getAlpineData();
        if (fieldData) {
          const fieldName = `field_${field.config.id}_data`;
          try {
            this.Alpine.data(fieldName, () => fieldData);
            console.debug(`GroupField: Registrado dados Alpine para subcampo ${field.config.id} como ${fieldName}`);
            
            // Also set as global variable for compatibility
            if (typeof window !== 'undefined') {
              window[fieldName] = fieldData;
              console.debug(`GroupField: Definido window.${fieldName} para subcampo ${field.config.id}`);
            }
          } catch (error) {
            console.warn(`GroupField: Erro ao registrar dados Alpine para subcampo ${field.config.id}:`, error);
          }
        }
      }
    });
  }
}