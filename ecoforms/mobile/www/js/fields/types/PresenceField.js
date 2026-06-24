// js/fields/types/PresenceField.js
import BaseField from './BaseField.js';
import { normalizeValue, isSentinel, ensureId, getGroupValue, contrastColor } from '../utils/presenceHelpers.js';

/**
 * Consolidated Presence Field
 * Replaces PresenceCompactField, PresenceSelectorCompactField, and presenceListField
 * Supports multiple variants: compact, selector, list
 */
class PresenceField extends BaseField {
  constructor(config = {}) {
    super(config);
    this.variant = this.detectVariant(config);
    this.fieldType = this.getFieldTypeByVariant();
    this.displayName = this.getDisplayNameByVariant();
    
    // Common presence field properties
    this.participantLabelKey = config.participantLabelKey || 'nome';
    this.groupField = config.groupField || 'nome_galpao';
    this.groupKey = config.groupKey || 'galpao';
    this.statuses = {}; // id -> status

    // Shared formData reference (prefer existing global instance)
    const globalFormData = (typeof window !== 'undefined' && window.formData) ? window.formData : undefined;
    this.formData = config.formData || this.config.formData || globalFormData || {};
    if (!this.config.formData) {
      this.config.formData = this.formData;
    }

    // Initialize participants data
    const sourceParticipants = Array.isArray(config.participants) && config.participants.length
      ? config.participants
      : (Array.isArray(config.rawData) ? config.rawData : []);

    this.initialParticipants = sourceParticipants.map(p => (typeof p === 'object' && p !== null ? { ...p } : p));
    
    // Variant-specific initialization
    this.initializeVariant(config);
  }

  /**
   * Auto-detect the presence field variant based on configuration
   */
  detectVariant(config) {
    // Explicit variant specification
    if (config.variant) {
      return config.variant;
    }

    // PRIORITY 1: Check type/fieldType first (most explicit)
    if (config.fieldType || config.type) {
      const type = config.fieldType || config.type;
      if (type.includes('selector')) return 'selector';
      if (type.includes('compact')) return 'compact';
      if (type.includes('list')) return 'list';
    }

    // PRIORITY 2: Auto-detect based on configuration properties
    if (config.useSmartFilters || config.filterSystem || config.filterOptions) {
      return 'selector';
    }

    if (config.columns === 2 || config.compact === true) {
      return 'compact';
    }

    // Default to list variant
    return 'list';
  }

  /**
   * Get field type based on detected variant
   */
  getFieldTypeByVariant() {
    switch (this.variant) {
      case 'compact': return 'presence_compact';
      case 'selector': return 'presence_selector_compact';
      case 'list': return 'presence_list';
      default: return 'presence_list';
    }
  }

  /**
   * Get display name based on detected variant
   */
  getDisplayNameByVariant() {
    switch (this.variant) {
      case 'compact': return 'Lista de Presença Compacta';
      case 'selector': return 'Seletor de Presença Avançado';
      case 'list': return 'Lista de Presença';
      default: return 'Lista de Presença';
    }
  }

  /**
   * Initialize variant-specific properties
   */
  initializeVariant(config) {
    switch (this.variant) {
      case 'compact':
        this.initializeCompactVariant(config);
        break;
      case 'selector':
        this.initializeSelectorVariant(config);
        break;
      case 'list':
        this.initializeListVariant(config);
        break;
      default:
        this.initializeListVariant(config);
    }
  }

  /**
   * Initialize compact variant properties
   */
  initializeCompactVariant(config) {
    // Columns: 1 or 2 (default 1)
    this.columns = (config && Number(config.columns) === 2) ? 2 : 1;
    
    // Status configuration
    this.statusSequence = (config && Array.isArray(config.statusSequence) && config.statusSequence.length) 
      ? config.statusSequence 
      : ['presente','ausente','desligado'];
      
    this.statusColors = (config && config.statusColors) 
      ? config.statusColors 
      : { presente: '#4CAF50', ausente: '#F44336', desligado: '#FF9800' };
      
    this.statusLabels = (config && config.statusLabels) 
      ? config.statusLabels 
      : { presente: 'Presente', ausente: 'Ausente', desligado: 'Desligado' };
  }

