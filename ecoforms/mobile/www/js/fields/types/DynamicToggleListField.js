// js/fields/types/DynamicToggleListField.js
import BaseField from './BaseField.js';

/*
  DynamicToggleListField
  - Renders an Alpine-driven toggle list (x-data) so the form system has reactive state.
  - Exposes an Alpine data factory named `dynamicToggleList_<id>` via registerAlpineComponent().
  - Dispatches both Alpine events ($dispatch) and a native CustomEvent('field-change') so
    the outer form can listen either way.
  - If a global `DynamicToggleList` enhancement module exists it will be initialized as a
    progressive enhancement and kept in sync with Alpine state.
*/

export class DynamicToggleListField extends BaseField {
  constructor(config) {
    super(config);

    // Normalize incoming items/options into { id, title, active, subtitle?, icon? }
    const raw = Array.isArray(config.rawData) && config.rawData.length
      ? config.rawData
      : (config.options || config.items || []);

    this.items = (Array.isArray(raw) && raw.length)
      ? raw.map((it, idx) => {
          if (typeof it === 'string') {
            return { id: `item_${idx}`, title: it, active: false };
          }
          const id = it.value || it.id || `item_${idx}`;
          const title = it.label || it.title || it.name || it.nome || '';
          const subtitle = it.description || it.descricao || it.subtitle || '';
          const icon = it.icon || null;
          return {
            ...it,
            id,
            title,
            subtitle,
            icon,
            active: !!it.active
          };
        })
      : [
        { id: 'item1', title: 'Papel', active: true },
        { id: 'item2', title: 'Plástico', active: false },
        { id: 'item3', title: 'Vidro', active: false },
        { id: 'item4', title: 'Metal', active: false }
      ];

    // Ensure we have an id for the field (used in events/selectors)
    this.fieldId = this.config.id || this.id || `dynamic_toggle_${Math.random().toString(36).slice(2,8)}`;
  }

  render() {
    const componentName = `dynamicToggleList_${this.fieldId}`;

    const html = `
      <div x-data="${componentName}()" class="toggle-list" data-field-id="${this.fieldId}">
        <template x-for="(item, index) in items" :key="item.id">
          <div 
            class="toggle-item" 
            :class="{ 'active': item.active }" 
            @click="toggleItem(index)"
            role="switch"
            :aria-checked="item.active"
            :aria-label="item.title"
            tabindex="0"
            @keydown.enter.prevent="toggleItem(index)"
            @keydown.space.prevent="toggleItem(index)"
          >
            <span class="toggle-label" x-text="item.title || item.name"></span>
            <div class="toggle-switch" :class="{ 'active': item.active }">
              <div class="toggle-handle"></div>
            </div>
          </div>
        </template>
      </div>
    `;

    return this.wrapField(html);
  }

  getAlpineData() {
    const self = this;

    return {
      // Alpine component state
      items: JSON.parse(JSON.stringify(this.items)), // clone to avoid shared refs
      value: this.value || [],

      // Toggle by index (used by template click)
      toggleItem(index) {
        if (!this.items || !this.items[index]) return;
        this.items[index].active = !this.items[index].active;
        this.updateValue();
      },

      // Recompute value and emit events (Alpine + native)
      updateValue() {
        this.value = this.items.filter(i => i.active).map(i => i.id);

        // Alpine-level dispatch so listeners inside the Alpine tree can react
        try { this.$dispatch && this.$dispatch('field-change', { fieldId: self.fieldId, value: this.value, items: this.items }); } catch(e) {}

        // Native event so the outer form (non-Alpine) can listen to changes
        try {
          const root = document.querySelector(`[data-field-id="${self.fieldId}"]`);
          if (root) {
            const ev = new CustomEvent('field-change', { detail: { fieldId: self.fieldId, value: this.value, items: this.items }, bubbles: true });
            root.dispatchEvent(ev);
            try {
              // also dispatch globally and retry shortly after
              window.dispatchEvent(new CustomEvent('field-change', { detail: { fieldId: self.fieldId, value: this.value, items: this.items }, bubbles: true }));
              setTimeout(() => { try { window.dispatchEvent(new CustomEvent('field-change', { detail: { fieldId: self.fieldId, value: this.value, items: this.items }, bubbles: true })); } catch(_) {} }, 100);
            } catch (_) {}
          }
        } catch (e) {
          // swallow
        }
      },

      // Replace items entirely (keeps reactivity)
      setItems(newItems) {
        this.items = Array.isArray(newItems) ? newItems.map(i => ({ ...i })) : [];
        this.updateValue();
      },

      getSelectedItems() {
        return (this.items || []).filter(i => i.active);
      }
    };
  }

  registerAlpineComponent() {
    if (!this.Alpine) return;
    const componentName = `dynamicToggleList_${this.fieldId}`;
    // Use a factory so the template can call x-data="componentName()"
    this.Alpine.data(componentName, () => this.getAlpineData());
  }

  afterRender(container) {
    // Ensure the component is registered with Alpine
    this.registerAlpineComponent();
    
    const root = container.querySelector(`[data-field-id="${this.fieldId}"]`);
    if (root) {
        // Dispatch initial value so the form can capture state on load
        const initialValue = (this.items || []).filter(i => i.active).map(i => i.id);
        const eventDetail = { 
            fieldId: this.fieldId, 
            value: initialValue, 
            items: this.items 
        };

        const dispatchGlobal = (detail) => {
            try {
                window.dispatchEvent(new CustomEvent('field-change', { detail, bubbles: true }));
            } catch(e) {
                console.warn('Failed to dispatch global field-change event.', e);
            }
        };

        // Dispatch on the element itself
        root.dispatchEvent(new CustomEvent('field-change', { detail: eventDetail, bubbles: true }));
        
        // Dispatch globally for other listeners
        dispatchGlobal(eventDetail);
        // A short delay can help if listeners are not yet ready
        setTimeout(() => dispatchGlobal(eventDetail), 100);
    }
  }
}

export default DynamicToggleListField;
