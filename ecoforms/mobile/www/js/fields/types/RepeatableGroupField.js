// js/fields/types/RepeatableGroupField.js
import BaseField from './BaseField.js';
import { FieldFactory } from '../FieldFactory.js';

/**
 * Campo de Grupo Repetível
 * Permite adicionar/remover múltiplas instâncias de um grupo de campos
 */
export default class RepeatableGroupField extends BaseField {
  constructor(config = {}) {
    super(config);
    this.subFieldsSchema = config.campos || config.subFields || [];
    this.itemInstances = []; // Array de arrays de instâncias de campos
    this.setValue(this.resolveInitialValue(), { syncParentValue: false });
  }

  init() {
    const schema = this.config.campos || this.config.subFields || [];
    console.log(`🔧 RepeatableGroupField: ${this.config.id} inicializado com ${schema.length} subcampos`);
  }

  getFormDataTarget(preferredFormData = null) {
    if (preferredFormData && typeof preferredFormData === 'object') {
      return preferredFormData;
    }
    if (this.config.formData && typeof this.config.formData === 'object') {
      return this.config.formData;
    }
    if (typeof window !== 'undefined' && window.formData && typeof window.formData === 'object') {
      return window.formData;
    }
    return null;
  }

  resolveInitialValue(preferredFormData = null) {
    const formData = this.getFormDataTarget(preferredFormData);
    if (formData && Array.isArray(formData[this.config.id])) {
      return formData[this.config.id];
    }
    if (Array.isArray(this.value)) {
      return this.value;
    }
    return [];
  }

  normalizeItemsValue(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(item => (item && typeof item === 'object' ? { ...item } : {}));
  }

  getSourceMode() {
    const configuredMode = this.config.sourceMode;
    if (configuredMode === 'manual' || configuredMode === 'seed-on-init') {
      return configuredMode;
    }

    // Backward compatibility: prior schemas seeded automatically when a source existed.
    if (
      (Array.isArray(this.config.rawData) && this.config.rawData.length > 0) ||
      typeof this.config.dataSource === 'string'
    ) {
      return 'seed-on-init';
    }

    return 'manual';
  }

  shouldSeedFromSource() {
    return this.getSourceMode() === 'seed-on-init';
  }

  hasExternalSource() {
    if (!this.shouldSeedFromSource()) {
      return false;
    }

    return (
      Array.isArray(this.config.rawData) ||
      typeof this.config.dataSource === 'string'
    );
  }

  getPrefillMappings() {
    const { prefillMapping } = this.config;
    if (!prefillMapping) {
      return [];
    }

    if (Array.isArray(prefillMapping)) {
      return prefillMapping
        .map(entry => {
          if (!entry) return null;
          if (typeof entry === 'string') {
            return { source: entry, target: entry };
          }
          if (typeof entry === 'object' && entry.source && entry.target) {
            return { source: entry.source, target: entry.target };
          }
          return null;
        })
        .filter(Boolean);
    }

    if (typeof prefillMapping === 'object') {
      return Object.entries(prefillMapping).map(([target, source]) => ({ target, source }));
    }

    return [];
  }

