// js/fields/types/CaixasAvancadoField.js
import BaseField from './BaseField.js';

export default class CaixasAvancadoField extends BaseField {
  constructor(config = {}) {
    super(config);
    this.configuracao = config.configuracao || config.config || {};
  }

  renderInput() {
    const id = this.config.id;
    const cfg = this.configuracao;
    const summary = cfg && cfg.statusOptions ? cfg.statusOptions.map(s => s.label).join(', ') : 'Nenhum status configurado';

    return `
      <div class="caixas-avancado-field" x-data="{ open: false }">
        <div class="caixas-summary">${this.escapeHtml(summary)}</div>
        <button type="button" class="btn btn-secondary" @click.prevent="open = !open">Editar</button>
        <template x-if="open">
          <div class="caixas-editor">
            <small>Editor minimal (stub). Atualize a configuração para comportamento completo.</small>
            <textarea x-model="formData['${id}']" class="form-input" rows="4" placeholder='JSON de status'></textarea>
          </div>
        </template>
      </div>
    `;
  }

  getDefaultValue() {
    return this.config.defaultValue !== undefined ? this.config.defaultValue : '';
  }
}

if (typeof window !== 'undefined') window.CaixasAvancadoField = CaixasAvancadoField;
