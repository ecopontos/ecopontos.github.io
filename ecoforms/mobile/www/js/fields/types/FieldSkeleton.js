// js/fields/FieldSkeleton.js
import BaseField from './BaseField.js';

/**
 * FieldSkeleton
 * Minimal field template to copy for new field implementations.
 * Keep this file as the canonical example for new field classes.
 *
 * Contract (recommended):
 * - constructor(config): receives field config JSON
 * - renderInput(): returns inner HTML string for the input/control
 * - render(): can call super.render() which wraps renderInput() automatically
 * - getAlpineData(): optional -> return an object to be registered for x-data
 * - registerAlpineComponent(): call super to register Alpine data when available
 */
export default class FieldSkeleton extends BaseField {
  constructor(config = {}) {
    super(config);
    // initialize value from config or default
    this.value = this.config.value !== undefined ? this.config.value : this.getDefaultValue();
  }

  renderInput() {
    const attrs = this.getAttributes();
    return `<input ${attrs} />`;
  }

  // Optional: provide Alpine x-data object when the field needs local reactive state
  getAlpineData() {
    return null; // override in subclasses when needed
  }

  // Standardized Alpine registration delegate (calls BaseField implementation)
  registerAlpineComponent() {
    if (typeof super.registerAlpineComponent === 'function') {
      super.registerAlpineComponent();
    }
  }

  render() {
    const attrs = this.getAttributes();
    const inputHtml = `<input ${attrs} />`;
    return this.wrapField(inputHtml);
  }
}

// Compatibility: expose globally for legacy scripts
if (typeof window !== 'undefined') {
  window.FieldSkeleton = FieldSkeleton;
}
