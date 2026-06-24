// js/fields/types/ChecklistField.js
import BaseField from './BaseField.js';
import DataValidator from '../utils/dataValidator.js';

/**
 * Consolidated Checklist Field
 * Replaces InspectionChecklistField, VistoriaChecklistField, and UnifiedChecklistField
 * Supports multiple modes: inspection, vistoria, unified
 */
class ChecklistField extends BaseField {
  constructor(config = {}) {
    super(config);
    this.mode = this.detectMode(config);
    this.fieldType = this.getFieldTypeByMode();
    this.displayName = this.getDisplayNameByMode();
  }

  /**
   * Auto-detect the checklist mode based on configuration
   */
  detectMode(config) {
    // Explicit mode specification
    if (config.mode) {
      return config.mode;
    }

    // Auto-detect based on configuration properties
    if (config.states) {
      return 'inspection';
    }

    if (config.galpoes || config.categorias) {
      return 'vistoria';
    }

    // Check fieldType for backward compatibility
    if (config.fieldType) {
      if (config.fieldType.includes('inspection')) return 'inspection';
      if (config.fieldType.includes('vistoria')) return 'vistoria';
      if (config.fieldType.includes('unified')) return 'unified';
    }

    // Default to unified mode
    return 'unified';
  }

  /**
   * Get field type based on detected mode
   */
  getFieldTypeByMode() {
    switch (this.mode) {
      case 'inspection': return 'inspection_checklist';
      case 'vistoria': return 'vistoria_checklist';
      case 'unified': return 'unified_checklist';
      default: return 'unified_checklist';
    }
  }

  /**
   * Get display name based on detected mode
   */
  getDisplayNameByMode() {
    switch (this.mode) {
      case 'inspection': return 'Checklist de Inspeção';
      case 'vistoria': return 'Checklist de Vistoria';
      case 'unified': return 'Checklist Unificado';
      default: return 'Checklist Unificado';
    }
  }

  /**
   * Get field value - unified method for all modes
   */
  getValue() {
    switch (this.mode) {
      case 'inspection': return this.getInspectionValue();
      case 'vistoria': return this.getVistoriaValue();
      case 'unified': return this.getUnifiedValue();
      default: return this.getUnifiedValue();
    }
  }

  /**
   * Set field value - unified method for all modes
   */
  setValue(value) {
    switch (this.mode) {
      case 'inspection': return this.setInspectionValue(value);
      case 'vistoria': return this.setVistoriaValue(value);
      case 'unified': return this.setUnifiedValue(value);
      default: return this.setUnifiedValue(value);
    }
  }

