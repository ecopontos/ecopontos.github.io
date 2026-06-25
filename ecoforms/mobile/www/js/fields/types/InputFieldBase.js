// js/fields/types/InputFieldBase.js
import BaseField from './BaseField.js';

/**
 * Base class for input fields (text, textarea, number, password, etc.)
 * Provides common functionality for form input elements
 * Part of Phase 3 field consolidation
 */
class InputFieldBase extends BaseField {
  constructor(config = {}) {
    super(config);
    
    // Input-specific properties
    this.inputType = this.getInputType(config);
    this.tagName = this.getTagName(config);
    this.isTextarea = this.tagName === 'textarea';
    
    // Special handlers and behaviors
    this.uppercaseHandler = config.uppercase || config.forceUppercase || false;
    this.isReadonly = this.determineReadonlyState(config);
    
    // Validation and constraints
    this.constraints = this.extractConstraints(config);
    this.extraAttributes = this.extractExtraAttributes(config);
  }

  /**
   * Determine the input type based on configuration
   */
  getInputType(config) {
    // Override in subclasses for specific types
    return config.type || 'text';
  }

  /**
   * Determine the HTML tag name (input or textarea)
   */
  getTagName(config) {
    // Override in subclasses (e.g., TextAreaField returns 'textarea')
    return 'input';
  }

  /**
   * Determine if the field is readonly
   */
  determineReadonlyState(config) {
    return !!(config.readonly || (config.attributes && config.attributes.readonly !== undefined));
  }

  /**
   * Extract validation constraints from configuration
   */
  extractConstraints(config) {
    const constraints = {};
    
    // Standard HTML5 validation attributes
    if (config.required) constraints.required = true;
    if (config.minlength) constraints.minlength = config.minlength;
    if (config.maxlength) constraints.maxlength = config.maxlength;
    if (config.pattern) constraints.pattern = config.pattern;
    if (config.min) constraints.min = config.min;
    if (config.max) constraints.max = config.max;
    if (config.step) constraints.step = config.step;
    if (config.rows) constraints.rows = config.rows; // for textarea
    if (config.cols) constraints.cols = config.cols; // for textarea
    
    return constraints;
  }

  /**
   * Extract extra attributes from configuration
   */
  extractExtraAttributes(config) {
    let extraAttrs = '';
    
    if (config.attributes && typeof config.attributes === 'object') {
      Object.keys(config.attributes).forEach(key => {
        const value = config.attributes[key];
        // Handle boolean attributes
        if (value === true) {
          extraAttrs += ` ${key}="${key}"`;
        } else if (value === false || value === null) {
          // Skip false/null attributes
          return;
        } else {
          // Escape quotes in attribute values
          extraAttrs += ` ${key}="${String(value).replace(/"/g, '&quot;')}"`;
        }
      });
    }
    
    return extraAttrs;
  }

  /**
   * Get common input attributes as string
   */
  getCommonInputAttributes() {
    const fieldId = this.config.id;
    
    let attrs = [];
    
    // Basic attributes
    if (!this.isTextarea) {
      attrs.push(`type="${this.inputType}"`);
    }
    attrs.push(`id="${fieldId}"`);
    attrs.push(`name="${this.config.name || fieldId}"`);
    attrs.push(`placeholder="${this.config.placeholder || ''}"`);
    
    // Validation constraints
    Object.entries(this.constraints).forEach(([key, value]) => {
      if (value === true) {
        attrs.push(key);
      } else {
        attrs.push(`${key}="${value}"`);
      }
    });
    
    // CSS classes
    const baseClasses = ['form-input', `${this.inputType}-field`];
    if (this.config.attributes && this.config.attributes.class) {
      baseClasses.push(this.config.attributes.class);
    }
    attrs.push(`class="${baseClasses.join(' ')}"`);
    
    // Alpine.js model binding
    attrs.push(`x-model="formData['${fieldId}']"`);
    
    // Special handlers
    if (this.uppercaseHandler) {
      attrs.push(`@input="formData['${fieldId}'] = $event.target.value.toUpperCase(); $event.target.value = $event.target.value.toUpperCase();"`);
    }
    
    // Readonly state
    if (this.isReadonly) {
      attrs.push('readonly');
    }
    
    return attrs.join(' ');
  }

  /**
   * Render the input element
   */
  renderInput() {
    const commonAttrs = this.getCommonInputAttributes();
    const extraAttrs = this.extraAttributes;
    const resolvedValue = this.value || '';
    
    if (this.isTextarea) {
      return `<textarea ${commonAttrs} ${extraAttrs}>${this.escapeHtml(resolvedValue)}</textarea>`;
    } else {
      const valueAttr = resolvedValue ? `value="${this.escapeHtml(resolvedValue)}"` : '';
      return `<input ${commonAttrs} ${valueAttr} ${extraAttrs} />`;
    }
  }