  /**
   * Initialize selector variant properties
   */
  initializeSelectorVariant(config) {
    // Smart filters system
    this.useSmartFilters = config.useSmartFilters !== false;
    this.filterSystem = this.getFilterSystem();
    this.currentCategory = config.category || null;
    this.filterOptions = config.filterOptions || {};

    // Cache for filtered people
    this.filteredPeopleCache = null;
    this.lastFilterUpdate = null;

    // Loading state
    this.isLoading = false;

    // Presence states configuration
    this.presenceStates = this.initializePresenceStates(config);

    // Form data and dependent filters
    const globalFormData = (typeof window !== 'undefined') ? window.formData : null;
    this.formData = config.formData || this.config.formData || this.formData || globalFormData || {};
    if (!this.config.formData && this.formData) {
      this.config.formData = this.formData;
    }
  }

  /**
   * Initialize list variant properties
   */
  initializeListVariant(config) {
    // Default status configuration
    this.defaultStatus = config.defaultStatus || null;
    
    // Status colors and classes
    this.statusColors = (config && config.statusColors) ? config.statusColors : {};
    this.statusClasses = (config && config.statusClasses) ? config.statusClasses : {};
    
    // Status sequence and labels
    this.statusSequence = (config && Array.isArray(config.statusSequence) && config.statusSequence.length) 
      ? config.statusSequence 
      : ['presente','ausente','desligado'];
    this.statusLabels = (config && config.statusLabels) ? config.statusLabels : {};
  }

  /**
   * Main render method - delegates to variant-specific renderer
   */
  render() {
    switch (this.variant) {
      case 'compact': return this.renderCompactVariant();
      case 'selector': return this.renderSelectorVariant();
      case 'list': return this.renderListVariant();
      default: return this.renderListVariant();
    }
  }

  /**
   * Render compact variant
   */
  renderCompactVariant() {
    const fieldId = `field_${this.id}`;
    const columnClass = this.columns === 2 ? 'two-columns' : 'single-column';

    return `
  <div class="presence-compact-field ${columnClass}" id="${fieldId}" x-data="field_${this.id}_data">
        <label class="field-label">${this.escapeHtml(this.label || this.displayName)}</label>
        
        <div class="presence-controls">
          <div class="filter-controls">
            <input type="text" 
                   x-model="searchTerm" 
                   placeholder="Buscar participante..." 
                   class="search-input"
                   x-show="filteredParticipants.length > 10">
            <div class="status-filters" x-show="participants.length > 10">
              <button type="button" 
                      class="status-chip"
                      :class="{ 'active': statusFilter.length === 0 }"
                      @click="statusFilter = []">
                Todos
              </button>
              <template x-for="status in statusSequence" :key="status">
                <button type="button" 
                        class="status-chip"
                        :class="{ 'active': statusFilter.includes(status) }"
                        :style="statusFilter.includes(status) ? 'background-color: ' + (statusColors[status] || '#666') + '; color: white; border-color: ' + (statusColors[status] || '#666') : ''"
                        @click="toggleStatusFilter(status)">
                  <span x-text="statusLabels[status] || status"></span>
                </button>
              </template>
            </div>
          </div>

          <div class="participants-grid" :class="'columns-' + ${this.columns}">
            <template x-for="participant in filteredParticipants" :key="participant.id">
              <div class="participant-item">
                <div class="participant-name" x-text="participant[labelKey]"></div>
                <div class="status-buttons">
                  <template x-for="status in statusSequence" :key="status">
                    <button type="button" 
                            class="status-btn"
                            :class="{ 'active': statuses[participant.id] === status }"
                            :style="statuses[participant.id] === status ? 'background-color: ' + (statusColors[status] || '#666') + '; color: ' + statusTextColor(participant.id) : ''"
                            @click="toggleStatus(participant.id, status)"
                            x-text="statusLabels[status] || status">
                    </button>
                  </template>
                </div>
              </div>
            </template>
          </div>

          <div class="presence-summary" x-show="Object.keys(statuses).length > 0">
            <div class="summary-stats">
              <template x-for="status in statusSequence" :key="status">
                <span class="stat-item" :style="'color: ' + (statusColors[status] || '#666')">
                  <span x-text="statusLabels[status] || status"></span>: 
                  <span x-text="getStatusCount(status)"></span>
                </span>
              </template>
            </div>
          </div>
        </div>

        ${this.getCompactStyles()}
      </div>
    `;
  }