  /**
   * Get value for inspection mode
   */
  getInspectionValue() {
    const fieldId = `field_${this.id}`;
    const container = document.getElementById(fieldId);
    if (!container) return null;

    const result = {
      respostas: {},
      observacoes: {},
      timestamp: new Date().toISOString()
    };

    // Get all radio button selections
    const radioInputs = container.querySelectorAll('input[type="radio"]:checked');
    radioInputs.forEach(input => {
      const itemId = input.name.replace(`${fieldId}_`, '');
      result.respostas[itemId] = input.value;
    });

    // Get all observations
    const textareas = container.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      const itemId = textarea.getAttribute('onchange')?.match(/'([^']+)'/)?.[1];
      if (itemId && textarea.value.trim()) {
        result.observacoes[itemId] = textarea.value.trim();
      }
    });

    return Object.keys(result.respostas).length > 0 ? result : null;
  }

  /**
   * Set value for inspection mode
   */
  setInspectionValue(value) {
    if (!value) return;

    const fieldId = `field_${this.id}`;
    const container = document.getElementById(fieldId);
    if (!container) return;

    // Set radio button selections
    if (value.respostas) {
      Object.entries(value.respostas).forEach(([itemId, state]) => {
        const radio = container.querySelector(`input[name="${fieldId}_${itemId}"][value="${state}"]`);
        if (radio) {
          radio.checked = true;
        }
      });
    }

    // Set observations
    if (value.observacoes) {
      Object.entries(value.observacoes).forEach(([itemId, observation]) => {
        const textarea = container.querySelector(`textarea[onchange*="${itemId}"]`);
        if (textarea) {
          textarea.value = observation;
        }
      });
    }

    // Update summary
    if (typeof window.updateInspectionSummary === 'function') {
      window.updateInspectionSummary();
    }
  }

  /**
   * Get value for vistoria mode (using Alpine.js data)
   */
  getVistoriaValue() {
    // This will be handled by Alpine.js getValue method
    const alpineData = this.getAlpineData();
    return alpineData.getValue ? alpineData.getValue() : null;
  }

  /**
   * Set value for vistoria mode (using Alpine.js data)  
   */
  setVistoriaValue(value) {
    // This will be handled by Alpine.js setValue method
    const alpineData = this.getAlpineData();
    if (alpineData.setValue) {
      alpineData.setValue(value);
    }
  }

  /**
   * Get value for unified mode (delegates to detected submode)
   */
  getUnifiedValue() {
    const config = this.config || {};
    const detectedSubMode = config.states ? 'inspection' : 'vistoria';
    return detectedSubMode === 'inspection' ? this.getInspectionValue() : this.getVistoriaValue();
  }

  /**
   * Set value for unified mode (delegates to detected submode)
   */
  setUnifiedValue(value) {
    const config = this.config || {};
    const detectedSubMode = config.states ? 'inspection' : 'vistoria';
    return detectedSubMode === 'inspection' ? this.setInspectionValue(value) : this.setVistoriaValue(value);
  }

  /**
   * Main render method - delegates to mode-specific renderer
   */
  render() {
    switch (this.mode) {
      case 'inspection': return this.renderInspectionMode();
      case 'vistoria': return this.renderVistoriaMode();
      case 'unified': return this.renderUnifiedMode();
      default: return this.renderUnifiedMode();
    }
  }

  /**
   * Render inspection checklist mode
   */
  renderInspectionMode() {
    const fieldId = `field_${this.id}`;
    const config = this.config || {};

    // Default states for inspection
    const defaultStates = [
      { value: 'ok', label: 'OK', icon: '✅', color: '#4CAF50' },
      { value: 'nok', label: 'Não OK', icon: '❌', color: '#F44336' },
      { value: 'na', label: 'N/A', icon: '➖', color: '#9E9E9E' }
    ];

    const states = config.states || defaultStates;
    const dataSource = this.resolveDataSource(config);

    return `
      <div class="inspection-checklist-field" id="${fieldId}">
        <label class="field-label">${this.escapeHtml(this.label || 'Checklist de Inspeção')}</label>

        <div class="inspection-container" id="${fieldId}_container">
          ${this.renderInspectionItems(dataSource, states, fieldId)}
        </div>

        <div class="inspection-summary" id="${fieldId}_summary" style="display: none;">
          <div class="summary-header">
            <h4>Resumo da Inspeção</h4>
            <div class="summary-stats">
              <span class="stat-ok">✅ OK: <span id="${fieldId}_ok_count">0</span></span>
              <span class="stat-nok">❌ Não OK: <span id="${fieldId}_nok_count">0</span></span>
              <span class="stat-na">➖ N/A: <span id="${fieldId}_na_count">0</span></span>
            </div>
          </div>
        </div>

        ${this.getInspectionStyles()}
        ${this.getInspectionJavaScript(fieldId)}
      </div>
    `;
  }

  /**
   * Render vistoria checklist mode
   */
  renderVistoriaMode() {
    return `
      <div class="vistoria-checklist-field" id="field_${this.id}" x-data="${this.id}_data">
        <label class="field-label">${this.escapeHtml(this.label || 'Checklist de Vistoria')}</label>
        
        <div class="galpao-selector">
          <label>Selecione o Galpão:</label>
          <select x-model="galpaoSelecionado" class="form-select">
            <option value="">-- Selecione --</option>
            <template x-for="galpao in galpoes" :key="galpao">
              <option :value="galpao" x-text="galpao"></option>
            </template>
          </select>
        </div>

        <div class="checklist-container" x-show="galpaoSelecionado">
          ${this.renderVistoriaCategories()}
        </div>

        <div class="vistoria-summary" x-show="galpaoSelecionado">
          <div class="summary-stats">
            <span class="stat-conforme">✅ Conformes: <span x-text="totalConformes"></span></span>
            <span class="stat-nao-conforme">❌ Não Conformes: <span x-text="totalNaoConformes"></span></span>
            <span class="stat-pendente">⏳ Pendentes: <span x-text="totalPendentes"></span></span>
          </div>
        </div>

        ${this.getVistoriaStyles()}
      </div>
    `;
  }

  /**
   * Render unified checklist mode
   */
  renderUnifiedMode() {
    const config = this.config || {};
    const detectedSubMode = config.states ? 'inspection' : 'vistoria';

    return `
      <div class="unified-checklist-field" id="field_${this.id}" x-data="${this.id}_data">
        <label class="field-label">${this.escapeHtml(this.label || 'Checklist Unificado')}</label>
        
        <div class="mode-indicator">
          <span class="badge">Modo: ${detectedSubMode === 'inspection' ? 'Inspeção' : 'Vistoria'}</span>
        </div>

        <div class="unified-container">
          ${detectedSubMode === 'inspection' ?
        this.renderUnifiedInspectionContent() :
        this.renderUnifiedVistoriaContent()}
        </div>

        ${this.getUnifiedStyles()}
      </div>
    `;
  }

  /**
   * Resolve data source from various configuration options
   */
  resolveDataSource(config) {
    let dataSource = [];

    // Priority order: rawData > items > dataSource array > dataSource string
    if (Array.isArray(config.rawData) && config.rawData.length) {
      dataSource = config.rawData;
    } else if (Array.isArray(config.items) && config.items.length) {
      dataSource = config.items;
    } else if (Array.isArray(config.dataSource) && config.dataSource.length) {
      dataSource = config.dataSource;
    } else if (typeof config.dataSource === 'string') {
      try {
        const dsKey = config.dataSource.replace(/\.json$/i, '');
        if (typeof window !== 'undefined' && window.rawDataSources && window.rawDataSources[dsKey]) {
          dataSource = window.rawDataSources[dsKey];
        }
      } catch (e) {
        console.debug('ChecklistField: Failed to load dataSource', e);
      }
    }

    // Validate data structure if loaded from external source
    if (dataSource && typeof config.dataSource === 'string') {
      try {
        DataValidator.assertValid(dataSource, 'vistoria');
      } catch (validationError) {
        console.warn('ChecklistField: Invalid data structure:', validationError.message);
        dataSource = [];
      }
    }

    return dataSource;
  }

  /**
   * Get Alpine.js data for the field
   */
  getAlpineData() {
    switch (this.mode) {
      case 'inspection': return this.getInspectionAlpineData();
      case 'vistoria': return this.getVistoriaAlpineData();
      case 'unified': return this.getUnifiedAlpineData();
      default: return this.getUnifiedAlpineData();
    }
  }

  /**
   * Get Alpine.js data for inspection mode
   */
  getInspectionAlpineData() {
    const fieldId = this.config.id;
    const config = this.config || {};
    const dataSource = this.resolveDataSource(config);

    return {
      respostas: {},
      observacoes: {},
      dataSource: dataSource,

      getValue() {
        return {
          respostas: this.respostas,
          observacoes: this.observacoes
        };
      },

      setValue(value) {
        if (value) {
          this.respostas = value.respostas || {};
          this.observacoes = value.observacoes || {};
        }
      },

      updateSummary() {
        // Update summary statistics
        this.updateInspectionCounts();
      }
    };
  }

  /**
   * Get Alpine.js data for vistoria mode
   */
  getVistoriaAlpineData() {
    const fieldId = this.config.id;
    const config = this.config || {};
    const dataSource = this.resolveDataSource(config);

    // Resolve galpões and categorias
    let galpoes = config.galpoes || ["ACMR", "Amigos da Natureza", "Aresp", "Sul Recicla"];
    let categorias = config.categorias || this.getDefaultCategorias();

    if (dataSource) {
      if (dataSource.galpoes) {
        galpoes = dataSource.galpoesEstruturados ?
          dataSource.galpoesEstruturados.map(g => g.nome) :
          dataSource.galpoes;
      }
      if (dataSource.categorias) {
        categorias = dataSource.categorias;
      }
    }

    return {
      galpaoSelecionado: '',
      respostas: {},
      observacoes: {},
      galpoes: galpoes,
      categorias: categorias,

      get totalConformes() {
        return Object.values(this.respostas).filter(r => r === 'conforme').length;
      },

      get totalNaoConformes() {
        return Object.values(this.respostas).filter(r => r === 'nao_conforme').length;
      },

      get totalPendentes() {
        let total = 0;
        this.categorias.forEach(cat => {
          if (cat.subcategorias) {
            cat.subcategorias.forEach(sub => {
              total += sub.items.length;
            });
          } else if (cat.items) {
            total += cat.items.length;
          }
        });
        return total - this.totalConformes - this.totalNaoConformes;
      },

      getValue() {
        return {
          galpao: this.galpaoSelecionado,
          respostas: this.respostas,
          observacoes: this.observacoes,
          resumo: {
            conformes: this.totalConformes,
            naoConformes: this.totalNaoConformes,
            pendentes: this.totalPendentes
          }
        };
      },

      setValue(value) {
        if (value) {
          this.galpaoSelecionado = value.galpao || '';
          this.respostas = value.respostas || {};
          this.observacoes = value.observacoes || {};
        }
      }
    };
  }

  /**
   * Get Alpine.js data for unified mode
   */
  getUnifiedAlpineData() {
    const config = this.config || {};
    const detectedSubMode = config.states ? 'inspection' : 'vistoria';

    return detectedSubMode === 'inspection' ?
      this.getInspectionAlpineData() :
      this.getVistoriaAlpineData();
  }

  /**
   * Render inspection items (shared method)
   */
  renderInspectionItems(dataSource, states, fieldId) {
    if (!Array.isArray(dataSource) || dataSource.length === 0) {
      return '<div class="empty-state">Nenhum item disponível para inspeção</div>';
    }

    let html = '';
    dataSource.forEach(categoria => {
      html += `
        <div class="inspection-category">
          <div class="category-header" onclick="toggleCategory('${categoria.id}')">
            <div class="category-title">
              <span class="category-toggle" id="toggle_${categoria.id}">▶</span>
              ${this.escapeHtml(categoria.nome || categoria.title || categoria.label)}
            </div>
          </div>
          <div class="category-content" id="content_${categoria.id}">
            ${this.renderInspectionSubcategories(categoria, states, fieldId)}
          </div>
        </div>
      `;
    });

    return html;
  }

  /**
   * Render inspection subcategories
   */
  renderInspectionSubcategories(categoria, states, fieldId) {
    let html = '';

    if (categoria.subcategorias) {
      categoria.subcategorias.forEach(sub => {
        html += `
          <div class="inspection-subcategory">
            <div class="subcategory-title">${this.escapeHtml(sub.nome || sub.title)}</div>
            ${this.renderInspectionItems_Items(sub.items || [], states, fieldId)}
          </div>
        `;
      });
    } else if (categoria.items) {
      html += `
        <div class="inspection-subcategory">
          ${this.renderInspectionItems_Items(categoria.items, states, fieldId)}
        </div>
      `;
    }

    return html;
  }

  /**
   * Render individual inspection items
   */
  renderInspectionItems_Items(items, states, fieldId) {
    let html = '';

    items.forEach(item => {
      const itemId = item.id || item.codigo;
      html += `
        <div class="inspection-item">
          <div class="item-description">${this.escapeHtml(item.descricao || item.description || item.label)}</div>
          <div class="item-states">
            ${states.map(state => `
              <label class="state-option">
                <input type="radio" 
                       name="${fieldId}_${itemId}" 
                       value="${state.value}"
                       onchange="updateInspectionState('${fieldId}', '${itemId}', '${state.value}')">
                <span class="state-label" style="color: ${state.color}">
                  ${state.icon} ${state.label}
                </span>
              </label>
            `).join('')}
          </div>
          <div class="item-observation">
            <textarea placeholder="Observação (opcional)" 
                      onchange="updateInspectionObservation('${fieldId}', '${itemId}', this.value)"></textarea>
          </div>
        </div>
      `;
    });

    return html;
  }

  /**
   * Render vistoria categories
   */
  renderVistoriaCategories() {
    return `
      <template x-for="categoria in categorias" :key="categoria.id">
        <div class="vistoria-category">
          <div class="category-header" x-text="categoria.nome"></div>
          <div class="category-content">
            <template x-for="subcategoria in categoria.subcategorias" :key="subcategoria.id">
              <div class="vistoria-subcategory">
                <div class="subcategory-title" x-text="subcategoria.nome"></div>
                <div class="subcategory-items">
                  <template x-for="item in subcategoria.items" :key="item.id">
                    <div class="vistoria-item">
                      <div class="item-description" x-text="item.descricao"></div>
                      <div class="item-controls">
                        <select :name="'item_' + item.id" x-model="respostas[item.id]">
                          <option value="">-- Selecione --</option>
                          <option value="conforme">✅ Conforme</option>
                          <option value="nao_conforme">❌ Não Conforme</option>
                        </select>
                        <textarea :placeholder="'Observação para ' + item.descricao" 
                                  x-model="observacoes[item.id]"></textarea>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    `;
  }

  /**
   * Render unified mode inspection content
   */
  renderUnifiedInspectionContent() {
    return `
      <div class="unified-inspection">
        <div class="inspection-items" x-show="Object.keys(dataSource).length > 0">
          <!-- Inspection items will be rendered here -->
        </div>
        <div class="empty-state" x-show="Object.keys(dataSource).length === 0">
          Nenhum item disponível para inspeção
        </div>
      </div>
    `;
  }

  /**
   * Render unified mode vistoria content
   */
  renderUnifiedVistoriaContent() {
    return `
      <div class="unified-vistoria">
        <div class="galpao-selector">
          <label>Selecione o Galpão:</label>
          <select x-model="galpaoSelecionado" class="form-select">
            <option value="">-- Selecione --</option>
            <template x-for="galpao in galpoes" :key="galpao">
              <option :value="galpao" x-text="galpao"></option>
            </template>
          </select>
        </div>
        
        <div x-show="galpaoSelecionado">
          ${this.renderVistoriaCategories()}
        </div>
      </div>
    `;
  }

  /**
   * Get default categories for vistoria mode
   */
  getDefaultCategorias() {
    return [
      {
        id: "seguranca_epi",
        nome: "Segurança e EPI",
        subcategorias: [
          {
            id: "trabalhadores_prensa",
            nome: "Trabalhadores na Prensa",
            items: [
              { id: "1-1", codigo: "oculos_seguranca", descricao: "Óculos de segurança na Prensa" },
              { id: "1-2", codigo: "protetores_auriculares", descricao: "Protetores auriculares na Prensa" },
              { id: "1-3", codigo: "luvas_seguranca", descricao: "Luvas de segurança na Prensa" },
              { id: "1-4", codigo: "calcado_fechado", descricao: "Calçado aberto na Prensa" }
            ]
          },
          {
            id: "trabalhadores_geral",
            nome: "Trabalhadores em Geral (Triadores)",
            items: [
              { id: "2-1", codigo: "oculos_seguranca", descricao: "Óculos de segurança" },
              { id: "2-2", codigo: "protetores_auriculares", descricao: "Protetores auriculares" },
              { id: "2-3", codigo: "luvas_seguranca", descricao: "Luvas de segurança" },
              { id: "2-4", codigo: "calcado_fechado", descricao: "Calçado aberto" },
              { id: "2-5", codigo: "presenca_criancas_menores", descricao: "Crianças e/ou Adolescentes" },
              { id: "2-6", codigo: "vestigio_moradia_local", descricao: "Vestígio de pessoas dormindo no local" },
              { id: "2-7", codigo: "presenca_animais_domesticos", descricao: "Animais domésticos" }
            ]
          }
        ]
      },
      {
        id: "infraestrutura",
        nome: "Infraestrutura",
        subcategorias: [
          {
            id: "instalacoes_fisicas",
            nome: "Instalações Físicas",
            items: [
              { id: "3-1", codigo: "cobertura_adequada", descricao: "Cobertura adequada" },
              { id: "3-2", codigo: "piso_concreto", descricao: "Piso de concreto" },
              { id: "3-3", codigo: "drenagem_aguas", descricao: "Drenagem de águas pluviais" },
              { id: "3-4", codigo: "cerca_perimetral", descricao: "Cerca perimetral" }
            ]
          }
        ]
      }
    ];
  }

  /**
   * Get inspection mode JavaScript
   */
  getInspectionJavaScript(fieldId) {
    return `
      <script>
        (function() {
          function initializeInspectionChecklist() {
            const container = document.getElementById('${fieldId}_container');
            if (!container) return;

            // Toggle categories
            container.addEventListener('click', function(e) {
              if (e.target.closest('.category-header')) {
                const header = e.target.closest('.category-header');
                const content = header.nextElementSibling;
                const toggle = header.querySelector('.category-toggle');

                if (content && toggle) {
                  content.classList.toggle('expanded');
                  toggle.classList.toggle('rotated');
                }
              }
            });

            // Handle status button clicks
            container.addEventListener('click', function(e) {
              if (e.target.closest('.status-option input[type="radio"]')) {
                updateInspectionSummary();
              }
            });

            // Initialize expanded categories
            const categories = container.querySelectorAll('.category-content');
            categories.forEach(content => content.classList.add('expanded'));
            const toggles = container.querySelectorAll('.category-toggle');
            toggles.forEach(toggle => toggle.classList.add('rotated'));
          }

          function updateInspectionSummary() {
            const container = document.getElementById('${fieldId}_container');
            const summary = document.getElementById('${fieldId}_summary');
            if (!container || !summary) return;

            const okInputs = container.querySelectorAll('input[type="radio"][value="ok"]:checked');
            const nokInputs = container.querySelectorAll('input[type="radio"][value="nok"]:checked');
            const naInputs = container.querySelectorAll('input[type="radio"][value="na"]:checked');

            const okCount = okInputs.length;
            const nokCount = nokInputs.length;
            const naCount = naInputs.length;

            const okCountEl = document.getElementById('${fieldId}_ok_count');
            const nokCountEl = document.getElementById('${fieldId}_nok_count');
            const naCountEl = document.getElementById('${fieldId}_na_count');

            if (okCountEl) okCountEl.textContent = okCount;
            if (nokCountEl) nokCountEl.textContent = nokCount;
            if (naCountEl) naCountEl.textContent = naCount;

            // Show summary if there are any selections
            if (okCount + nokCount + naCount > 0) {
              summary.style.display = 'block';
            } else {
              summary.style.display = 'none';
            }
          }

          // Global functions for inline event handlers
          window.toggleCategory = function(categoryId) {
            const content = document.getElementById('content_' + categoryId);
            const toggle = document.getElementById('toggle_' + categoryId);
            if (content && toggle) {
              content.classList.toggle('expanded');
              toggle.classList.toggle('rotated');
            }
          };

          window.updateInspectionState = function(fieldId, itemId, state) {
            updateInspectionSummary();
            // Trigger custom event for form integration
            const event = new CustomEvent('inspection-state-changed', {
              detail: { fieldId, itemId, state }
            });
            document.dispatchEvent(event);
          };

          window.updateInspectionObservation = function(fieldId, itemId, observation) {
            // Trigger custom event for form integration
            const event = new CustomEvent('inspection-observation-changed', {
              detail: { fieldId, itemId, observation }
            });
            document.dispatchEvent(event);
          };

          // Initialize when DOM is ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeInspectionChecklist);
          } else {
            initializeInspectionChecklist();
          }
        })();
      </script>
    `;
  }

  /**
   * Get inspection mode styles
   */
  getInspectionStyles() {
    return `
      <style>
        .inspection-checklist-field {
          margin-bottom: 20px;
        }

        .inspection-category {
          margin-bottom: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }

        .category-header {
          background: #f8f9fa;
          padding: 12px 16px;
          border-bottom: 1px solid #e0e0e0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .category-header:hover {
          background: #f0f1f2;
        }

        .category-title {
          font-weight: 600;
          color: #333;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .category-toggle {
          font-size: 18px;
          color: #666;
          transition: transform 0.2s;
        }

        .category-toggle.rotated {
          transform: rotate(90deg);
        }

        .category-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
        }

        .category-content.expanded {
          max-height: 2000px;
        }

        .inspection-subcategory {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .inspection-subcategory:last-child {
          border-bottom: none;
        }

        .subcategory-title {
          font-weight: 500;
          color: #555;
          margin-bottom: 12px;
          padding-left: 8px;
          border-left: 3px solid transparent;
        }

        .inspection-item {
          background: #fafafa;
          border: 1px solid #e8e8e8;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .item-description {
          font-weight: 500;
          margin-bottom: 8px;
          color: #333;
        }

        .item-states {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .state-option {
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }

        .state-label {
          font-size: 14px;
          font-weight: 500;
        }

        .item-observation textarea {
          width: 100%;
          min-height: 60px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          resize: vertical;
        }

        .inspection-summary {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-top: 20px;
        }

        .summary-header h4 {
          margin: 0 0 12px 0;
          color: #333;
        }

        .summary-stats {
          display: flex;
          gap: 16px;
        }

        .summary-stats span {
          font-weight: 500;
        }

        .stat-ok { color: #4CAF50; }
        .stat-nok { color: #F44336; }
        .stat-na { color: #9E9E9E; }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #666;
          font-style: italic;
        }
      </style>
    `;
  }

  /**
   * Get vistoria mode styles
   */
  getVistoriaStyles() {
    return `
      <style>
        .vistoria-checklist-field {
          margin-bottom: 20px;
        }

        .galpao-selector {
          margin-bottom: 20px;
          padding: 16px;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
        }

        .galpao-selector label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
        }

        .form-select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }

        .vistoria-category {
          margin-bottom: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }

        .vistoria-category .category-header {
          background: #e3f2fd;
          padding: 12px 16px;
          font-weight: 600;
          color: #1565c0;
        }

        .vistoria-subcategory {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .vistoria-subcategory:last-child {
          border-bottom: none;
        }

        .vistoria-subcategory .subcategory-title {
          font-weight: 500;
          color: #555;
          margin-bottom: 12px;
          padding-left: 8px;
          border-left: 3px solid #2196f3;
        }

        .vistoria-item {
          background: #fafafa;
          border: 1px solid #e8e8e8;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .vistoria-item .item-description {
          font-weight: 500;
          margin-bottom: 8px;
          color: #333;
        }

        .item-controls {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .item-controls select {
          min-width: 150px;
          padding: 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .item-controls textarea {
          flex: 1;
          min-height: 60px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          resize: vertical;
        }

        .vistoria-summary {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-top: 20px;
        }

        .summary-stats {
          display: flex;
          gap: 16px;
        }

        .summary-stats span {
          font-weight: 500;
        }

        .stat-conforme { color: #4CAF50; }
        .stat-nao-conforme { color: #F44336; }
        .stat-pendente { color: #FF9800; }
      </style>
    `;
  }

  /**
   * Get unified mode styles
   */
  getUnifiedStyles() {
    return `
      <style>
        .unified-checklist-field {
          margin-bottom: 20px;
        }

        .mode-indicator {
          margin-bottom: 16px;
        }

        .mode-indicator .badge {
          display: inline-block;
          background: #2196f3;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .unified-container {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
        }

        /* Inherit styles from inspection and vistoria modes */
        .unified-inspection .inspection-item,
        .unified-vistoria .vistoria-item {
          background: #fafafa;
          border: 1px solid #e8e8e8;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
        }
      </style>
    `;
  }
}

export default ChecklistField;