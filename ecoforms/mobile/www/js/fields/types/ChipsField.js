import BaseField from './BaseField.js';

export default class ChipsField extends BaseField {
  constructor(config) {
    super(config);
  }

  renderInput() {
    const id = this.config.id;
    // Update aria-label based on multiple/single
    const isMultiple = this.config.multiple !== false;
    const label = this.config.label || (isMultiple ? 'Seleção múltipla' : 'Seleção única');
    
    const chipsHtml = `
      <div class="chips-container" x-data="field_${id}_data" x-init="init()" role="group" aria-label="${label}">
        <div class="chips-display">
          <template x-for="option in allOptions" :key="option.value">
            <span class="chip" :class="{ 'selected': isSelected(option) }" role="button" tabindex="0"
                  @click="toggleChip(option)"
                  @keydown.enter.prevent="toggleChip(option)"
                  @keydown.space.prevent="toggleChip(option)">
              <span class="chip-label" x-text="option.label"></span>
            </span>
          </template>
        </div>
        <input type="hidden" id="${id}" name="${id}" x-model="chipValues">
      </div>
    `;
    return chipsHtml;
  }

  getAlpineData() {
    const options = this.config.options || [];
    const rawData = Array.isArray(this.config.rawData) && this.config.rawData.length ? this.config.rawData : null;
    const dataSource = this.config.dataSource ? String(this.config.dataSource).replace(/\.json$/i, '') : null;
    const fieldId = this.config.id;
    const isMultiple = this.config.multiple !== false; // Default true (legacy)

    // helper to normalize option entries (strings or objects) into { value, label, icon }
    const normalize = (item) => {
      if (typeof item === 'string') return { value: item, label: item, icon: '' };
      const value = item.id || item.value;
      const label = item.nome || item.label || item.name || item.value || value;
      const icon = item.icon || item.emoji || '';
      return { ...item, value, label, icon };
    };

    const baseObj = {
      allOptions: [],
      selectedChips: [],
      chipValues: '', // JSON string (multiple) or Primitive (single)
      
      getChipIcon(option) {
        return '';
      },
      
      async init() {
        // Merge preloaded object if it exists (from preloadFormDataSources)
        try {
          const preloadName = `field_${fieldId}_data`;
          if (window[preloadName] && window[preloadName].allOptions && !this.allOptions.length) {
            this.allOptions = window[preloadName].allOptions.slice();
          }
        } catch(_) {}

        if (!this.allOptions.length) {
          const inline = rawData ? rawData : options;
          if (inline && inline.length) {
            this.allOptions = inline.map(item => normalize(item));
          }

          if (dataSource) {
            try {
              let data = null;
              if (window.smartCache && typeof window.smartCache.loadDataSource === 'function') {
                try { data = await window.smartCache.loadDataSource(dataSource); } catch(e) { console.debug('ChipsField: smartCache failed', e); }
              }
              if (!data) {
                try {
                  if (window.smartCache && typeof window.smartCache.fetchLocalData === 'function') {
                    const arr = await window.smartCache.fetchLocalData(`data/${dataSource}.json`);
                    data = Array.isArray(arr) ? arr : (Array.isArray(arr?.data) ? arr.data : (Array.isArray(arr?.items) ? arr.items : (Array.isArray(arr?.value) ? arr.value : [])));
                  } else {
                    const response = await fetch(`data/${dataSource}.json`);
                    if (response.ok) data = await response.json();
                  }
                } catch(e) { console.debug('ChipsField: local fallback failed', e); }
              }
              if (data) this.allOptions = (Array.isArray(data) ? data : []).map(item => normalize(item));
            } catch (e) { console.debug('ChipsField load fallback', e); }
          }
        }

        // Initial selection logic
        this.loadFromFormData();

        // Watch for changes in global formData
        this.$watch(() => {
          try {
            const val = (window.formData && window.formData[fieldId] !== undefined) ? window.formData[fieldId] : null;
            // Return string representation to detect changes
            return typeof val === 'object' ? JSON.stringify(val) : String(val);
          } catch(e) { return ''; }
        }, () => {
          this.loadFromFormData();
        });
      },

      loadFromFormData() {
        try {
          // If multiple: expect JSON array string or Array. 
          // If single: expect primitive value
          const raw = (window.formData && window.formData[fieldId] !== undefined) ? window.formData[fieldId] : null;

          if (isMultiple) {
             const defaultVal = [];
             let arr = raw === null ? defaultVal : raw;
             if (typeof arr === 'string') {
                 try { arr = JSON.parse(arr); } catch(e) { arr = []; }
             }
             if (!Array.isArray(arr)) arr = [];
             
             this.selectedChips = this.allOptions.filter(opt => arr.includes(opt.value));
          } else {
             // Single
             if (raw !== null && raw !== undefined && raw !== '') {
                 // Loose equality to match "1" with 1
                 const found = this.allOptions.find(opt => opt.value == raw);
                 this.selectedChips = found ? [found] : [];
             } else {
                 this.selectedChips = [];
             }
          }
        } catch(e) {
            console.warn('ChipsField load error', e);
            this.selectedChips = [];
        }
        this.updateInternalValue();
      },

      isSelected(option) { return this.selectedChips.some(ch => ch.value === option.value); },
      
      toggleChip(option) {
        if (isMultiple) {
          if (this.isSelected(option)) {
            this.selectedChips = this.selectedChips.filter(ch => ch.value !== option.value);
          } else {
            this.selectedChips.push(option);
          }
        } else {
          // Single
          if (this.isSelected(option)) {
              // Toggle off
              this.selectedChips = [];
          } else {
              this.selectedChips = [option];
          }
        }
        this.updateValue();
      },
      
      updateValue() {
        this.updateInternalValue();
        try { if (window.formData) window.formData[fieldId] = this.chipValues; } catch(_) {}
      },
      
      updateInternalValue() {
          if (isMultiple) {
            this.chipValues = JSON.stringify(this.selectedChips.map(ch => ch.value));
          } else {
            // Single value
            this.chipValues = this.selectedChips.length > 0 ? this.selectedChips[0].value : null;
          }
      }
    };
    return baseObj;
  }
}
