// js/fields/BaseField.js
import { sanitizeId } from '../utils.js';
import { computeDefaultValue } from '../defaults.js';

export default class BaseField {
  constructor(config = {}) {
    const rawId = config.id || config.name || '';
    const sanitizedId = sanitizeId(rawId);

    this.config = {
      id: sanitizedId,
      name: config.name || sanitizedId,
      label: config.label || '',
      placeholder: config.placeholder || '',
      required: !!config.required,
      description: config.description || '',
      validation: { ...config.validation },
      attributes: { ...config.attributes },
      value: config.value,
      ...config
    };

    // Backwards-compat: if the form author nested properties under `config` (e.g. campo.config.dataSource),
    // hoist them to the top-level this.config so fields can read `this.config.dataSource` as expected.
    if (config && config.config && typeof config.config === 'object') {
      try {
        const nested = config.config;
        Object.keys(nested).forEach(k => {
          if (this.config[k] === undefined) {
            this.config[k] = nested[k];
          }
        });
        // remove nested config to avoid double nesting in downstream logic
        delete this.config.config;
      } catch (e) {
        // ignore any merge errors
      }
    }

    // Keep handy references for legacy code that expects `this.id` / `this.name`
    this.id = this.config.id;
    this.name = this.config.name;

    this.value = this.config.value !== undefined ? this.config.value : this.getDefaultValue();
    this.errors = [];
    this.isValid = true;
    this.isDirty = false;
    this.isTouched = false;
    this.Alpine = this.config.Alpine;

    this.init();
  }

  init() {
    this.setupValidation();
    console.log(`🔧 BaseField: Campo ${this.config.id} (${this.config.tipo || this.config.type}) inicializado`);
  }

  getDefaultValue() {
    // Delegate default computation to shared helper to centralize logic
    const t = (this.config.type || this.config.tipo || '').toString();

    // For some legacy types (checkbox/chips) keep existing return shapes
    if (t === 'checkbox' || t === 'chips') return {};
    if (t === 'select' && this.config.multiple) return this.config.defaultValue !== undefined ? this.config.defaultValue : [];

    // Use computeDefaultValue for all other cases (it respects value, defaultToNow and defaultValue)
    return computeDefaultValue({
      type: this.config.type || this.config.tipo,
      defaultToNow: this.config.defaultToNow,
      value: this.config.value,
      defaultValue: this.config.defaultValue,
      multiple: this.config.multiple
    });
  }