  /**
   * Render selector variant
   */
  renderSelectorVariant() {
    const fieldId = `field_${this.id}`;

    return `
  <div class="presence-selector-compact-field" id="${fieldId}" x-data="field_${this.id}_data">
        <label class="field-label">${this.escapeHtml(this.label || this.displayName)}</label>
        
        <div class="selector-container">
          <div class="smart-filters" x-show="useSmartFilters">
            <div class="filter-section">
              <h4>Filtros Inteligentes</h4>
              <div class="filter-options">
                <template x-for="(filter, key) in availableFilters" :key="key">
                  <div class="filter-option">
                    <label x-text="filter.label"></label>
                    <select x-model="activeFilters[key]">
                      <option value="">Todos</option>
                      <template x-for="option in filter.options" :key="option.value">
                        <option :value="option.value" x-text="option.label"></option>
                      </template>
                    </select>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div class="people-selection">
            <div class="search-section">
              <input type="text" 
                     x-model="searchTerm" 
                     placeholder="Buscar cooperado..." 
                     class="search-input">
              <div class="search-stats" x-show="searchTerm">
                <span x-text="filteredPeople.length"></span> cooperados encontrados
              </div>
            </div>

            <div class="people-grid" x-show="!isLoading">
              <template x-for="person in paginatedPeople" :key="person.id">
                <div class="person-card" 
                     :class="{ 'selected': selectedPeople.includes(person.id) }"
                     @click="togglePerson(person.id)">
                  <div class="person-info">
                    <div class="person-name" x-text="person.nome"></div>
                    <div class="person-details">
                      <span x-text="person.galpao || 'N/A'"></span>
                      <span x-text="person.funcao || ''"></span>
                    </div>
                  </div>
                  <div class="selection-indicator">
                    <i class="icon" :class="selectedPeople.includes(person.id) ? 'icon-check' : 'icon-plus'"></i>
                  </div>
                </div>
              </template>
            </div>

            <div class="pagination" x-show="totalPages > 1">
              <button @click="prevPage()" :disabled="currentPage === 1">Anterior</button>
              <span>Página <span x-text="currentPage"></span> de <span x-text="totalPages"></span></span>
              <button @click="nextPage()" :disabled="currentPage === totalPages">Próxima</button>
            </div>
          </div>

          <div class="selected-summary" x-show="selectedPeople.length > 0">
            <h4>Cooperados Selecionados (<span x-text="selectedPeople.length"></span>)</h4>
            <div class="selected-list">
              <template x-for="personId in selectedPeople" :key="personId">
                <div class="selected-item">
                  <span x-text="getPersonName(personId)"></span>
                  <button @click="removePerson(personId)" class="remove-btn">×</button>
                </div>
              </template>
            </div>
          </div>
        </div>

        ${this.getSelectorStyles()}
      </div>
    `;
  }

  /**
   * Render list variant
   */
  renderListVariant() {
    const fieldId = `field_${this.id}`;

    return `
  <div class="presence-list-field" id="${fieldId}" x-data="field_${this.id}_data">
        <label class="field-label">${this.escapeHtml(this.label || this.displayName)}</label>
        
        <div class="list-container">
          <div class="list-controls" x-show="filteredParticipants.length > 5">
            <input type="text" 
                   x-model="searchTerm" 
                   placeholder="Buscar participante..." 
                   class="search-input">
          </div>

          <div class="participants-list">
            <template x-for="participant in filteredParticipants" :key="participant.id">
              <div class="participant-row">
                <div class="participant-info">
                  <div class="participant-name" x-text="participant[labelKey]"></div>
                  <div class="participant-details" x-show="participant.galpao">
                    <small x-text="participant.galpao"></small>
                  </div>
                </div>
                <div class="status-controls">
                  <template x-for="status in statusSequence" :key="status">
                    <label class="status-option">
                      <input type="radio" 
                             :name="'status_' + participant.id"
                             :value="status"
                             x-model="statuses[participant.id]">
                      <span class="status-label" 
                            :style="statuses[participant.id] === status ? 'color: ' + (statusColors[status] || '#666') : ''"
                            x-text="statusLabels[status] || status"></span>
                    </label>
                  </template>
                </div>
              </div>
            </template>
          </div>

          <div class="presence-summary" x-show="Object.keys(statuses).length > 0">
            <div class="summary-title">Resumo de Presença</div>
            <div class="summary-stats">
              <template x-for="status in statusSequence" :key="status">
                <div class="stat-item">
                  <span class="stat-label" x-text="statusLabels[status] || status"></span>: 
                  <span class="stat-value" 
                        :style="'color: ' + (statusColors[status] || '#666')"
                        x-text="getStatusCount(status)"></span>
                </div>
              </template>
            </div>
          </div>
        </div>

        ${this.getListStyles()}
      </div>
    `;
  }