  normalizeSourceRecords(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (!data || typeof data !== 'object') {
      return [];
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
    if (Array.isArray(data.value)) {
      return data.value;
    }

    return [];
  }

  async loadSourceData() {
    if (Array.isArray(this.config.rawData)) {
      return this.config.rawData;
    }

    const dataSource = this.config.dataSource ? String(this.config.dataSource).replace(/\.json$/i, '') : null;
    if (!dataSource) {
      return [];
    }

    if (typeof window !== 'undefined' && window.rawDataSources && window.rawDataSources[dataSource]) {
      return window.rawDataSources[dataSource];
    }

    if (typeof window !== 'undefined' && window.smartCache && typeof window.smartCache.loadDataSource === 'function') {
      try {
        const loaded = await window.smartCache.loadDataSource(dataSource);
        if (loaded) {
          return loaded;
        }
      } catch (error) {
        console.debug('RepeatableGroupField: smartCache.loadDataSource failed', error);
      }
    }

    if (typeof window !== 'undefined' && window.smartCache && typeof window.smartCache.fetchLocalData === 'function') {
      try {
        const loaded = await window.smartCache.fetchLocalData(`data/${dataSource}.json`);
        if (loaded) {
          return loaded;
        }
      } catch (error) {
        console.debug('RepeatableGroupField: smartCache.fetchLocalData failed', error);
      }
    }

    if (typeof fetch === 'function') {
      try {
        const response = await fetch(`data/${dataSource}.json`);
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.debug('RepeatableGroupField: fetch fallback failed', error);
      }
    }

    return [];
  }

  mapSourceRecordToItem(record = {}) {
    const item = {};
    const mappings = this.getPrefillMappings();
    const targetIds = new Set(this.subFieldsSchema.map(fieldConfig => fieldConfig.id));

    if (mappings.length > 0) {
      mappings.forEach(({ source, target }) => {
        if (!targetIds.has(target)) {
          return;
        }
        if (record && Object.prototype.hasOwnProperty.call(record, source)) {
          item[target] = record[source];
        }
      });
    } else {
      this.subFieldsSchema.forEach(fieldConfig => {
        if (record && Object.prototype.hasOwnProperty.call(record, fieldConfig.id)) {
          item[fieldConfig.id] = record[fieldConfig.id];
        }
      });
    }

    this.subFieldsSchema.forEach(fieldConfig => {
      if (item[fieldConfig.id] === undefined && fieldConfig.defaultValue !== undefined) {
        item[fieldConfig.id] = fieldConfig.defaultValue;
      }
    });

    return item;
  }

  async loadSeedItems() {
    if (!this.shouldSeedFromSource()) {
      return [];
    }

    const rawSourceData = await this.loadSourceData();
    const records = this.normalizeSourceRecords(rawSourceData);
    return records.map(record => this.mapSourceRecordToItem(record));
  }

  createItemInstance(index, itemData = {}) {
    const formData = this.getFormDataTarget();
    const instances = this.subFieldsSchema.map(fieldConfig => {
      const config = {
        ...fieldConfig,
        id: `${this.config.id}_${index}_${fieldConfig.id}`,
        originalId: fieldConfig.id,
        parentGroupId: this.config.id,
        itemIndex: index,
        formData,
        Alpine: this.Alpine
      };

      const field = FieldFactory.create(config, formData, this.Alpine);
      
      // Set initial value if provided
      if (itemData[fieldConfig.id] !== undefined) {
        field.setValue(itemData[fieldConfig.id]);
        if (formData) {
          formData[config.id] = itemData[fieldConfig.id];
        }
      }

      return field;
    });

    this.itemInstances[index] = instances;
    return instances;
  }

  rebuildItemInstances(items = []) {
    this.itemInstances = [];
    items.forEach((itemData, index) => {
      this.createItemInstance(index, itemData);
    });
  }

  getSerializedItems(preferredFormData = null) {
    const formData = this.getFormDataTarget(preferredFormData);
    const fallbackItems = this.normalizeItemsValue(this.value);
    const instanceCount = this.itemInstances.length;
    const itemCount = Math.max(instanceCount, fallbackItems.length);

    return Array.from({ length: itemCount }, (_, index) => {
      const instances = this.itemInstances[index];
      if (!instances || instances.length === 0) {
        return fallbackItems[index] ? { ...fallbackItems[index] } : {};
      }

      const itemData = {};
      instances.forEach(field => {
        const originalId = field.config.originalId || field.config.id;
        const fieldId = field.config.id;
        if (formData && formData[fieldId] !== undefined) {
          itemData[originalId] = formData[fieldId];
        } else {
          itemData[originalId] = field.getValue();
        }
      });
      return itemData;
    });
  }

  getConfig() {
    return {
      minItems: 0,
      maxItems: Infinity,
      addButtonLabel: 'Adicionar Item',
      removeButtonLabel: 'Remover',
      itemLabel: 'Item',
      loadingMessage: 'Carregando itens...',
      emptySourceMessage: 'Nenhum registro encontrado na fonte externa.',
      ...this.config.config
    };
  }

  render() {
    const config = this.getConfig();
    const groupId = this.config.id;
    const alpineComponentName = `repeatableGroup_${groupId}`;

    // Generate HTML for the repeatable group container
    return `
      <div class="field-container repeatable-group-container" data-field-id="${groupId}" data-field-type="repeatable_group">
        <div class="repeatable-group-header">
          <label class="field-label">
            ${this.escapeHtml(this.config.label)}
            ${this.config.required ? '<span class="required-mark">*</span>' : ''}
          </label>
          ${this.config.description ? `<div class="field-description">${this.escapeHtml(this.config.description)}</div>` : ''}
        </div>

        <div 
          x-data="${alpineComponentName}()"
          x-init="init()"
          class="repeatable-group-content"
          id="${groupId}_container"
        >
          <div x-show="isLoading" class="repeatable-group-empty">
            <p>${this.escapeHtml(config.loadingMessage)}</p>
          </div>

          <!-- Empty state -->
          <div x-show="!isLoading && items.length === 0 && (!hasExternalSource || !sourceLoaded || !sourceReturnedEmpty)" class="repeatable-group-empty">
            <p>Nenhum item adicionado. Clique em "${config.addButtonLabel}" para começar.</p>
          </div>

          <div x-show="!isLoading && items.length === 0 && hasExternalSource && sourceLoaded && sourceReturnedEmpty" class="repeatable-group-empty">
            <p>${this.escapeHtml(config.emptySourceMessage)}</p>
          </div>

          <!-- Items list -->
          <template x-for="(item, index) in items" :key="index">
            <div class="repeatable-group-item" :data-item-index="index">
              <div class="repeatable-group-item-header">
                <span class="item-label">${config.itemLabel} <span x-text="index + 1"></span></span>
                <button 
                  type="button"
                  class="btn-remove-item"
                  @click="removeItem(index)"
                  x-show="canRemove"
                  title="${config.removeButtonLabel}"
                >
                  🗑️
                </button>
              </div>
              <div class="repeatable-group-item-fields" :id="'${groupId}_item_' + index">
                <!-- Subfields will be rendered here dynamically -->
              </div>
            </div>
          </template>

          <!-- Add button -->
          <button 
            type="button"
            class="btn-add-item"
            @click="addItem()"
            x-show="canAdd"
          >
            + ${config.addButtonLabel}
          </button>
        </div>

        <input 
          type="hidden" 
          name="${groupId}" 
          x-model="formData['${groupId}']"
        />
      </div>
    `;
  }

  getAlpineData() {
    const config = this.getConfig();
    const groupId = this.config.id;
    const self = this;

    return {
      items: [],
      canAdd: true,
      canRemove: true,
      isLoading: false,
      hasExternalSource: self.hasExternalSource(),
      sourceLoaded: false,
      sourceReturnedEmpty: false,

      async init() {
        const existingValue = self.resolveInitialValue(this.$root?.formData);
        if (Array.isArray(existingValue) && existingValue.length > 0) {
          this.items = existingValue.map((item, index) => ({
            index: index,
            data: { ...item }
          }));
          self.rebuildItemInstances(existingValue);
          this.renderAllItems();
        }

        const syncGroupValue = () => {
          this.$nextTick(() => {
            this.syncFormData();
          });
        };

        this.$el.addEventListener('input', syncGroupValue);
        this.$el.addEventListener('change', syncGroupValue);

        if (this.items.length === 0 && this.hasExternalSource && !this.sourceLoaded) {
          this.isLoading = true;
          try {
            const seededItems = await self.loadSeedItems();
            this.sourceLoaded = true;
            this.sourceReturnedEmpty = seededItems.length === 0;

            if (seededItems.length > 0) {
              this.items = seededItems.map((item, index) => ({
                index,
                data: { ...item }
              }));
              self.rebuildItemInstances(seededItems);
              this.renderAllItems();
            }
          } finally {
            this.isLoading = false;
          }
        }

        this.syncFormData();
        this.updateButtons();
        this.$watch('items.length', () => this.updateButtons());
      },

      getFormDataValue() {
        return self.resolveInitialValue(this.$root?.formData);
      },

      addItem() {
        if (!this.canAdd) return;
        
        const nextValue = this.getValue();
        const newItem = {};
        
        // Initialize with default values
        self.subFieldsSchema.forEach(fieldConfig => {
          if (fieldConfig.defaultValue !== undefined) {
            newItem[fieldConfig.id] = fieldConfig.defaultValue;
          }
        });

        nextValue.push(newItem);
        this.items = nextValue.map((item, index) => ({
          index,
          data: { ...item }
        }));
        self.rebuildItemInstances(nextValue);
        
        // Render the new item's fields
        this.$nextTick(() => {
          this.renderAllItems();
          this.syncFormData();
        });

        this.updateButtons();
      },

      removeItem(index) {
        if (!this.canRemove) return;
        
        const nextValue = this.getValue();
        nextValue.splice(index, 1);
        self.rebuildItemInstances(nextValue);
        
        this.items = nextValue.map((item, newIndex) => ({
          index: newIndex,
          data: { ...item }
        }));

        this.$nextTick(() => {
          this.renderAllItems();
          this.syncFormData();
        });

        this.updateButtons();
      },

      renderItemFields(index) {
        const container = document.getElementById(`${groupId}_item_${index}`);
        if (!container) return;

        const instances = self.itemInstances[index];
        if (!instances) return;

        instances.forEach(field => {
          if (typeof field.registerAlpineComponent === 'function') {
            field.registerAlpineComponent();
          }
        });

        container.innerHTML = instances.map(field => field.render()).join('');
        
        // Initialize Alpine for the new fields
        if (window.Alpine) {
          window.Alpine.initTree(container);
        }
      },

      renderAllItems() {
        this.$nextTick(() => {
          this.items.forEach((item, index) => {
            if (!self.itemInstances[index]) {
              self.createItemInstance(index, item.data);
            }
            this.renderItemFields(index);
          });
        });
      },

      updateButtons() {
        this.canAdd = this.items.length < config.maxItems;
        this.canRemove = this.items.length > config.minItems;
      },

      syncFormData() {
        const formData = self.getFormDataTarget(this.$root?.formData);
        const value = self.getSerializedItems(this.$root?.formData);

        self.value = value;
        this.items = value.map((item, index) => ({
          index,
          data: { ...item }
        }));

        if (formData) {
          formData[groupId] = value;
        }
      },

      getValue() {
        return self.getSerializedItems(this.$root?.formData);
      }
    };
  }

  registerAlpineComponent() {
    const alpineComponentName = `repeatableGroup_${this.config.id}`;
    const alpineData = this.getAlpineData();

    const alpineInstance = this.Alpine || (typeof window !== 'undefined' ? window.Alpine : undefined);

    if (alpineInstance && typeof alpineInstance.data === 'function') {
      alpineInstance.data(alpineComponentName, () => alpineData);
      console.log(`✅ RepeatableGroupField: Registrado componente Alpine ${alpineComponentName}`);
    } else if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      document.addEventListener('alpine:init', () => {
        if (window.Alpine && typeof window.Alpine.data === 'function') {
          window.Alpine.data(alpineComponentName, () => alpineData);
          console.log(`✅ RepeatableGroupField: Registrado componente Alpine ${alpineComponentName} (delayed)`);
        }
      }, { once: true });
    }
  }

