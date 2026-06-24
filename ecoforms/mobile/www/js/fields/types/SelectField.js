import BaseField from './BaseField.js';

export default class SelectField extends BaseField {
  constructor(config) {
    super(config);
  }

  renderInput() {
    const fieldId = this.config.id;
  const isMultiple = !!this.config.multiple;
    const multiple = this.config.multiple ? 'multiple' : '';
    // Always show an empty "Selecione..." option for single-select fields (required or not)
    // so the browser never auto-selects the first option before the user makes a choice,
    // which would leave formData[fieldId]='' and fail validation.
    // Respect explicit showEmptyOption:false to opt out.
    const showEmpty = this.config.showEmptyOption !== false && !isMultiple;
    const emptyValue = (this.config.emptyOptionValue !== undefined) ? this.config.emptyOptionValue : '';
    const emptyLabel = (this.config.emptyOptionLabel !== undefined) ? this.config.emptyOptionLabel : 'Selecione...';

    // Render a select that is populated by Alpine data `field_<id>_data`.
    // If Alpine data isn't available, the fallback is an empty list or any static options.
    return `
      <div x-data="field_${fieldId}_data" x-init="init()">
        <select
          id="${fieldId}"
          name="${this.config.name || this.config.id}"
          ${this.config.required ? 'required' : ''}
          ${multiple}
          class="form-input select-field"
          x-model="formData['${fieldId}']"
          @change="if (window.formData) window.formData['${fieldId}'] = $event.target.value"
          aria-label="${this.escapeHtml(this.config.label || this.config.name || fieldId)}">
          ${showEmpty ? `<option value="${this.escapeHtml(String(emptyValue))}">${this.escapeHtml(String(emptyLabel))}</option>` : ''}
          <template x-for="option in allOptions" :key="option.value">
            <option :value="option.value" x-text="option.label"></option>
          </template>
        </select>
      </div>`;
  }

  getAlpineData() {
  const options = this.config.options || [];
  const rawData = Array.isArray(this.config.rawData) && this.config.rawData.length ? this.config.rawData : null;
    const dataSource = this.config.dataSource ? String(this.config.dataSource).replace(/\.json$/i, '') : null;
    // Support both valueField/labelField and optionValue/optionLabel (aliases)
    const valueField = this.config.valueField || this.config.optionValue || 'value';
    const labelField = this.config.labelField || this.config.optionLabel || 'label';
    const fieldId = this.config.id;
    const isMultiple = !!this.config.multiple;
    const defaultValue = this.config.value !== undefined ? this.config.value : (this.config.defaultValue !== undefined ? this.config.defaultValue : undefined);

    const mapItemToOption = (item) => {
      if (item === null || item === undefined) {
        return { value: '', label: '' };
      }

      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        const value = String(item);
        return { value, label: value };
      }

      const hasConfiguredValue = valueField && item[valueField] !== undefined;
      const hasConfiguredLabel = labelField && item[labelField] !== undefined;

      const value = hasConfiguredValue
        ? item[valueField]
        : (item.id ?? item.value ?? item.codigo ?? item.nome ?? item.label ?? item.name ?? '');

      const label = hasConfiguredLabel
        ? item[labelField]
        : (item.nome ?? item.label ?? item.name ?? item.description ?? item.descricao ?? String(value ?? ''));

      return { ...item, value, label };
    };