  /**
   * Get Alpine.js data for the field
   */
  getAlpineData() {
    switch (this.variant) {
      case 'compact': return this.getCompactAlpineData();
      case 'selector': return this.getSelectorAlpineData();
      case 'list': return this.getListAlpineData();
      default: return this.getListAlpineData();
    }
  }

  /**
   * Get Alpine.js data for compact variant
   */
  getCompactAlpineData() {
    const fieldId = this.config.id;
    const groupField = this.groupField;
    const groupKey = this.groupKey;
    const labelKey = this.participantLabelKey;
    const hideUntilGroup = !!(this.config && this.config.hideUntilGroup);
    const defaultStatus = this.config.defaultStatus || null;
    const statusSequence = this.statusSequence;
    const statusColors = this.statusColors;
    const statusLabels = this.statusLabels;
    const sharedFormData = this.config.formData || this.formData || (typeof window !== 'undefined' ? window.formData : {});

    return {
      participants: this.initialParticipants.slice(),
      statuses: {},
      formData: sharedFormData,
      statusFilter: [], // Array for active status filters
      searchTerm: '',
      statusSequence: statusSequence,
      statusColors: statusColors,
      statusLabels: statusLabels,
      labelKey: labelKey,

      init() {
        this.formData = sharedFormData;
        this.ensureParticipants();
      },

      ensureParticipants() {
        if (!this.participants) return;
        this.participants = this.participants.map(p => ensureId(p));
      },

      get filteredParticipants() {
        let filtered = this.participants || [];
        
        // Filter by group if specified
        if (hideUntilGroup) {
          const groupValue = getGroupValue(this.formData, groupField);
          if (!groupValue || isSentinel(groupValue)) return [];
          filtered = filtered.filter(p => normalizeValue(p[groupKey]) === normalizeValue(groupValue));
        }

        // Filter by search term
        if (this.searchTerm) {
          const term = normalizeValue(this.searchTerm);
          filtered = filtered.filter(p => 
            normalizeValue(p[labelKey]).includes(term) ||
            normalizeValue(p.galpao || '').includes(term)
          );
        }

        // Filter by status
        if (this.statusFilter.length > 0) {
          filtered = filtered.filter(p => 
            this.statusFilter.includes(this.statuses[p.id])
          );
        }

        return filtered;
      },

      toggleStatus(participantId, status) {
        if (this.statuses[participantId] === status) {
          delete this.statuses[participantId];
        } else {
          this.statuses[participantId] = status;
        }
        this.sync();
      },

      toggleStatusFilter(status) {
        const index = this.statusFilter.indexOf(status);
        if (index > -1) {
          this.statusFilter.splice(index, 1);
        } else {
          this.statusFilter = [status]; // Apenas um status ativo por vez
        }
      },

      // Alterna ciclicamente entre os status (como nos arquivos .bak)
      cycleStatus(participantId) {
        const currentStatus = this.statuses[participantId] || (defaultStatus || statusSequence[statusSequence.length - 1]);
        const currentIndex = statusSequence.indexOf(currentStatus);
        const nextIndex = (currentIndex + 1) % statusSequence.length;
        const nextStatus = statusSequence[nextIndex];
        this.statuses[participantId] = nextStatus;
        this.sync();
      },

      // Sincroniza os dados com o formData (como nos arquivos .bak)
      sync() {
        try {
          if (!this.formData) {
            this.formData = (typeof window !== 'undefined' && window.formData) ? window.formData : {};
          }
          this.formData[fieldId] = this.getValue();
        } catch (error) {
          console.error('Erro ao sincronizar dados de presença:', error);
        }
      },

      getStatusCount(status) {
        return Object.values(this.statuses).filter(s => s === status).length;
      },

      statusTextColor(participantId) {
        try {
          const status = this.statuses[participantId] || (defaultStatus || statusSequence[statusSequence.length-1]);
          const color = statusColors[status];
          return color ? contrastColor(color) : '#fff';
        } catch(_) {
          return '';
        }
      },

      getValue() {
        return {
          statuses: this.statuses,
          summary: statusSequence.reduce((acc, status) => {
            acc[status] = this.getStatusCount(status);
            return acc;
          }, {}),
          timestamp: new Date().toISOString()
        };
      },

      setValue(value) {
        if (value && value.statuses) {
          this.statuses = { ...value.statuses };
        }
      }
    };
  }

