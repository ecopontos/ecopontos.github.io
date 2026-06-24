// js/fields/types/OccupationField.js
import BaseField from './BaseField.js';

function ensureOccupationFieldGlobals() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.fieldInstances) {
    window.fieldInstances = {};
  }

  const getFieldInstance = (fieldId) => {
    const instance = window.fieldInstances?.[fieldId];
    if (!instance) {
      console.warn(`OccupationField: instância "${fieldId}" não encontrada ao acionar handler global`);
    }
    return instance;
  };

  if (typeof window.toggleOccupationBox !== 'function') {
    window.toggleOccupationBox = (fieldId, boxId) => {
      const field = getFieldInstance(fieldId);
      if (field && typeof field.handleToggleBox === 'function') {
        field.handleToggleBox(boxId);
      }
    };
  }

  if (typeof window.occupationFieldHandler !== 'function') {
    window.occupationFieldHandler = (fieldId, boxId, level) => {
      const field = getFieldInstance(fieldId);
      if (field && typeof field.handleOccupationSelection === 'function') {
        field.handleOccupationSelection(boxId, level);
      }
    };
  }

  if (typeof window.markAsRemoved !== 'function') {
    window.markAsRemoved = (fieldId, boxId) => {
      const field = getFieldInstance(fieldId);
      if (field && typeof field.handleMarkAsRemoved === 'function') {
        field.handleMarkAsRemoved(boxId);
      }
    };
  }

  if (typeof window.confirmBoxRemoval !== 'function') {
    window.confirmBoxRemoval = (boxId, boxName) => {
      if (typeof window !== 'undefined' && window.confirm) {
        return window.confirm(
          `Tem certeza que deseja marcar a caixa "${boxName}" como removida?\n\n` +
          `Esta ação indicará que a equipe já coletou esta caixa e ela não está mais no local.`
        );
      }
      return true; // Default para true se confirm não estiver disponível
    };
  }

  if (typeof window.undoRemoval !== 'function') {
    window.undoRemoval = (fieldId, boxId) => {
      const field = getFieldInstance(fieldId);
      if (field && typeof field.handleUndoRemoval === 'function') {
        field.handleUndoRemoval(boxId);
      }
    };
  }
}

/**
 * Campo de Ocupação para caixas de resíduos
 * Permite selecionar níveis de ocupação (0%, 50%, 75%, 100%) para múltiplas caixas
 */