  /**
   * Get Alpine.js data for the field
   */
  getAlpineData() {
    const fieldId = this.config.id;
    
    if (this.uppercaseHandler) {
      return {
        init() {
          // Watch for changes and ensure uppercase
          this.$watch(`formData['${fieldId}']`, (newValue) => {
            if (newValue && typeof newValue === 'string') {
              const upperValue = newValue.toUpperCase();
              if (upperValue !== newValue) {
                this.formData[fieldId] = upperValue;
              }
            }
          });
        }
      };
    }
    
    return {};
  }

  /**
   * Get field value
   */
  getValue() {
    const fieldId = this.config.id;
    const element = document.getElementById(fieldId);
    
    if (!element) return this.config.value || '';
    
    let value = element.value;
    
    // Apply transformations based on input type
    value = this.transformValue(value);
    
    return value;
  }

  /**
   * Set field value
   */
  setValue(value) {
    const fieldId = this.config.id;
    const element = document.getElementById(fieldId);
    
    if (!element) return;
    
    // Transform value before setting
    const transformedValue = this.transformValue(value);
    element.value = transformedValue;
    
    // Trigger change event for Alpine.js
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Transform value based on field configuration
   * Override in subclasses for specific transformations
   */
  transformValue(value) {
    if (this.uppercaseHandler && typeof value === 'string') {
      return value.toUpperCase();
    }
    
    return value;
  }

  /**
   * Validate the field value
   */
  validate(value = null) {
    const fieldValue = value !== null ? value : this.getValue();
    const errors = [];
    
    // Required validation
    if (this.constraints.required && (!fieldValue || fieldValue.toString().trim() === '')) {
      errors.push(`${this.config.label || this.config.id} é obrigatório`);
    }
    
    // Length validation
    if (fieldValue && typeof fieldValue === 'string') {
      if (this.constraints.minlength && fieldValue.length < this.constraints.minlength) {
        errors.push(`${this.config.label || this.config.id} deve ter pelo menos ${this.constraints.minlength} caracteres`);
      }
      
      if (this.constraints.maxlength && fieldValue.length > this.constraints.maxlength) {
        errors.push(`${this.config.label || this.config.id} deve ter no máximo ${this.constraints.maxlength} caracteres`);
      }
    }
    
    // Pattern validation
    if (fieldValue && this.constraints.pattern) {
      const regex = new RegExp(this.constraints.pattern);
      if (!regex.test(fieldValue.toString())) {
        errors.push(`${this.config.label || this.config.id} não atende ao padrão exigido`);
      }
    }
    
    // Numeric validation (for number fields)
    if (this.inputType === 'number' && fieldValue !== '') {
      const numValue = parseFloat(fieldValue);
      
      if (isNaN(numValue)) {
        errors.push(`${this.config.label || this.config.id} deve ser um número válido`);
      } else {
        if (this.constraints.min !== undefined && numValue < parseFloat(this.constraints.min)) {
          errors.push(`${this.config.label || this.config.id} deve ser pelo menos ${this.constraints.min}`);
        }
        
        if (this.constraints.max !== undefined && numValue > parseFloat(this.constraints.max)) {
          errors.push(`${this.config.label || this.config.id} deve ser no máximo ${this.constraints.max}`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get field styles - can be overridden by subclasses
   */
  getFieldStyles() {
    return `
      <style>
        .${this.inputType}-field {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .${this.inputType}-field:focus {
          outline: none;
          border-color: #2196F3;
          box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
        }

        .${this.inputType}-field:invalid {
          border-color: #F44336;
        }

        .${this.inputType}-field[readonly] {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .${this.inputType}-field.error {
          border-color: #F44336;
          background-color: #fff5f5;
        }

        .field-error {
          color: #F44336;
          font-size: 12px;
          margin-top: 4px;
        }

        .field-help {
          color: #666;
          font-size: 12px;
          margin-top: 4px;
        }
      </style>
    `;
  }

  /**
   * Render the complete field (label + input + validation)
   */
  render() {
    const fieldId = this.config.id;
    const label = this.config.label || '';
    const description = this.config.description || '';
    const required = this.constraints.required;

    return `
      <div class="form-field input-field-base" data-field-type="${this.inputType}">
        ${label ? `
          <label for="${fieldId}" class="field-label">
            ${this.escapeHtml(label)}
            ${required ? '<span class="required-indicator">*</span>' : ''}
          </label>
        ` : ''}
        
        ${this.renderInput()}
        
        ${description ? `
          <div class="field-help">${this.escapeHtml(description)}</div>
        ` : ''}
        
        <div class="field-error" x-show="errors['${fieldId}']" x-text="errors['${fieldId}']" style="display: none;"></div>
        
        ${this.getFieldStyles()}
      </div>
    `;
  }
}

export default InputFieldBase;