  /**
   * Get Alpine.js data for selector variant
   */
  getSelectorAlpineData() {
    const fieldId = this.config.id;
    const useSmartFilters = this.useSmartFilters;

    return {
      participants: this.initialParticipants.slice(),
      selectedPeople: [],
      searchTerm: '',
      isLoading: false,
      useSmartFilters: useSmartFilters,
      availableFilters: this.getAvailableFilters(),
      activeFilters: {},
      currentPage: 1,
      itemsPerPage: 20,

      init() {
        this.ensureParticipants();
      },

      ensureParticipants() {
        if (!this.participants) return;
        this.participants = this.participants.map(p => ensureId(p));
      },

      get filteredPeople() {
        let filtered = this.participants || [];
        
        // Filter by activeFilters
        Object.entries(this.activeFilters).forEach(([key, value]) => {
          if (value && value !== '') {
            filtered = filtered.filter(p => normalizeValue(p[key]) === normalizeValue(value));
          }
        });

        // Filter by searchTerm
        if (this.searchTerm) {
          const term = normalizeValue(this.searchTerm);
          filtered = filtered.filter(p => 
            normalizeValue(p.nome || '').includes(term) ||
            normalizeValue(p.galpao || '').includes(term)
          );
        }

        return filtered;
      },

      get paginatedPeople() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.filteredPeople.slice(start, end);
      },

      get totalPages() {
        return Math.ceil(this.filteredPeople.length / this.itemsPerPage);
      },

      togglePerson(personId) {
        const index = this.selectedPeople.indexOf(personId);
        if (index > -1) {
          this.selectedPeople.splice(index, 1);
        } else {
          this.selectedPeople.push(personId);
        }
      },

      removePerson(personId) {
        const index = this.selectedPeople.indexOf(personId);
        if (index > -1) {
          this.selectedPeople.splice(index, 1);
        }
      },

      getPersonName(personId) {
        const person = this.filteredPeople.find(p => p.id === personId);
        return person ? person.nome : 'Desconhecido';
      },

      prevPage() {
        if (this.currentPage > 1) this.currentPage--;
      },

      nextPage() {
        if (this.currentPage < this.totalPages) this.currentPage++;
      },

      getValue() {
        return {
          selectedPeople: this.selectedPeople,
          timestamp: new Date().toISOString()
        };
      },

      setValue(value) {
        if (value && value.selectedPeople) {
          this.selectedPeople = [...value.selectedPeople];
        }
      }
    };
  }

  /**
   * Get Alpine.js data for list variant
   */
  getListAlpineData() {
    const fieldId = this.config.id;
    const groupField = this.groupField;
    const groupKey = this.groupKey;
    const labelKey = this.participantLabelKey;
    const hideUntilGroup = !!(this.config && this.config.hideUntilGroup);
    const defaultStatus = this.defaultStatus;
    const statusColors = this.statusColors;
    const statusSequence = this.statusSequence;
    const statusLabels = this.statusLabels;
    const sharedFormData = this.config.formData || this.formData || (typeof window !== 'undefined' ? window.formData : {});

    return {
      participants: this.initialParticipants.slice(),
      statuses: {},
      formData: sharedFormData,
      searchTerm: '',
      statusSequence: statusSequence,
      statusColors: statusColors,
      statusLabels: statusLabels,
      labelKey: labelKey,

      init() {
        this.formData = sharedFormData;
        this.ensureParticipants();
      },

      ensureParticipants() {
        if (!this.participants) return;
        this.participants = this.participants.map(p => ensureId(p));
      },

      get filteredParticipants() {
        let filtered = this.participants || [];
        
        // Filter by group if specified
        if (hideUntilGroup) {
          const groupValue = getGroupValue(this.formData, groupField);
          if (!groupValue || isSentinel(groupValue)) return [];
          filtered = filtered.filter(p => normalizeValue(p[groupKey]) === normalizeValue(groupValue));
        }

        // Filter by search term
        if (this.searchTerm) {
          const term = normalizeValue(this.searchTerm);
          filtered = filtered.filter(p => 
            normalizeValue(p[labelKey]).includes(term) ||
            normalizeValue(p.galpao || '').includes(term)
          );
        }

        return filtered;
      },

      getStatusCount(status) {
        return Object.values(this.statuses).filter(s => s === status).length;
      },

      statusTextColor(participantId) {
        try {
          const status = this.statuses[participantId] || (defaultStatus || statusSequence[statusSequence.length-1]);
          const color = statusColors[status];
          return color ? contrastColor(color) : '#fff';
        } catch(_) {
          return '';
        }
      },

      getValue() {
        return {
          statuses: this.statuses,
          summary: statusSequence.reduce((acc, status) => {
            acc[status] = this.getStatusCount(status);
            return acc;
          }, {}),
          timestamp: new Date().toISOString()
        };
      },

      setValue(value) {
        if (value && value.statuses) {
          this.statuses = { ...value.statuses };
        }
      }
    };
  }

  /**
   * Get filter system for selector variant
   */
  getFilterSystem() {
    return {
      galpao: {
        label: 'Galpão',
        field: 'galpao',
        type: 'select'
      },
      funcao: {
        label: 'Função',
        field: 'funcao',
        type: 'select'
      },
      status: {
        label: 'Status',
        field: 'status',
        type: 'select'
      }
    };
  }

  /**
   * Get available filters for selector variant
   */
  getAvailableFilters() {
    // This would typically be generated from the data
    return {
      galpao: {
        label: 'Galpão',
        options: [
          { value: 'ACMR', label: 'ACMR' },
          { value: 'Amigos da Natureza', label: 'Amigos da Natureza' },
          { value: 'Aresp', label: 'Aresp' }
        ]
      },
      funcao: {
        label: 'Função',
        options: [
          { value: 'Triador', label: 'Triador' },
          { value: 'Prensista', label: 'Prensista' },
          { value: 'Coordenador', label: 'Coordenador' }
        ]
      }
    };
  }

  /**
   * Initialize presence states for selector variant
   */
  initializePresenceStates(config) {
    return config.presenceStates || {
      presente: { label: 'Presente', color: '#4CAF50', icon: '✓' },
      ausente: { label: 'Ausente', color: '#F44336', icon: '✗' },
      desligado: { label: 'Desligado', color: '#FF9800', icon: '⊘' }
    };
  }

  /**
   * Get compact variant styles
   */
  getCompactStyles() {
    return `
      <style>
        .presence-compact-field {
          margin-bottom: 20px;
        }

        .presence-compact-field .field-label {
          display: block;
          margin-bottom: 12px;
          font-weight: 600;
          color: #333;
        }

        .presence-controls {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
        }

        .filter-controls {
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .status-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .status-chip {
          padding: 6px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 20px;
          background: white;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
          color: #666;
        }

        .status-chip:hover {
          border-color: #667eea;
          background: #f5f7ff;
        }

        .status-chip.active {
          border-color: #667eea;
          background: #667eea;
          color: white;
          font-weight: 600;
        }

        .status-filter {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
        }

        .participants-grid {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
        }

        .participants-grid.columns-1 {
          grid-template-columns: 1fr;
        }

        .participants-grid.columns-2 {
          grid-template-columns: repeat(2, 1fr);
        }

        .participant-item {
          background: #fafafa;
          border: 1px solid #e8e8e8;
          border-radius: 6px;
          padding: 12px;
        }

        .participant-name {
          font-weight: 500;
          margin-bottom: 8px;
          color: #333;
        }

        .status-buttons {
          display: flex;
          gap: 6px;
        }

        .status-btn {
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .status-btn:hover {
          border-color: #999;
        }

        .status-btn.active {
          font-weight: 600;
        }

        .presence-summary {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 12px;
        }

        .summary-stats {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .stat-item {
          font-size: 14px;
          font-weight: 500;
        }
      </style>
    `;
  }

  /**
   * Get selector variant styles
   */
  getSelectorStyles() {
    return `
      <style>
        .presence-selector-compact-field {
          margin-bottom: 20px;
        }

        .presence-selector-compact-field .field-label {
          display: block;
          margin-bottom: 12px;
          font-weight: 600;
          color: #333;
        }

        .selector-container {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }

        .smart-filters {
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
          padding: 16px;
        }

        .filter-section h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #333;
        }

        .filter-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .filter-option label {
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
          font-weight: 500;
          color: #555;
        }

        .filter-option select {
          width: 100%;
          padding: 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .people-selection {
          padding: 16px;
        }

        .search-section {
          margin-bottom: 16px;
        }

        .search-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }

        .search-stats {
          margin-top: 8px;
          font-size: 14px;
          color: #666;
        }

        .people-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .person-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .person-card:hover {
          border-color: #2196f3;
          background: #f8f9ff;
        }

        .person-card.selected {
          border-color: #4CAF50;
          background: #e8f5e8;
        }

        .person-info {
          flex: 1;
        }

        .person-name {
          font-weight: 500;
          margin-bottom: 4px;
          color: #333;
        }

        .person-details {
          font-size: 12px;
          color: #666;
          display: flex;
          gap: 8px;
        }

        .selection-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #ddd;
          transition: all 0.2s;
        }

        .person-card.selected .selection-indicator {
          background: #4CAF50;
          border-color: #4CAF50;
          color: white;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 16px;
        }

        .pagination button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
        }

        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .selected-summary {
          background: #f8f9fa;
          border-top: 1px solid #e0e0e0;
          padding: 16px;
        }

        .selected-summary h4 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #333;
        }

        .selected-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .selected-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 16px;
          padding: 4px 12px;
          font-size: 14px;
        }

        .remove-btn {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
        }

        .remove-btn:hover {
          color: #F44336;
        }
      </style>
    `;
  }

  /**
   * Get list variant styles
   */
  getListStyles() {
    return `
      <style>
        .presence-list-field {
          margin-bottom: 20px;
        }

        .presence-list-field .field-label {
          display: block;
          margin-bottom: 12px;
          font-weight: 600;
          color: #333;
        }

        .list-container {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
        }

        .list-controls {
          margin-bottom: 16px;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .participants-list {
          margin-bottom: 16px;
        }

        .participant-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          border-bottom: 1px solid #f0f0f0;
        }

        .participant-row:last-child {
          border-bottom: none;
        }

        .participant-info {
          flex: 1;
        }

        .participant-name {
          font-weight: 500;
          margin-bottom: 4px;
          color: #333;
        }

        .participant-details {
          font-size: 12px;
          color: #666;
        }

        .status-controls {
          display: flex;
          gap: 12px;
        }

        .status-option {
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .status-option input[type="radio"] {
          margin: 0;
        }

        .status-label {
          font-weight: 500;
        }

        .presence-summary {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 12px;
        }

        .summary-title {
          font-weight: 600;
          margin-bottom: 8px;
          color: #333;
        }

        .summary-stats {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 14px;
        }

        .stat-label {
          color: #666;
        }

        .stat-value {
          font-weight: 600;
        }
      </style>
    `;
  }

  /**
   * Get field value - unified method for all variants
   */
  getValue() {
    const alpineData = this.getAlpineData();
    return alpineData.getValue ? alpineData.getValue() : null;
  }

  /**
   * Set field value - unified method for all variants
   */
  setValue(value) {
    const alpineData = this.getAlpineData();
    if (alpineData.setValue) {
      alpineData.setValue(value);
    }
  }
}

export default PresenceField;