export default class OccupationField extends BaseField {
  constructor(config) {
    super(config);

    // Configurações específicas do campo
    this.defaultBoxIcons = {
      papel: '📄',
      'papel/papelão': '📄',
      plastico: '🧴',
      plástico: '🧴',
      vidro: '🍾',
      metal: '🔧',
      organico: '🍃',
      orgânico: '🍃',
      rejeito: '🗑️',
      eletronico: '💻',
      eletrônico: '💻',
      eletrônicos: '💻',
      madeira: '🪵',
      entulho: '🏗️',
      poda: '🌿',
      reciclavel: '♻️',
      reciclável: '♻️'
    };

    const defaultCaixas = [
      { id: 1, nome: 'Papel/Papelão', ocupacao: '', icone: '📄' },
      { id: 2, nome: 'Plástico', ocupacao: '', icone: '🧴' },
      { id: 3, nome: 'Vidro', ocupacao: '', icone: '🍾' },
      { id: 4, nome: 'Metal', ocupacao: '', icone: '🔧' },
      { id: 5, nome: 'Orgânico', ocupacao: '', icone: '🍃' },
      { id: 6, nome: 'Rejeito', ocupacao: '', icone: '🗑️' },
      { id: 7, nome: 'Eletrônicos', ocupacao: '', icone: '💻' }
    ];

    const baseCaixas = Array.isArray(config.caixas) && config.caixas.length > 0
      ? config.caixas
      : defaultCaixas;

    this.caixas = baseCaixas.map((caixa, index) => ({
      ...caixa,
      icone: caixa.icone || this.getDefaultBoxIcon(caixa.nome, index) || '📦'
    }));

    this.niveis = config.niveis || [
      { valor: '0', label: '0%', cor: 'bg-green-100 border-green-400' },
      { valor: '50', label: '50%', cor: 'bg-yellow-100 border-yellow-400' },
      { valor: '75', label: '75%', cor: 'bg-orange-100 border-orange-400' },
      { valor: '100', label: '100%', cor: 'bg-red-100 border-red-400' }
    ];

    // Estado de remoção das caixas
    this.removidas = {};
    this._timestamp = null;
    this._boxTimestamps = null;    // Inicializar valores se não existir
    if (!this.value || typeof this.value !== 'object') {
      this.value = {};
      this.caixas.forEach(caixa => {
        this.value[caixa.id] = caixa.ocupacao || '';
      });
    }

    const sharedFormData = config.formData || this.config.formData || (typeof window !== 'undefined' ? window.formData : undefined);
    if (sharedFormData) {
      this.formData = sharedFormData;
      if (!this.config.formData) {
        this.config.formData = this.formData;
      }
    }

    // Registrar instância globalmente
    if (typeof window !== 'undefined') {
      if (!window.fieldInstances) {
        window.fieldInstances = {};
      }
      window.fieldInstances[config.id] = this;
      ensureOccupationFieldGlobals();
    }

    // Inicializar serviço de sincronização com banco de dados
    this.databaseSync = null;
    if (typeof window !== 'undefined' && window.dataService && window.dataService.supabaseClient) {
      try {
        if (typeof DatabaseSyncService !== 'undefined') {
          this.databaseSync = new DatabaseSyncService(window.dataService.supabaseClient);
        } else {
          // Carregar serviço dinamicamente se necessário
          console.warn('⚠️ DatabaseSyncService não encontrado, carregando dinamicamente...');
          // O serviço será carregado via script no HTML
        }
      } catch (error) {
        console.warn('⚠️ Erro ao inicializar DatabaseSyncService:', error);
      }
    }

    this.syncFormData();
    this._suppressDispatch = 0;
  }

