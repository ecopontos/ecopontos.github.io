/**
 * System Configuration Service
 * Centraliza configurações do sistema para aplicativo mobile
 * Gerencia sincronização, formulários e autenticação
 */

class SystemConfig {
    constructor() {
        this.config = {
            // Versão do sistema para tracking de mudanças
            version: '1.0.0',

            // Configurações de sincronização
            sync: {
                autoSync: true,
                syncInterval: 300000, // 5 minutos
                lastSync: null,
                pendingChanges: [],
                // Eventos de sistema
                system_events: [],
                max_events: 100,
                // Metadados de sincronização
                sync_metadata: {
                    last_sync: null,
                    sync_status: 'pending', // 'pending', 'in_progress', 'completed', 'failed'
                    sync_errors: [],
                    forms_updated: [],
                    data_updated: [],
                    sync_duration: 0,
                    retry_count: 0,
                    max_retries: 3
                }
            },

            // Metadados de formulários (para versionamento)
            forms: {
                version: '1.0.0',
                lastUpdate: null,
                checksum: null,
                source: 'local', // 'local', 'supabase'
                preferredSource: 'auto' // 'auto', 'local_only', 'supabase_first'
            },

            // Metadados de dados do sistema
            data: {
                version: '1.0.0',
                lastUpdate: null,
                checksum: null,
                source: 'local'
            },

            // Configurações de notificação de mudanças
            notifications: {
                enabled: true,
                changeLog: []
            },

            // Configurações de autenticação
            auth: {
                sessionTimeoutHours: 8, // Tempo de expiração da sessão em horas
                autoLogout: true, // Logout automático quando expirar
                rememberLogin: true // Lembrar login entre sessões
            },

            // Modo de operação
            mode: {
                managementMode: 'traditional', // Modo padrão de operação
                allowLocalEdits: true, // Permitir edições locais
                fallbackEnabled: true
            }
        };

        this.init();
    }

    init() {
        // Carregar configurações salvas
        const savedConfig = localStorage.getItem('ecoforms_system_config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsed };
            } catch (e) {
                console.warn('Erro ao carregar configuração salva:', e);
            }
        }

        // Salvar config inicial
        this.save();