  setupValidation() {
    this.validators = {
      required: (value) => {
        if (!this.config.required) return null;
        if (value === null || value === undefined) return 'Este campo é obrigatório';
        if (typeof value === 'string') return value.trim() === '' ? 'Este campo é obrigatório' : null;
        if (Array.isArray(value)) return value.length === 0 ? 'Este campo é obrigatório' : null;
        if (typeof value === 'object') return Object.keys(value).length === 0 ? 'Este campo é obrigatório' : null;
        return null;
      },
      minLength: (value) => {
        const min = this.config.validation?.minLength;
        if (min && value && value.toString().length < min) {
          return `Mínimo de ${min} caracteres`;
        }
        return null;
      },
      maxLength: (value) => {
        const max = this.config.validation?.maxLength;
        if (max && value && value.toString().length > max) {
          return `Máximo de ${max} caracteres`;
        }
        return null;
      },
      pattern: (value) => {
        const pattern = this.config.validation?.pattern;
        if (pattern && value) {
          const regex = new RegExp(pattern);
          if (!regex.test(value.toString())) {
            return this.config.validation.patternMessage || 'Formato inválido';
          }
        }
        return null;
      },
      email: (value) => {
        if ((this.config.type === 'email' || this.config.tipo === 'email') && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return 'Email inválido';
          }
        }
        return null;
      },
      custom: (value) => {
        if (this.config.validation?.custom && typeof this.config.validation.custom === 'function') {
          return this.config.validation.custom(value, this.config);
        }
        return null;
      }
    };
  }

  render() {
    const inputHtml = this.renderInput();
    return this.wrapField(inputHtml);
  }

  renderInput() {
    const attrs = this.getAttributes();
    // Adiciona value para tipos date e time se houver valor
    const t = (this.config.type || this.config.tipo || '').toString();
    let valueAttr = '';
    if ((t === 'date' || t === 'time') && this.value) {
      valueAttr = ` value="${this.escapeHtml(this.value)}"`;
    }
    return `<input ${attrs}${valueAttr} />`;
  }

  wrapField(fieldHTML) {
    const fieldId = this.config.id;
    const requiredMark = this.config.required ? '<span class="required-mark" aria-label="Obrigatório">*</span>' : '';
    const description = this.config.description ? `<small class="field-description">${this.escapeHtml(this.config.description)}</small>` : '';
    const helpText = this.config.helpText ? `<div class="field-help-text" onclick="alert('${this.escapeHtml(this.config.helpText)}')">ℹ️</div>` : '';
    const errors = `<div class="field-errors" x-show="errors['${fieldId}']" role="alert"><div class="field-error" x-text="errors['${fieldId}']"></div></div>`;

    const canonicalType = (this.config.type || this.config.tipo || 'text')
      .replace(/^campo-/, '')
      .replace(/^(datetime-local|datetime)$/, 'datetime-local')
      .replace(/^chips.*$/, 'chips'); // Normalize any chips/chips_multiple to 'chips' for CSS styling

    return `
      <div class="field-container" data-field-id="${fieldId}" data-field-type="${canonicalType}">
        <label for="${fieldId}" class="field-label">
          ${this.config.label}${requiredMark}
        </label>
        ${fieldHTML}
        ${description}
        ${helpText}
        ${errors}
      </div>
    `;
  }

  getAttributes() {
    const attrs = [];
    const fieldId = this.config.id;

    attrs.push(`id="${fieldId}"`);
    attrs.push(`name="${fieldId}"`);
    attrs.push(`x-model="formData['${fieldId}']"`);
    attrs.push(`class="form-input ${this.config.attributes?.class || ''}"`);
    attrs.push(`:class="{ 'error': errors['${fieldId}'] }"`);

    if (this.config.placeholder) {
      attrs.push(`placeholder="${this.escapeHtml(this.config.placeholder)}"`);
    }

    if (this.config.required) {
      attrs.push('required');
    }

    if (this.config.attributes) {
      Object.keys(this.config.attributes).forEach(key => {
        if (key !== 'class') {
          attrs.push(`${key}="${this.escapeHtml(this.config.attributes[key])}"`);
        }
      });
    }

    return attrs.join(' ');
  }

  validate(value = this.value) {
    this.errors = [];
    for (const validator of Object.values(this.validators)) {
      const error = validator(value);
      if (error) {
        this.errors.push(error);
      }
    }
    this.isValid = this.errors.length === 0;
    return this.isValid;
  }

  setValue(value) {
    const oldValue = this.value;
    this.value = value;
    this.isDirty = oldValue !== value;

    if (this.$root && this.$root.formData) {
      this.$root.formData[this.config.id] = value;
    }

    if (this.isTouched) {
      this.validate(value);
    }
    this.onValueChange(value, oldValue);
  }

  getValue() {
    return this.value;
  }

  onValueChange(newValue, oldValue) {
    console.log(`📝 BaseField: ${this.config.id} alterado de "${oldValue}" para "${newValue}"`);
  }

  registerAlpineComponent() {
    if (typeof this.getAlpineData !== 'function') return;

    const componentName = `field_${this.config.id}_data`;
    const alpineData = this.getAlpineData();

    // Prefer instance Alpine passed in constructor, fallback to global window.Alpine
    const alpineInstance = this.Alpine || (typeof window !== 'undefined' ? window.Alpine : undefined);

    if (alpineInstance && typeof alpineInstance.data === 'function') {
      if (alpineData) alpineInstance.data(componentName, () => alpineData);
      return;
    }

    // If Alpine isn't ready yet but we're in a browser, wait for alpine:init
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const onAlpine = () => {
        const alpineReady = window.Alpine;
        try {
          if (alpineReady && typeof alpineReady.data === 'function' && alpineData) {
            alpineReady.data(componentName, () => alpineData);
          }
        } catch (e) {
          console.warn('BaseField: Falha ao registrar Alpine data for', componentName, e && e.message);
        }
      };

      // If Alpine already fired alpine:init, the listener will not run; attempt immediate register
      if (window.Alpine && typeof window.Alpine.data === 'function') {
        try { if (alpineData) window.Alpine.data(componentName, () => alpineData); } catch (e) { /* ignore */ }
      } else {
        document.addEventListener('alpine:init', onAlpine, { once: true });
      }
    }
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

if (typeof window !== 'undefined') {
  window.BaseField = BaseField;
}