  /**
   * Renderiza o campo de ocupação
   */
  render() {
    const fieldId = this.config.id;
    const label = this.config.label || 'Nível de Ocupação das Caixas';

    return `
      <div class="occupation-field" data-field-id="${fieldId}">
        ${label ? `
          <div class="occupation-header">
            <h3 class="occupation-title">${label}</h3>
            <p class="occupation-subtitle">Toque em cada caixa para selecionar o nível de ocupação</p>
          </div>
        ` : ''}

        <!-- Acordeão de Caixas -->
        <div class="occupation-accordion">
          ${this.caixas.map(caixa => {
            const isExpanded = this.expandedBox === caixa.id;
            const isRemoved = this.removidas[caixa.id];
            const needsRemoval = this.value[caixa.id] >= 75 && !isRemoved;
            return `
              <div class="occupation-accordion-item ${isExpanded ? 'expanded' : ''} ${isRemoved ? 'removed' : ''}" data-box-id="${caixa.id}">
                <button 
                  type="button"
                  class="occupation-accordion-header"
                  onclick="window.toggleOccupationBox('${fieldId}', ${caixa.id})"
                >
                  <div class="accordion-header-left">
                    <span class="occupation-box-icon" aria-hidden="true">${this.getBoxIcon(caixa)}</span>
                    <span class="occupation-box-name">${caixa.nome}</span>
                  </div>
                  <div class="accordion-header-right">
                    ${isRemoved ? `
                      <span class="occupation-box-removed">✅ Removida</span>
                    ` : this.value[caixa.id] ? `
                      <span class="occupation-box-current ${this.value[caixa.id] >= 75 ? 'critical' : ''}">${this.getLevelIcon(this.value[caixa.id])} ${this.value[caixa.id]}%</span>
                    ` : `
                      <span class="occupation-box-pending">Não preenchido</span>
                    `}
                    <svg class="accordion-chevron" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                  </div>
                </button>

                <div class="occupation-accordion-content">
                  ${isRemoved ? `
                    <div class="removed-notice">
                      <div class="removed-icon">✅</div>
                      <div class="removed-content">
                        <h5>Caixa Removida</h5>
                        <p>Esta caixa foi marcada como removida pela equipe.</p>
                        <button 
                          type="button"
                          class="btn-undo-removal"
                          onclick="window.undoRemoval('${fieldId}', ${caixa.id})"
                        >
                          ↩️ Desfazer Remoção
                        </button>
                      </div>
                    </div>
                  ` : `
                    <div class="occupation-levels">
                      ${this.niveis.map(nivel => {
                        const isSelected = this.value[caixa.id] === nivel.valor;
                        return `
                          <button
                            type="button"
                            class="occupation-level-btn ${isSelected ? 'selected ' + nivel.cor : ''}"
                            data-caixa-id="${caixa.id}"
                            data-nivel="${nivel.valor}"
                            onclick="window.occupationFieldHandler('${fieldId}', '${caixa.id}', '${nivel.valor}')"
                          >
                            <span class="level-icon">${this.getLevelIcon(nivel.valor)}</span>
                            <span class="level-text">${nivel.label}</span>
                          </button>
                        `;
                      }).join('')}
                    </div>
                    
                    ${needsRemoval ? `
                      <div class="removal-action">
                        <button 
                          type="button"
                          class="btn-mark-removed"
                          onclick="window.markAsRemoved('${fieldId}', ${caixa.id})"
                        >
                          <span class="removal-icon">🚛</span>
                          <div class="removal-text">
                            <strong>Marcar como Removida</strong>
                            <small>A equipe removeu esta caixa?</small>
                          </div>
                        </button>
                      </div>
                    ` : ''}
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${this.getAlertsHtml()}
      </div>
    `;
  }

  /**
   * Retorna classe CSS baseada no status
   */
  handleToggleBox(boxId) {
    this.expandedBox = this.expandedBox === boxId ? null : boxId;
    this.refreshDom();
  }

  handleOccupationSelection(caixaId, nivel) {
    this.isDirty = true;
    this.isTouched = true;

    const nextOcupacao = { ...this.value, [caixaId]: nivel };
    const nextRemovidas = { ...this.removidas };
    if (nextRemovidas[caixaId]) {
      delete nextRemovidas[caixaId];
    }

    this.setValue({ ocupacao: nextOcupacao, removidas: nextRemovidas }, {
      action: 'occupation_level',
      caixaId,
      actionDetail: { level: nivel, removed: false }
    });

    this.validate(nextOcupacao);
    this.refreshDom();
  }

  handleMarkAsRemoved(boxId) {
    const caixa = this.caixas.find(c => c.id === boxId);
    const caixaNome = caixa ? caixa.nome : `Caixa ${boxId}`;
    
    // Exibir diálogo de confirmação usando função global
    if (typeof window !== 'undefined' && typeof window.confirmBoxRemoval === 'function') {
      const confirmed = window.confirmBoxRemoval(boxId, caixaNome);
      
      if (!confirmed) {
        return; // Usuário cancelou a ação
      }
    }
    
    this.isDirty = true;
    this.isTouched = true;
    this.removidas = { ...this.removidas, [boxId]: true };
    const removalTimestamp = new Date().toISOString();
    this._timestamp = removalTimestamp;
    this._boxTimestamps = {
      ...(this._boxTimestamps || {}),
      [boxId]: removalTimestamp
    };
    this.validate(this.value);
    this.syncFormData();
    this.refreshDom();
    this.dispatchChange('mark_removed', boxId, { removed: true });
  }

  handleUndoRemoval(boxId) {
    if (this.removidas?.[boxId]) {
      const { [boxId]: _removed, ...rest } = this.removidas;
      this.removidas = rest;
    }
    this.isDirty = true;
    this.isTouched = true;
    const undoTimestamp = new Date().toISOString();
    this._timestamp = undoTimestamp;
    this._boxTimestamps = {
      ...(this._boxTimestamps || {}),
      [boxId]: undoTimestamp
    };
    this.validate(this.value);
    this.syncFormData();
    this.refreshDom();
    this.dispatchChange('undo_removal', boxId, { removed: false });
  }

  refreshDom() {
    if (typeof document === 'undefined') return;

    const container = document.querySelector(`[data-field-id="${this.config.id}"]`);
    if (!container) return;

    const markup = this.render().trim();
    const template = document.createElement('template');
    template.innerHTML = markup;
    const newContent = template.content.firstElementChild;

    if (newContent) {
      container.replaceWith(newContent);
    } else {
      container.innerHTML = markup;
    }
  }

  /**
   * Retorna classe CSS baseada no status
   */
  getStatusClass(status) {
    if (!status) return 'status-pending';
    if (status === '0') return 'status-ok';
    if (status === '50') return 'status-warning';
    if (status === '75') return 'status-alert';
    if (status === '100') return 'status-critical';
    return '';
  }

  /**
   * Retorna ícone apropriado para cada nível
   */
  getBoxIcon(caixa) {
    if (!caixa) return '📦';
    if (caixa.icone) return caixa.icone;
    return this.getDefaultBoxIcon(caixa.nome);
  }

  getDefaultBoxIcon(nome, fallbackIndex = 0) {
    if (!nome) return '📦';

    const normalized = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const matchKey = Object.keys(this.defaultBoxIcons || {}).find(key => normalized.includes(key));
    if (matchKey && this.defaultBoxIcons) {
      return this.defaultBoxIcons[matchKey];
    }

    const fallbackOrder = ['📦', '🧺', '🪣', '🗂️', '🧱', '🛍️'];
    return fallbackOrder[fallbackIndex % fallbackOrder.length];
  }

  getLevelIcon(nivel) {
    const icons = {
      '0': '✓',
      '50': '⚠',
      '75': '⚡',
      '100': '🔴'
    };
    return icons[nivel] || '📦';
  }

  /**
   * Gera HTML para alertas de caixas com alta ocupação
   */
  getAlertsHtml() {
    const caixasAlerta = this.caixas.filter(caixa =>
      !this.removidas[caixa.id] && (this.value[caixa.id] === '75' || this.value[caixa.id] === '100')
    );

    if (caixasAlerta.length === 0) return '';

    return `
      <div class="occupation-alert">
        <div class="occupation-alert-icon">⚠️</div>
        <div class="occupation-alert-content">
          <h4 class="occupation-alert-title">Atenção! Caixas com alta ocupação</h4>
          <p class="occupation-alert-subtitle">As seguintes caixas precisam de atenção ou remoção:</p>
          <ul class="occupation-alert-list">
            ${caixasAlerta.map(caixa => {
              const icon = this.value[caixa.id] === '100' ? '🔴' : '⚡';
              return `<li>${icon} <strong>${caixa.nome}</strong> - ${this.value[caixa.id]}%</li>`;
            }).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Valida o campo
   */
  validate() {
    this.errors = [];
    this.isValid = true;

    // Verificar se todas as caixas têm ocupação selecionada
    const caixasSemOcupacao = this.caixas.filter(caixa => !this.value[caixa.id]);

    if (caixasSemOcupacao.length > 0) {
      this.errors.push('Por favor, preencha a ocupação de todas as caixas');
      this.isValid = false;
    }

    return this.isValid;
  }

  /**
   * Obtém o valor do campo
   */
  getValue() {
    return this.composeValue();
  }

  /**
   * Define o valor do campo
   */
  setValue(value, options = {}) {
    const previousFull = this.composeValue();
    const previousState = this.composeValue({ includeTimestamp: false });
    const silent = !!options.silent;

    if (silent) {
      this._suppressDispatch = (this._suppressDispatch || 0) + 1;
    }

    try {
      if (typeof value === 'object' && value !== null) {
        const ocupacao = value.ocupacao ? { ...value.ocupacao } : { ...value };
        this.value = ocupacao;
        if (value.removidas) {
          this.removidas = { ...value.removidas };
        }
      } else {
        this.value = {};
        this.removidas = {};
        this.caixas.forEach(caixa => {
          this.value[caixa.id] = '';
        });
        this._boxTimestamps = {};
      }

      const incomingTimestamp = value && typeof value === 'object' ? value.timestamp : null;
      const incomingTimestamps = value && typeof value === 'object' ? value.timestamps : null;

      // Apenas atualizar timestamp se houver um valor de entrada válido
      // ou se for uma ação explícita do usuário (não silent)
      if (incomingTimestamp) {
        this._timestamp = incomingTimestamp;
      } else if (!silent && options.reason !== 'database_sync_update') {
        // Apenas criar novo timestamp para ações do usuário
        this._timestamp = new Date().toISOString();
      }

      if (incomingTimestamps && typeof incomingTimestamps === 'object') {
        this._boxTimestamps = { ...incomingTimestamps };
      } else if (!silent && options.caixaId && options.reason !== 'database_sync_update') {
        // Apenas atualizar timestamp da caixa para ações do usuário
        const nowIso = new Date().toISOString();
        this._boxTimestamps = {
          ...(this._boxTimestamps || {}),
          [options.caixaId]: nowIso
        };
      } else if (!this._boxTimestamps) {
        this._boxTimestamps = {};
      }

      const currentState = this.composeValue({ includeTimestamp: false });
      this.isDirty = JSON.stringify(previousState) !== JSON.stringify(currentState);

      if (this.isTouched) {
        this.validate(this.value);
      }

      const payload = this.composeValue();
      this.onValueChange(payload, previousFull);
      this.syncFormData();

      if (!silent) {
        this.dispatchChange(options.action || 'set_value', options.caixaId ?? null, {
          previousValue: previousState,
          currentValue: currentState,
          reason: options.reason || 'setValue',
          actionDetail: options.actionDetail || null
        });
      }

      return payload;
    } finally {
      if (silent) {
        this._suppressDispatch = Math.max((this._suppressDispatch || 1) - 1, 0);
      }
    }
  }

  /**
   * Reseta apenas os valores de ocupação, mantendo histórico de removidas
   * Use este método após envio do formulário
   */
  resetOccupation() {
    this.caixas.forEach(caixa => {
      // Se não foi removida, limpa a ocupação
      if (!this.removidas[caixa.id]) {
        this.value[caixa.id] = '';
      }
    });
    this.expandedBox = null;
    this.syncFormData();
  }

  /**
   * Reseta completamente o campo (inclusive removidas)
   * Use apenas quando necessário limpar todo o histórico
   */
  resetAll() {
    this.value = {};
    this.removidas = {};
    this.expandedBox = null;
    this.caixas.forEach(caixa => {
      this.value[caixa.id] = '';
    });
    this.syncFormData();
  }

  /**
   * Indica se este campo deve ser persistente entre envios
   */
  isPersistent() {
    return true;
  }

  /**
   * Prepara dados para envio
   */
  getSubmitData() {
    return {
      ocupacao: this.value,
      removidas: this.removidas,
      caixas_detalhes: this.caixas.map(caixa => ({
        id: caixa.id,
        nome: caixa.nome,
        nivel_ocupacao: this.value[caixa.id] || null,
        foi_removida: !!this.removidas[caixa.id],
        precisa_atencao: !this.removidas[caixa.id] && (this.value[caixa.id] >= 75)
      })),
      timestamp: new Date().toISOString(),
      resumo: {
        total_caixas: this.caixas.length,
        caixas_removidas: Object.keys(this.removidas).length,
        caixas_criticas: this.caixas.filter(c => !this.removidas[c.id] && this.value[c.id] >= 75).length,
        caixas_preenchidas: this.caixas.filter(c => this.value[c.id]).length
      }
    };
  }

  /**
   * Get Alpine.js data for the field
   */
  getAlpineData() {
    const fieldId = this.config.id;

    return {
      // Expose current values to Alpine
      ocupacao: this.value,
      removidas: this.removidas,
      expandedBox: this.expandedBox,

      // Method to handle occupation level selection
      selectOccupation(caixaId, nivel) {
        const field = window.fieldInstances?.[fieldId];
        if (field && typeof field.handleOccupationSelection === 'function') {
          field.handleOccupationSelection(caixaId, nivel);
          this.ocupacao = { ...field.value };
          this.removidas = { ...field.removidas };
          this.expandedBox = field.expandedBox;
        } else {
          this.ocupacao[caixaId] = nivel;
          this.updateFieldDisplay();
        }
      },

      // Method to toggle box expansion
      toggleBox(boxId) {
        const field = window.fieldInstances?.[fieldId];
        if (field && typeof field.handleToggleBox === 'function') {
          field.handleToggleBox(boxId);
          this.expandedBox = field.expandedBox;
        } else {
          this.expandedBox = this.expandedBox === boxId ? null : boxId;
          this.updateFieldDisplay();
        }
      },

      // Method to mark box as removed
      markRemoved(boxId) {
        const field = window.fieldInstances?.[fieldId];
        if (field && typeof field.handleMarkAsRemoved === 'function') {
          field.handleMarkAsRemoved(boxId);
          this.removidas = { ...field.removidas };
        } else {
          // Implementação local da confirmação se a instância não estiver disponível
          const caixa = field?.caixas?.find(c => c.id === boxId);
          const caixaNome = caixa ? caixa.nome : `Caixa ${boxId}`;
          
          // Usar função global de confirmação
          if (typeof window !== 'undefined' && typeof window.confirmBoxRemoval === 'function') {
            const confirmed = window.confirmBoxRemoval(boxId, caixaNome);
            
            if (!confirmed) {
              return; // Usuário cancelou a ação
            }
          }
          
          this.removidas[boxId] = true;
          this.updateFieldDisplay();
        }
      },

      // Method to undo removal
      undoRemoval(boxId) {
        const field = window.fieldInstances?.[fieldId];
        if (field && typeof field.handleUndoRemoval === 'function') {
          field.handleUndoRemoval(boxId);
          this.removidas = { ...field.removidas };
        } else {
          delete this.removidas[boxId];
          this.updateFieldDisplay();
        }
      },

      // Helper method to update field display
      updateFieldDisplay() {
        const field = window.fieldInstances?.[fieldId];
        if (field && typeof field.refreshDom === 'function') {
          field.refreshDom();
        }
      },

      // Helper method to get level icon
      getLevelIcon(nivel) {
        const icons = {
          '0': '✓',
          '50': '⚠',
          '75': '⚡',
          '100': '🔴'
        };
        return icons[nivel] || '📦';
      },

      // Helper method to check if box needs removal
      needsRemoval(caixaId) {
        return this.ocupacao[caixaId] >= 75 && !this.removidas[caixaId];
      }
    };
  }

  composeValue({ includeTimestamp = true } = {}) {
    const payload = {
      ocupacao: { ...this.value },
      removidas: { ...this.removidas },
      timestamps: { ...(this._boxTimestamps || {}) }
    };

    if (includeTimestamp && this._timestamp) {
      payload.timestamp = this._timestamp;
    }

    return payload;
  }

  dispatchChange(action, caixaId = null, extra = {}) {
    if (this._suppressDispatch > 0) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
      return;
    }

    try {
      const snapshot = this.composeValue();
      const submitData = typeof this.getSubmitData === 'function' ? this.getSubmitData() : null;
      const formId = this.config.formId || this.config.parentFormId || this.config.form_id || this.config.form || (typeof window !== 'undefined' ? window.currentFormId : null);
      const ecopontoValue = this.formData?.ecoponto ?? (typeof window !== 'undefined' ? window.formData?.ecoponto : undefined);

      const detail = {
        action,
        caixaId,
        fieldId: this.config.id,
        fieldLabel: this.config.label,
        formId,
        value: snapshot,
        submitData,
        ecopontoValue,
        timestamp: snapshot?.timestamp,
        source: 'OccupationField',
        ...extra
      };

      window.dispatchEvent(new CustomEvent('ecoponto-caixas:change', { detail }));
    } catch (error) {
      console.warn('OccupationField dispatchChange error:', error);
    }
  }

  /**
   * Atualiza o campo com base nos dados mais recentes do banco de dados
   * @param {string} ecopontoId - ID do ecoponto para sincronizar
   * @returns {Promise<Object>} Resultado da sincronização
   */
  async updateFromDatabase(ecopontoId) {
    if (!this.databaseSync) {
      console.warn('⚠️ DatabaseSyncService não está disponível');
      return {
        success: false,
        message: 'Serviço de sincronização não disponível'
      };
    }

    try {
      console.log(`🔄 Atualizando campo ${this.config.id} com dados do ecoponto ${ecopontoId}...`);
      
      // Obter dados atuais antes da atualização para comparação
      const previousValue = this.getValue();
      console.log(`📊 Valor anterior do campo:`, previousValue);
      
      const result = await this.databaseSync.updateFormField(ecopontoId, this);
      
      if (result.success) {
        const newValue = this.getValue();
        console.log(`✅ Campo atualizado com sucesso para ecoponto ${ecopontoId}`);
        console.log(`📊 Novo valor do campo:`, newValue);
        
        // Verificar se houve realmente alguma mudança significativa
        const hasChanges = this.hasSignificantChanges(previousValue, newValue);
        if (!hasChanges) {
            console.log(`ℹ️ Nenhuma mudança significativa detectada após atualização`);
        } else {
            console.log(`📈 Mudanças significativas detectadas e aplicadas`);
        }
        
        this.refreshDom();
      } else {
        console.warn('⚠️ Falha na atualização do campo:', result.message);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Erro ao atualizar campo do banco de dados:', error);
      return {
        success: false,
        error: error.message,
        message: 'Erro ao atualizar campo do banco de dados'
      };
    }
  }

  /**
   * Verifica se há mudanças significativas entre dois conjuntos de dados
   * @param {Object} oldValue - Valor anterior
   * @param {Object} newValue - Novo valor
   * @returns {boolean} True se houver mudanças significativas
   */
  hasSignificantChanges(oldValue, newValue) {
      // Comparar ocupação
      const oldOcupacao = oldValue.ocupacao || {};
      const newOcupacao = newValue.ocupacao || {};
      
      const allBoxes = new Set([
          ...Object.keys(oldOcupacao),
          ...Object.keys(newOcupacao)
      ]);
      
      for (const boxId of allBoxes) {
          if (oldOcupacao[boxId] !== newOcupacao[boxId]) {
              return true; // Encontrou diferença significativa
          }
      }
      
      // Comparar removidas
      const oldRemovidas = oldValue.removidas || {};
      const newRemovidas = newValue.removidas || {};
      
      const allRemoved = new Set([
          ...Object.keys(oldRemovidas),
          ...Object.keys(newRemovidas)
      ]);
      
      for (const boxId of allRemoved) {
          if (oldRemovidas[boxId] !== newRemovidas[boxId]) {
              return true; // Encontrou diferença significativa
          }
      }
      
      return false; // Nenhuma mudança significativa
  }

  /**
   * Inicia monitoramento automático de atualizações para um ecoponto
   * @param {string} ecopontoId - ID do ecoponto
   * @param {number} intervalMs - Intervalo em milissegundos (padrão: 30 segundos)
   * @returns {number} ID do intervalo para cancelamento
   */
  startAutoUpdate(ecopontoId, intervalMs = 3000) {
    if (!this.databaseSync) {
      console.warn('⚠️ DatabaseSyncService não está disponível');
      return null;
    }

    console.log(`⏰ Iniciando atualização automática para ecoponto ${ecopontoId}`);
    
    return this.databaseSync.startAutoUpdate(ecopontoId, this, intervalMs);
  }

  /**
   * Para monitoramento automático de atualizações
   * @param {number} intervalId - ID do intervalo
   */
  stopAutoUpdate(intervalId) {
    if (this.databaseSync && intervalId) {
      this.databaseSync.stopAutoUpdate(intervalId);
    }
  }

  syncFormData() {
    const fieldId = this.config.id;
    const snapshot = this.composeValue();

    if (this.$root && this.$root.formData) {
      this.$root.formData[fieldId] = snapshot;
      return;
    }

    if (this.config.formData) {
      this.config.formData[fieldId] = snapshot;
      return;
    }

    if (this.formData) {
      this.formData[fieldId] = snapshot;
      return;
    }

    if (typeof window !== 'undefined' && window.formData) {
      window.formData[fieldId] = snapshot;
    }
  }
}