  getValue() {
    const formData = this.getFormDataTarget();
    if (formData && Array.isArray(formData[this.config.id])) {
      return formData[this.config.id];
    }

    return this.getSerializedItems();
  }

  setValue(value, options = {}) {
    if (!Array.isArray(value)) {
      console.warn(`RepeatableGroupField: Valor deve ser um array, recebido: ${typeof value}`);
      return;
    }

    const normalizedValue = this.normalizeItemsValue(value);
    this.value = normalizedValue;
    this.rebuildItemInstances(normalizedValue);

    const formData = this.getFormDataTarget();
    if (formData) {
      formData[this.config.id] = normalizedValue;
    }

    if (options.syncParentValue !== false) {
      super.setValue(normalizedValue);
    } else {
      this.value = normalizedValue;
    }
  }

  validate() {
    this.errors = [];
    let isValid = true;
    
    // Validate all items
    this.itemInstances.forEach((instances, index) => {
      instances.forEach(field => {
        if (!field.validate()) {
          isValid = false;
          console.warn(`RepeatableGroupField: Validação falhou para item ${index}, campo ${field.config.id}`);
        }
      });
    });

    // Check required
    if (this.config.required) {
      const value = this.getValue();
      if (!Array.isArray(value) || value.length === 0) {
        this.errors.push('Este campo é obrigatório');
        isValid = false;
      }
    }

    this.isValid = isValid;
    return isValid;
  }

  getDefaultValue() {
    return [];
  }
}
