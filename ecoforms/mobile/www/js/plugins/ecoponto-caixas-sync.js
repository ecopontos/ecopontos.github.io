'use strict';

(function () {
  class EcopontoCaixasSync {
    constructor(options = {}) {
      this.options = { ...options };
      this.storageKey = options.storageKey || 'ecoforms.ecopontoCaixasSync.v1';
      this.storage = this.loadStorage();
      this.flushTimeout = null;
      this.statusElement = null;
      this.currentKey = null;
      this.currentLabel = null;
      this.dataService = options.dataService || null;
      this.dataServiceReady = false;
      this.initialized = false;
      this.boundFieldChange = this.handleFieldChange.bind(this);
      this.boundOnline = this.handleOnline.bind(this);
      this.boundBeforeUnload = this.handleBeforeUnload.bind(this);
      this.deviceInfo = this.loadDeviceInfo();
      this.userInfo = this.getCurrentUser();
      this.maxPendingEvents = options.maxPendingEvents || 50;
      this.flushDelay = typeof options.flushDebounce === 'number' ? options.flushDebounce : 1500;
      this.lastStatus = null;
    }

    init() {
      if (this.initialized) {
        return;
      }

      window.addEventListener('ecoponto-caixas:change', this.boundFieldChange);
      window.addEventListener('online', this.boundOnline);
      window.addEventListener('beforeunload', this.boundBeforeUnload);
      this.initialized = true;
  this.updateStatus('Sincronizacao incremental pronta.', 'info');
    }

    destroy() {
      if (!this.initialized) {
        return;
      }

      window.removeEventListener('ecoponto-caixas:change', this.boundFieldChange);
      window.removeEventListener('online', this.boundOnline);
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      if (this.flushTimeout) {
        clearTimeout(this.flushTimeout);
        this.flushTimeout = null;
      }
      this.initialized = false;
    }

    updateOptions(options = {}) {
      this.options = { ...this.options, ...options };
      if (options.dataService) {
        this.dataService = options.dataService;
      }
    }

    handleEcopontoChange(rawValue, metadata = null) {
      const normalized = this.normalizeKey(rawValue);
      this.currentKey = normalized;
      this.currentLabel = metadata?.label || metadata?.nome || metadata?.value || normalized || '';
 
      if (!normalized) {
  this.updateStatus('Selecione um ecoponto para registrar ocupacoes.', 'muted');
        this.resetFieldInstance();
        return;
      }
 
      const draft = this.ensureDraft(normalized, {
        label: this.currentLabel,
        rawValue
      });

      // --- INTEGRACAO SNAPSHOT ---
      // Se houver um estado injetado via Snapshot (Task-as-a-Unit), usamos como base prioritária
      const formData = this.getFormData();
      const snapState = formData?._snapshot_state;
      
      if (snapState && (snapState.ecoponto_id === normalized || !snapState.ecoponto_id)) {
        console.log('📦 [Snap] Aplicando estado vindo do Snapshot para:', normalized);
        draft.ocupacao = { ...snapState.ocupacao };
        draft.removidas = { ...snapState.removidas };
        draft.pending = false; // Estado oficial vindo do snap
        this.persist();
      }
      // ---------------------------
 
      if (draft && draft.ocupacao && Object.keys(draft.ocupacao).length) {
        this.applyDraftToField(draft);
        this.updateStatus(draft.pending ? `Alterações pendentes para ${draft.label || normalized}.` : `Estado restaurado para ${draft.label || normalized}.`, draft.pending ? 'warning' : 'success');
      } else {
        this.resetFieldInstance();
        this.updateStatus(`Pronto para registrar dados do ecoponto ${this.currentLabel || normalized}.`, 'info');
      }
 
      // Fallback: Atualizar campo com base nos dados do banco (legado/incremental)
      // Se o snap já forneceu os dados, o updateFromDatabase deve ser inteligente para não sobrescrever
      this.updateFieldFromDatabase(normalized);
    }

    handleFieldChange(event) {
      const detail = event?.detail;
      if (!detail || !detail.fieldId || detail.fieldId !== this.options.fieldId) {
        return;
      }

      const formData = this.getFormData();
      const rawEcoponto = detail.ecopontoValue !== undefined ? detail.ecopontoValue : formData?.[this.options.ecopontoFieldId];
      const normalizedKey = this.normalizeKey(rawEcoponto || this.currentKey);

      if (!normalizedKey) {
        return;
      }

      const metadata = this.getEcopontoMetadata(rawEcoponto);
      const draft = this.ensureDraft(normalizedKey, {
        label: metadata?.label || this.currentLabel || normalizedKey,
        rawValue: rawEcoponto
      });

      this.userInfo = this.getCurrentUser();
      const state = this.extractState(detail);
      draft.ocupacao = { ...state.ocupacao };
      draft.removidas = { ...state.removidas };
      draft.lastUpdated = state.timestamp;
      draft.pending = true;
      draft.version = (draft.version || 0) + 1;

      this.appendEvent(draft, detail, state);
      this.persist();
  this.updateStatus(`Alteracao registrada para ${draft.label || normalizedKey}.`, 'warning');
      this.scheduleFlush();
    }

    handleOnline() {
  this.updateStatus('Conexao restaurada. Sincronizando pendencias...', 'info');
      this.flushPending(true).catch((error) => {
        console.warn('EcopontoCaixasSync flush error:', error);
      });
    }

    handleBeforeUnload() {
      this.persist();
    }

    handleFormSubmission(submissionData) {
      if (!this.currentKey) {
        return;
      }
      const draft = this.storage.drafts[this.currentKey];
      if (!draft) {
        return;
      }
      draft.lastSubmittedAt = new Date().toISOString();
      if (submissionData && submissionData.data && submissionData.data.caixas_list) {
        draft.ocupacao = { ...submissionData.data.caixas_list.ocupacao };
        draft.removidas = { ...submissionData.data.caixas_list.removidas };
      }
      draft.pending = draft.pendingEvents?.some((evt) => !evt.syncedAt) || false;
      this.persist();
    }

    handleFormCleared() {
      if (!this.currentKey) {
        return;
      }
      const draft = this.storage.drafts[this.currentKey];
      if (draft) {
        draft.pending = draft.pendingEvents?.some((evt) => !evt.syncedAt) || false;
        this.persist();
      }
    }
 
    /**
     * Atualiza o campo com base nos dados mais recentes do banco de dados
     * @param {string} ecopontoId - ID do ecoponto
     */
    async updateFieldFromDatabase(ecopontoId) {
      if (!ecopontoId) {
        console.warn('⚠️ ID do ecoponto não fornecido para atualização do banco de dados');
        return;
      }
 
      try {
        const field = this.getFieldInstance();
        if (!field || typeof field.updateFromDatabase !== 'function') {
          console.warn('⚠️ Campo não encontrado ou método updateFromDatabase não disponível');
          return;
        }
 
        console.log(`🔄 Atualizando campo do ecoponto ${ecopontoId} com dados do banco...`);
        
        const result = await field.updateFromDatabase(ecopontoId);
        
        if (result.success) {
          this.updateStatus(`✅ Dados atualizados do banco para ${this.currentLabel || ecopontoId}`, 'success');
        } else {
          console.warn('⚠️ Falha na atualização do banco:', result.message);
          this.updateStatus(`⚠️ Atualização do banco falhou: ${result.message}`, 'warning');
        }
      } catch (error) {
        console.error('❌ Erro ao atualizar campo do banco:', error);
        this.updateStatus(`❌ Erro na atualização do banco: ${error.message}`, 'error');
      }
    }

    async flushPending(force = false) {
      if (!force && !navigator.onLine) {
        return;
      }

      const dataService = await this.ensureDataService();
      if (!dataService) {
        return;
      }

      const drafts = this.storage.drafts || {};
      for (const key of Object.keys(drafts)) {
        const draft = drafts[key];
        if (!draft.pendingEvents || !draft.pendingEvents.length) {
          continue;
        }

        for (const event of draft.pendingEvents) {
          if (event.syncedAt) {
            continue;
          }

          try {
            const submission = this.buildSubmission(draft, event);
            const recordId = await dataService.saveFormData(submission);
            event.localRecordId = recordId;
            event.syncedAt = new Date().toISOString();
            event.lastError = null;
            event.attempts = (event.attempts || 0) + 1;
            this.updateStatus(`Evento sincronizado para ${draft.label || key}.`, 'success');
          } catch (error) {
            event.lastError = error?.message || String(error);
            event.attempts = (event.attempts || 0) + 1;
            this.updateStatus(`Erro ao sincronizar ${draft.label || key}: ${event.lastError}`, 'error');
            break;
          }
        }

        draft.pending = draft.pendingEvents.some((pendingEvent) => !pendingEvent.syncedAt);
      }

      this.persist();
    }

    scheduleFlush() {
      if (this.flushTimeout) {
        clearTimeout(this.flushTimeout);
      }
      this.flushTimeout = setTimeout(() => {
        this.flushTimeout = null;
        this.flushPending().catch((error) => {
          console.warn('EcopontoCaixasSync flush error:', error);
        });
      }, this.flushDelay);
    }

    ensureDraft(key, meta = {}) {
      if (!this.storage.drafts[key]) {
        this.storage.drafts[key] = {
          key,
          label: meta.label || key,
          rawValue: meta.rawValue || key,
          ocupacao: {},
          removidas: {},
          pending: false,
          pendingEvents: [],
          history: [],
          createdAt: new Date().toISOString(),
          lastUpdated: null,
          version: 0
        };
      } else if (meta.label && this.storage.drafts[key].label !== meta.label) {
        this.storage.drafts[key].label = meta.label;
      }
      return this.storage.drafts[key];
    }

    appendEvent(draft, detail, state) {
      draft.pendingEvents = draft.pendingEvents || [];
      const event = {
        id: this.generateId(),
        action: detail.action || 'update',
        caixaId: detail.caixaId ?? detail.actionDetail?.caixaId ?? null,
        level: detail.actionDetail?.level ?? detail.actionDetail?.nivel ?? null,
        removed: detail.actionDetail?.removed ?? false,
        timestamp: state.timestamp,
        snapshot: {
          ocupacao: { ...state.ocupacao },
          removidas: { ...state.removidas },
          resumo: state.resumo
        },
        submitData: detail.submitData || null,
        meta: {
          userId: this.userInfo?.id || null,
          userName: this.userInfo?.nome || null,
          deviceId: this.deviceInfo?.deviceId || null,
          ecopontoKey: draft.key
        },
        localRecordId: null,
        syncedAt: null,
        attempts: 0,
        lastError: null
      };

      draft.pendingEvents.push(event);
      draft.history.push({ ...event, historyId: this.generateId(), recordedAt: new Date().toISOString() });
      if (draft.pendingEvents.length > this.maxPendingEvents) {
        draft.pendingEvents.shift();
      }
      if (draft.history.length > this.maxPendingEvents * 4) {
        draft.history.splice(0, draft.history.length - this.maxPendingEvents * 4);
      }
    }

    applyDraftToField(draft) {
      const field = this.getFieldInstance();
      if (!field || typeof field.setValue !== 'function') {
        return;
      }
      const payload = {
        ocupacao: { ...draft.ocupacao },
        removidas: { ...draft.removidas }
      };
      try {
        field.setValue(payload, { silent: true, reason: 'draft-restore' });
        if (typeof field.refreshDom === 'function') {
          field.refreshDom();
        }
      } catch (error) {
        console.warn('EcopontoCaixasSync applyDraftToField error:', error);
      }
    }

    resetFieldInstance() {
      const field = this.getFieldInstance();
      if (!field) {
        return;
      }
      try {
        if (typeof field.resetAll === 'function') {
          field.resetAll();
        } else {
          field.setValue({ ocupacao: {}, removidas: {} }, { silent: true, reason: 'draft-reset' });
        }
        if (typeof field.refreshDom === 'function') {
          field.refreshDom();
        }
      } catch (error) {
        console.warn('EcopontoCaixasSync resetFieldInstance error:', error);
      }
    }

    extractState(detail) {
      const base = detail?.value || detail?.snapshot || {};
      const ocupacao = base.ocupacao ? { ...base.ocupacao } : {};
      const removidas = base.removidas ? { ...base.removidas } : {};
      const summary = detail?.submitData?.resumo || base.resumo || this.computeSummary(ocupacao, removidas);
      const timestamp = base.timestamp || detail?.timestamp || new Date().toISOString();

      return {
        ocupacao,
        removidas,
        resumo: summary,
        timestamp
      };
    }

    computeSummary(ocupacao = {}, removidas = {}) {
      const field = this.getFieldInstance();
      const caixas = Array.isArray(field?.caixas) ? field.caixas : [];
      const total = caixas.length || Object.keys(ocupacao).length;
      let caixasCriticas = 0;
      let preenchidas = 0;

      caixas.forEach((caixa) => {
        const key = caixa.id;
        const nivel = Number(ocupacao[key] || 0);
        if (ocupacao[key] !== undefined && ocupacao[key] !== '') {
          preenchidas += 1;
        }
        if (!removidas[key] && nivel >= 75) {
          caixasCriticas += 1;
        }
      });

      const removidasCount = Object.values(removidas).filter(Boolean).length;

      return {
        total_caixas: total,
        caixas_removidas: removidasCount,
        caixas_criticas: caixasCriticas,
        caixas_preenchidas: preenchidas
      };
    }

    buildSubmission(draft, event) {
      const submissionTimestamp = event.timestamp || new Date().toISOString();
      const field = this.getFieldInstance();
      const formTitle = this.options.formTitle || 'Caixas de Ecoponto (incremental)';

      return {
        formId: this.options.formId || 'ecopontoCaixasForm',
        formTitle,
        tipo_form: this.options.formId || 'ecopontoCaixasForm',
        incremental: true,
        incrementalSource: 'EcopontoCaixasSync',
        submittedAt: submissionTimestamp,
        userId: this.userInfo?.id || 'anonymous',
        usuario: this.userInfo?.nome || 'Usuário',
        deviceId: this.deviceInfo?.deviceId || null,
        data: {
          ecoponto: draft.key,
          ecopontoLabel: draft.label || draft.key,
          caixas_list: {
            ocupacao: { ...event.snapshot.ocupacao },
            removidas: { ...event.snapshot.removidas },
            resumo: event.snapshot.resumo || this.computeSummary(event.snapshot.ocupacao, event.snapshot.removidas),
            incrementalEvento: {
              id: event.id,
              action: event.action,
              caixaId: event.caixaId,
              nivel: event.level,
              removed: event.removed,
              timestamp: submissionTimestamp
            },
            origem: 'incremental-sync'
          },
          incrementalEvento: {
            id: event.id,
            action: event.action,
            caixaId: event.caixaId,
            nivel: event.level,
            removed: event.removed,
            timestamp: submissionTimestamp
          },
          meta: {
            deviceId: this.deviceInfo?.deviceId || null,
            deviceName: this.deviceInfo?.deviceName || null,
            fieldLabel: field?.config?.label || null
          }
        }
      };
    }

    async ensureDataService() {
      if (!this.dataService) {
        this.dataService = this.options.dataService || window.dataService || null;
      }
      if (!this.dataService) {
        return null;
      }
      if (this.dataServiceReady) {
        return this.dataService;
      }
      if (typeof this.dataService.init === 'function') {
        try {
          await this.dataService.init();
        } catch (error) {
          console.warn('EcopontoCaixasSync dataService init failed:', error);
          return null;
        }
      }
      this.dataServiceReady = true;
      return this.dataService;
    }

    getFieldInstance() {
      if (typeof this.options.getFieldInstance === 'function') {
        return this.options.getFieldInstance();
      }
      if (typeof window !== 'undefined' && window.fieldInstances) {
        return window.fieldInstances[this.options.fieldId];
      }
      return null;
    }

    getFormData() {
      if (typeof this.options.getFormData === 'function') {
        return this.options.getFormData();
      }
      if (typeof window !== 'undefined') {
        return window.formData || {};
      }
      return {};
    }

    getEcopontoMetadata(rawValue) {
      if (typeof this.options.getEcopontoMetadata === 'function') {
        return this.options.getEcopontoMetadata(rawValue);
      }
      if (rawValue === null || rawValue === undefined) {
        return null;
      }
      const normalized = this.normalizeKey(rawValue);
      return normalized ? { value: normalized, label: normalized, raw: rawValue } : null;
    }

    normalizeKey(value) {
      if (value === null || value === undefined) {
        return null;
      }
      if (typeof value === 'object') {
        const candidates = [value.ecoponto_id, value.id, value.codigo, value.value, value.nome, value.label];
        const found = candidates.find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim() !== '');
        if (found !== undefined && found !== null) {
          return String(found).trim();
        }
        try {
          return JSON.stringify(value);
        } catch (_) {
          return null;
        }
      }
      const str = String(value).trim();
      return str ? str : null;
    }

    /**
     * Carrega estado do IndexedDB (preferido) ou localStorage (fallback).
     * Fase 5: Migração de localStorage para IndexedDB para maior robustez.
     */
    loadStorage() {
      // Tentar localStorage primeiro (modo legado / fallback)
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.drafts) {
            return parsed;
          }
        }
      } catch (error) {
        console.warn('EcopontoCaixasSync loadStorage (localStorage) error:', error);
      }
      return { version: 2, drafts: {}, meta: { createdAt: new Date().toISOString() } };
    }

    /**
     * Persiste estado no localStorage (fallback) e tenta IndexedDB via DataService.
     * Fase 5: IndexedDB como destino principal quando disponível.
     */
    async persist() {
      try {
        this.storage.meta = this.storage.meta || {};
        this.storage.meta.lastPersistedAt = new Date().toISOString();

        // 1. Tentar salvar no IndexedDB via DataService (não bloqueante)
        const ds = await this.ensureDataService();
        if (ds && typeof ds.saveFormData === 'function') {
          try {
            await ds.saveFormData({
              formId: 'ecopontoCaixasSync_internal',
              tipo_form: 'ecopontoCaixasSync_internal',
              data: { _sync_state: this.storage },
              syncStatus: 'synced',
              uuid: this.storageKey
            });
          } catch (idbErr) {
            console.warn('EcopontoCaixasSync persist IndexedDB failed, falling back to localStorage:', idbErr);
          }
        }

        // 2. Sempre salvar no localStorage como fallback / backup
        localStorage.setItem(this.storageKey, JSON.stringify(this.storage));
      } catch (error) {
        console.warn('EcopontoCaixasSync persist error:', error);
      }
    }

    loadDeviceInfo() {
      try {
        const raw = localStorage.getItem('ecoforms_device_config');
        if (!raw) {
          return {};
        }
        const parsed = JSON.parse(raw);
        return {
          deviceId: parsed.deviceId || parsed.device_id || null,
          deviceName: parsed.deviceName || parsed.nome_dispositivo || null
        };
      } catch (error) {
        console.warn('EcopontoCaixasSync loadDeviceInfo error:', error);
        return {};
      }
    }

    getCurrentUser() {
      try {
        if (typeof window !== 'undefined' && window.authManager && typeof window.authManager.getCurrentUser === 'function') {
          return window.authManager.getCurrentUser();
        }
      } catch (error) {
        console.warn('EcopontoCaixasSync getCurrentUser error:', error);
      }
      return null;
    }

    ensureStatusElement() {
      if (this.statusElement && document.body.contains(this.statusElement)) {
        return this.statusElement;
      }
      const container = document.querySelector(`[data-field-id="${this.options.fieldId}"]`);
      if (!container) {
        return null;
      }
      let element = container.querySelector('.ecoponto-caixas-sync-status');
      if (!element) {
        element = document.createElement('div');
        element.className = 'ecoponto-caixas-sync-status';
        element.style.marginTop = '6px';
        element.style.fontSize = '12px';
        element.style.lineHeight = '1.5';
        element.style.color = '#2563eb';
        container.appendChild(element);
      }
      this.statusElement = element;
      return element;
    }

    updateStatus(message, variant = 'info') {
      if (!message || message === this.lastStatus) {
        return;
      }
      const element = this.ensureStatusElement();
      if (!element) {
        return;
      }
      const palette = {
        success: '#15803d',
        warning: '#b45309',
        error: '#b91c1c',
        info: '#2563eb',
        muted: '#6b7280'
      };
      element.textContent = message;
      element.style.color = palette[variant] || palette.info;
      element.dataset.variant = variant;
      this.lastStatus = message;
    }

    generateId() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'evt-' + Math.random().toString(36).slice(2, 12);
    }
  }

  window.EcopontoCaixasSync = EcopontoCaixasSync;
})();