    return {
      allOptions: [],
      formData: {},
      async init() {
        // link to global formData so x-model works inside this component scope
        try { this.formData = window.formData || {}; } catch (_) {}
        // try to merge preloaded object if exists
        try {
          const preloadName = `field_${fieldId}_data`;
          if (window[preloadName] && Array.isArray(window[preloadName].allOptions) && !this.allOptions.length) {
            this.allOptions = window[preloadName].allOptions.slice();
            // If preloaded options used default mapping (id/ nome), remap to configured fields when requested
            try {
              const wantValue = valueField; const wantLabel = labelField;
              const needsRemap = (wantValue && wantValue !== 'value') || (wantLabel && wantLabel !== 'label');
              if (needsRemap) {
                // When we don't have raw items, best effort: if wantValue === 'nome', set value = label
                this.allOptions = this.allOptions.map(opt => ({
                  value: (wantValue === 'nome') ? (opt.label ?? opt.value) : opt.value,
                  label: (wantLabel === 'nome') ? (opt.label ?? String(opt.value ?? '')) : opt.label
                }));
              }
            } catch(_) { /* ignore remap errors */ }
          }
        } catch (_) {}

        if (!this.allOptions.length) {
          const inline = rawData ? rawData : options;
          if (inline && inline.length) {
            this.allOptions = inline.map(item => mapItemToOption(item));
          }

          if (dataSource) {
              try {
                // Prefer SmartCache (localStorage) when available
                let json = null;
                if (window.smartCache && typeof window.smartCache.loadDataSource === 'function') {
                  try { json = await window.smartCache.loadDataSource(dataSource); } catch (e) { console.debug('SelectField: smartCache.loadDataSource failed', e); }
                }

                if (!json) {
                  try {
                    if (window.smartCache && typeof window.smartCache.fetchLocalData === 'function') {
                      const arr = await window.smartCache.fetchLocalData(`data/${dataSource}.json`);
                      if (Array.isArray(arr)) {
                        json = arr;
                      } else if (arr && typeof arr === 'object') {
                        json = Array.isArray(arr.data) ? arr.data : (Array.isArray(arr.items) ? arr.items : (Array.isArray(arr.value) ? arr.value : []));
                      }
                    } else {
                      const res = await fetch(`data/${dataSource}.json`);
                      if (res.ok) json = await res.json();
                    }
                  } catch (e) {
                    console.debug('SelectField: local fallback failed', e);
                  }
                }

                if (json) {
                  // Some data files return an object wrapper like { value: [...] } or { items: [...] }.
                  let rawArray = Array.isArray(json) ? json : (Array.isArray(json && json.value) ? json.value : (Array.isArray(json && json.items) ? json.items : []));
                  this.allOptions = rawArray.map(item => mapItemToOption(item));
                }
              } catch (e) { console.debug('SelectField load fallback', e); }
          } else if (!this.allOptions.length && options && options.length) {
            this.allOptions = options.map(opt => mapItemToOption(opt));
          }

          // default sorting by label
          try {
            if (this.allOptions && this.allOptions.length && this.config?.sort !== false) {
              this.allOptions.sort((a, b) => (''+a.label).localeCompare(''+b.label, 'pt-BR', { sensitivity: 'base' }));
            }
          } catch (e) { /* ignore sort errors */ }
        }

        // expose staticOptions on window for legacy templates
        try { window[`staticOptions_${fieldId}`] = this.allOptions.slice(); } catch(e) {}

        // expose as Alpine store if available
        try {
          if (window.Alpine && typeof window.Alpine.store === 'function') {
            const storeName = `field_${fieldId}_data`;
            try { if (!window.Alpine.store(storeName)) window.Alpine.store(storeName, { allOptions: this.allOptions.slice() }); } catch(e) { /* ignore */ }
          }
        } catch(e) {}

// set initial value if present in global formData or configured value
        try {
          let valueFromData;

          if (typeof window !== 'undefined' && window.formData && window.formData[fieldId] !== undefined) {
            valueFromData = window.formData[fieldId];
          } else if (this.config.value !== undefined) {
            valueFromData = this.config.value;
            if (!window.formData) window.formData = {};
            window.formData[fieldId] = valueFromData;
          }

          if (valueFromData !== undefined) {
            if (isMultiple) {
              if (typeof valueFromData === 'string') {
                try { valueFromData = JSON.parse(valueFromData); } catch (e) { /* leave as-is */ }
              }

              if (!Array.isArray(valueFromData)) valueFromData = valueFromData ? [valueFromData] : [];
              window.formData[fieldId] = valueFromData.map(item => item === null || item === undefined ? '' : String(item));
            } else {
              let normalized = valueFromData;
              if (Array.isArray(normalized)) normalized = normalized[0] ?? '';
              if (normalized !== undefined && normalized !== null) normalized = String(normalized);
              window.formData[fieldId] = normalized;
            }
          }
        } catch (e) { /* ignore */ }

        // Apply defaultValue when no value has been set yet
        try {
          if (defaultValue !== undefined) {
            const current = window.formData ? window.formData[fieldId] : undefined;
            const isEmpty = current === undefined || current === null || current === '' || (Array.isArray(current) && current.length === 0);
            if (isEmpty) {
              if (!window.formData) window.formData = {};
              window.formData[fieldId] = defaultValue;
              this.formData = window.formData;
            }
          }
        } catch (e) { /* ignore */ }
      }
    };
  }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
  window.SelectField = SelectField;
}