        console.log('⚙️ SystemConfig inicializado:', this.config);
    }

    save() {
        localStorage.setItem('ecoforms_system_config', JSON.stringify(this.config));
    }

    // Métodos de versionamento
    getVersion() {
        return this.config.version;
    }

    updateVersion(newVersion) {
        this.config.version = newVersion;
        this.save();
    }

    // Métodos auxiliares
    generateTimestamp() {
        return new Date().toISOString();
    }

    // Registrar evento no sistema
    recordEvent(eventType, data = {}) {
        const event = {
            timestamp: this.generateTimestamp(),
            type: eventType,
            data: data
        };

        this.config.sync.system_events.unshift(event);

        // Limitar número de eventos
        if (this.config.sync.system_events.length > this.config.sync.max_events) {
            this.config.sync.system_events = this.config.sync.system_events.slice(0, this.config.sync.max_events);
        }

        console.log(`[SystemConfig] Event: ${eventType}`, data);
    }

    // Métodos de sincronização
    startSync() {
        this.config.sync.sync_metadata.sync_status = 'in_progress';
        this.config.sync.sync_metadata.sync_start_time = Date.now();
        this.config.sync.sync_metadata.forms_updated = [];
        this.config.sync.sync_metadata.data_updated = [];
        this.config.sync.sync_metadata.sync_errors = [];
        this.recordEvent('sync_started');
    }

    completeSync(success = true, errors = []) {
        const duration = Date.now() - (this.config.sync.sync_metadata.sync_start_time || Date.now());
        this.config.sync.sync_metadata.sync_duration = duration;
        this.config.sync.sync_metadata.last_sync = this.generateTimestamp();
        this.config.sync.sync_metadata.sync_status = success ? 'completed' : 'failed';
        this.config.sync.sync_metadata.sync_errors = errors;

        if (success) {
            this.recordEvent('sync_completed', {
                duration: duration,
                forms_updated: this.config.sync.sync_metadata.forms_updated.length,
                data_updated: this.config.sync.sync_metadata.data_updated.length
            });
        } else {
            this.recordEvent('sync_failed', {
                duration: duration,
                errors: errors
            });
        }
        this.save();
    }

    addFormToSync(formId, version) {
        this.config.sync.sync_metadata.forms_updated.push({
            id: formId,
            version: version,
            timestamp: this.generateTimestamp()
        });
    }

    addDataToSync(dataId, type) {
        this.config.sync.sync_metadata.data_updated.push({
            id: dataId,
            type: type,
            timestamp: this.generateTimestamp()
        });
    }

    addSyncError(error, context = '') {
        this.config.sync.sync_metadata.sync_errors.push({
            error: error.toString(),
            context: context,
            timestamp: this.generateTimestamp()
        });
    }

    getSyncStatus() {
        return {
            status: this.config.sync.sync_metadata.sync_status,
            last_sync: this.config.sync.sync_metadata.last_sync,
            duration: this.config.sync.sync_metadata.sync_duration,
            forms_updated: this.config.sync.sync_metadata.forms_updated.length,
            data_updated: this.config.sync.sync_metadata.data_updated.length,
            errors: this.config.sync.sync_metadata.sync_errors.length,
            lastSync: this.config.sync.lastSync,
            pendingChanges: this.config.sync.pendingChanges.length,
            autoSync: this.config.sync.autoSync
        };
    }

    setLastSync(timestamp = new Date().toISOString()) {
        this.config.sync.lastSync = timestamp;
        this.save();
    }

    addPendingChange(change) {
        this.config.sync.pendingChanges.push({
            ...change,
            timestamp: new Date().toISOString(),
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        });
        this.save();
    }

    clearPendingChanges() {
        this.config.sync.pendingChanges = [];
        this.save();
    }

    // Métodos de formulários
    getFormsMetadata() {
        return { ...this.config.forms };
    }

    updateFormsMetadata(metadata) {
        this.config.forms = { ...this.config.forms, ...metadata };
        this.save();
    }

    setFormSourcePreference(preference) {
        const allowed = ['auto', 'local_only', 'supabase_first'];
        if (!allowed.includes(preference)) {
            console.warn('[SystemConfig] Preferência de origem de formulários inválida:', preference);
            return false;
        }

        this.config.forms.preferredSource = preference;
        this.save();

        this.recordEvent('forms_source_preference_updated', { preference });
        return true;
    }

    getFormSourcePreference() {
        return this.config.forms.preferredSource || 'auto';
    }

    // Métodos de dados do sistema
    getDataMetadata() {
        return { ...this.config.data };
    }

    updateDataMetadata(metadata) {
        this.config.data = { ...this.config.data, ...metadata };
        this.save();
    }

    // Métodos de notificação
    addChangeLog(entry) {
        this.config.notifications.changeLog.unshift({
            ...entry,
            timestamp: new Date().toISOString(),
            id: Date.now()
        });

        // Manter apenas últimas 50 entradas
        if (this.config.notifications.changeLog.length > 50) {
            this.config.notifications.changeLog = this.config.notifications.changeLog.slice(0, 50);
        }

        this.save();
    }

    getChangeLog(limit = 10) {
        return this.config.notifications.changeLog.slice(0, limit);
    }

    // Métodos de autenticação
    getAuthConfig() {
        return { ...this.config.auth };
    }

    setSessionTimeoutHours(hours) {
        if (typeof hours === 'number' && hours > 0 && hours <= 168) { // Máximo 1 semana
            this.config.auth.sessionTimeoutHours = hours;
            this.save();
            this.recordEvent('auth_config_updated', { sessionTimeoutHours: hours });
            return true;
        }
        console.warn('[SystemConfig] Tempo de expiração inválido:', hours);
        return false;
    }

    getSessionTimeoutHours() {
        return this.config.auth.sessionTimeoutHours;
    }

    getSessionTimeoutMs() {
        return this.config.auth.sessionTimeoutHours * 60 * 60 * 1000;
    }

    setAutoLogout(enabled) {
        this.config.auth.autoLogout = !!enabled;
        this.save();
        this.recordEvent('auth_config_updated', { autoLogout: enabled });
    }

    getAutoLogout() {
        return this.config.auth.autoLogout;
    }

    setRememberLogin(enabled) {
        this.config.auth.rememberLogin = !!enabled;
        this.save();
        this.recordEvent('auth_config_updated', { rememberLogin: enabled });
    }

    getRememberLogin() {
        return this.config.auth.rememberLogin;
    }

    // Métodos de modo de operação
    setManagementMode(mode) {
        if (mode === 'traditional') {
            this.config.mode.managementMode = mode;
            this.save();
        }
    }

    getManagementMode() {
        return this.config.mode.managementMode;
    }

    // Reset para modo tradicional (útil durante desenvolvimento)
    resetToTraditional() {
        this.config.mode.managementMode = 'traditional';
        this.config.mode.allowLocalEdits = true;
        this.addChangeLog({
            type: 'system',
            action: 'traditional_mode_restored',
            description: 'Sistema voltado ao modo tradicional'
        });
        this.save();

        console.log('Sistema voltado ao modo tradicional');
    }

    // Métodos para integração com SmartCache
    getFormVersion(formId) {
        // Retorna a versão do formulário ou null se não encontrado
        const formMetadata = this.config.forms[formId];
        return formMetadata ? formMetadata.version : null;
    }

    recordSyncEvent(eventType, eventData) {
        // Registra eventos de sincronização
        const event = {
            type: eventType,
            data: eventData,
            timestamp: new Date().toISOString(),
            id: Date.now() + Math.random()
        };

        // Adiciona ao array de eventos do sistema
        this.config.sync.system_events.push(event);

        // Mantém apenas os últimos eventos (limite configurável)
        if (this.config.sync.system_events.length > this.config.sync.max_events) {
            this.config.sync.system_events = this.config.sync.system_events.slice(-this.config.sync.max_events);
        }

        // Salva as alterações
        this.save();

        console.log(`📊 Evento registrado: ${eventType}`, eventData);
    }

    // Método para rastrear versões de formulários
    trackFormVersion(formId, version, source) {
        // Inicializar estrutura se não existir
        if (!this.config.forms.versions) {
            this.config.forms.versions = {};
        }

        if (!this.config.forms.versions[formId]) {
            this.config.forms.versions[formId] = {
                current_version: null,
                last_updated: null,
                sources: {}
            };
        }

        // Atualizar versão e fonte
        this.config.forms.versions[formId].current_version = version;
        this.config.forms.versions[formId].last_updated = new Date().toISOString();
        this.config.forms.versions[formId].sources[source] = {
            version: version,
            timestamp: new Date().toISOString()
        };

        // Salvar alterações
        this.save();

        console.log(`📋 Versão do formulário ${formId} rastreada: ${version} (fonte: ${source})`);
    }
    // Verificação de atualização remota
    async checkRemoteVersion() {
        console.log('🔄 Verificando atualizações remotas...');
        try {
            // Usar cliente global se disponível
            const client = window.globalSupabaseClient;
            if (!client) {
                console.warn('⚠️ Supabase client não disponível para verificar atualizações');
                return;
            }

            const { data, error } = await client
                .storage
                .from('sync-bucket')
                .download('shared/app-version.json');

            if (error) {
                console.warn('⚠️ Erro ao verificar atualização:', error.message);
                return;
            }

            const text = await data.text();
            const remoteInfo = JSON.parse(text);

            if (this.isNewerVersion(remoteInfo.version, this.config.version)) {
                console.log(`🚀 Nova versão disponível: ${remoteInfo.version}`);

                // Disparar evento global
                window.dispatchEvent(new CustomEvent('system_update_available', {
                    detail: remoteInfo
                }));

                return remoteInfo;
            } else {
                console.log('✅ O aplicativo está atualizado');
            }

        } catch (e) {
            console.error('❌ Falha na verificação de atualização:', e);
        }
    }

    // Helper para comparar versões (ex: 1.0.1 > 1.0.0)
    isNewerVersion(remote, local) {
        if (!remote || !local) return false;
        const v1 = remote.split('.').map(Number);
        const v2 = local.split('.').map(Number);

        for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
            const n1 = v1[i] || 0;
            const n2 = v2[i] || 0;
            if (n1 > n2) return true;
            if (n1 < n2) return false;
        }
        return false;
    }
}

// Instância global
window.systemConfig = new SystemConfig();