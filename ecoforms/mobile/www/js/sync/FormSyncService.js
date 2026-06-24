class FormSyncService {
    constructor(store) {
        this.store = store;
        this.supabaseUrl = null;
        this.supabaseKey = null;
        this.supabaseClient = null;
        this.tableName = 'suite';
        this.userId = '00000000-0000-0000-0000-000000000000';
        this._syncLock = { isSyncing: false, queue: [] };
        this._realtimeChannel = null;
        this._realtimeSubscribed = false;
    }

    configureSupabase(url, key, userId = null) {
        this.supabaseUrl = url;
        this.supabaseKey = key;
        if (userId) this.userId = userId;
        if (typeof supabase !== 'undefined') {
            if (!window.globalSupabaseClient) {
                window.globalSupabaseClient = supabase.createClient(url, key);
            }
            this.supabaseClient = window.globalSupabaseClient;
        } else {
            console.warn('Biblioteca Supabase não encontrada.');
        }
    }

    setTableName(tableName) {
        this.tableName = tableName;
    }

    async _acquireSyncLock() {
        if (!this._syncLock.isSyncing) { this._syncLock.isSyncing = true; return; }
        return new Promise(resolve => { this._syncLock.queue.push(resolve); });
    }

    _releaseSyncLock() {
        if (this._syncLock.queue.length > 0) { this._syncLock.queue.shift()(); }
        else { this._syncLock.isSyncing = false; }
    }

    async checkSupabaseConnection() {
        if (!this.supabaseClient) return { connected: false, error: 'Cliente Supabase não configurado' };
        try {
            const { data, error } = await this.supabaseClient.storage.from('sync-bucket').list('shared', { limit: 1 });
            if (error) return { connected: false, error: error.message, tableName: 'storage:sync-bucket' };
            return { connected: true, tableName: 'storage:sync-bucket', message: 'Conexão com Supabase Storage estabelecida' };
        } catch (error) {
            return { connected: false, error: error.message, tableName: 'storage:sync-bucket' };
        }
    }

    _trySubscribeRealtime() {
        if (!this.supabaseClient || !navigator.onLine) return;
        if (this._realtimeChannel) { try { this.supabaseClient.removeChannel(this._realtimeChannel); } catch (_) {} }
        try {
            this._realtimeChannel = this.supabaseClient
                .channel('data-service-tbl-suite-outbound')
                .on('system', {}, (status) => {
                    const wasSubscribed = this._realtimeSubscribed;
                    this._realtimeSubscribed = (status === 'SUBSCRIBED');
                    if (!wasSubscribed && this._realtimeSubscribed) {
                        console.log('✅ DataService: Realtime ativo — polling de fallback suprimido');
                    } else if (wasSubscribed && !this._realtimeSubscribed) {
                        console.warn('⚠️ DataService: Realtime desconectado — polling de fallback ativo');
                    }
                })
                .subscribe();
        } catch (e) {
            console.warn('⚠️ DataService: Realtime indisponível, usando polling:', e.message);
            this._realtimeSubscribed = false;
        }
    }

    async publishFormEvent(savedData, recordId) {
        const adapter = window.syncAdapter;
        if (!adapter || !adapter.isStarted()) return;
        try {
            await adapter.publishEvent('ecoforms.registro.criado', {
                record_id: recordId,
                uuid: savedData.uuid,
                tipo: savedData.tipoForm || savedData.formId,
                chave: savedData.uuid || String(recordId),
                conteudo: savedData.form_data || savedData,
                criado_por: savedData.userId,
                setor: savedData.setorId,
                criado_em: savedData.createdAt,
            }, { aggregateType: 'registro', aggregateId: savedData.uuid || String(recordId) });
        } catch (err) {
            console.warn('[DataService] publishEvent falhou:', err);
        }
    }

    async calculateChecksum(data) {
        const stringify = (typeof safeStringify !== 'undefined') ? safeStringify
            : (typeof window !== 'undefined' && typeof window.safeStringify === 'function') ? window.safeStringify
            : ((value) => JSON.stringify(value));
        const jsonString = stringify(data);
        const msgBuffer = new TextEncoder().encode(jsonString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `sha256:${hashHex}`;
    }

    extractFormData(record) {
        let payload = {};
        if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
            payload = { ...record.data };
        } else if (record.dados && typeof record.dados === 'object' && !Array.isArray(record.dados)) {
            payload = { ...record.dados };
        } else {
            const excludeKeys = [
                'id', 'syncStatus', 'createdAt', 'updatedAt', 'userId', 'tipoForm', 'activityId',
                'metadata', 'usuario', 'localizacao', 'atendimento', 'inspecao', 'dados',
                '_storagePaths', '_uploadErrors', 'professional_jsonb',
                'formId', 'formTitulo', 'form_title', 'tipo_form', 'form_type',
                'data', 'device', 'deviceId', 'device_id', 'perfil', 'equipe',
                'incremental', 'activity_id', 'task_id', 'submitted_at', 'uuid', 'status', 'db', 'vc'
            ];
            for (const key in record) {
                if (record.hasOwnProperty(key) && !excludeKeys.includes(key)) {
                    if (!key.startsWith('_') && typeof record[key] !== 'function') {
                        payload[key] = record[key];
                    }
                }
            }
        }
        if (record._storagePaths && typeof record._storagePaths === 'object') {
            payload._attachments = record._storagePaths;
        }
        if (record.vc && typeof record.vc === 'object') {
            payload.vc = record.vc;
        }
        return payload;
    }

    async createSnapshot(_record) {
        console.error('[DEPRECATED] createSnapshot() is dead code. Use publishFormEvent() instead.');
        return null;

        const uuidGen = window.uuidGenerator;
        const recordId = record.uuid || (uuidGen ? uuidGen.generateUUID() : uuidv7());
        const userId = record.userId || record.user_id || record.usuario_id || this.userId || null;
        const tipoForm = record.tipoForm || record.tipo_form || 'unknown';
        const statusV1 = record.status || 'submitted';

        const formData = {
            id: recordId, task_id: taskId, activity_id: taskId, user_id: userId,
            dados: dadosExtraidos, status: statusV1, submitted_at: submittedAt, atualizado_em: submittedAt,
            _schema_version: record._schema_version || '1.0.0',
            _migrated_at: record._migrated_at ? null : new Date().toISOString(),
            _migration_from: record._migration_from || null,
            package_id: recordId, payload_json: JSON.stringify(dadosExtraidos),
            module_type: tipoForm, resource_type: 'form', version_no: record.version_no || 1,
            owner_id: userId, is_current: 1, created_at: record.createdAt || submittedAt, closed_at: null
        };

        const data = { suite: [formData] };
        const checksum = await this.calculateChecksum(data);

        return {
            version: '1.0.0', timestamp: new Date().toISOString(),
            device_id: (typeof device !== 'undefined' && device.uuid) ? device.uuid : 'browser-' + this.userId,
            origin_device: 'mobile', sync_type: 'incremental', data,
            metadata: { checksum, record_count: { suite: 1 }, compressed: false, file_size_bytes: 0, schema_version: record._schema_version || '1.0.0' }
        };
    }

    async uploadSnapshot(snapshot) {
        console.warn('[DataService] uploadSnapshot() está depreciado.');
        return 'deprecated';
    }

    async retryFailedSync(maxRetries = 3) {
        console.warn('[DataService] retryFailedSync() está depreciado. Use window.syncAdapter.syncNow().');
        const adapter = window.syncAdapter;
        if (adapter && adapter.isStarted()) return adapter.syncNow();
        return { success: true, retried: 0, fixed: 0, stillFailed: 0 };
    }

    async syncSingleRecord(recordId, maxRetries = 3, validateBeforeSync = true) {
        console.warn('[DataService] syncSingleRecord() está depreciado. Use _publishFormEvent() via SyncAdapter.');
        const adapter = window.syncAdapter;
        if (adapter && adapter.isStarted()) return { success: true, method: 'event_pipeline' };
        return { success: false, error: 'SyncAdapter não disponível' };
    }

    async syncPendingData() {
        console.warn('[DataService] syncPendingData() está depreciado. Use window.syncAdapter.syncNow().');
        const adapter = window.syncAdapter;
        if (adapter && adapter.isStarted()) {
            const result = await adapter.syncNow();
            return { success: true, synced: result.pushed, errors: result.errors.length };
        }
        return { success: true, message: 'SyncAdapter não disponível', synced: 0, errors: 0 };
    }

    async _syncViaDirectWrite(record) {
        console.warn('[DataService] _syncViaDirectWrite() está depreciado.');
        return { skipped: true, reason: 'deprecated' };
    }

    async validateRecordBeforeSync(record) {
        const result = { valid: true, errors: [], warnings: [] };
        if (!record.uuid) { result.errors.push('UUID obrigatório'); result.valid = false; }
        if (!record.formId && !record.tipo_form) { result.errors.push('formId ou tipo_form obrigatório'); result.valid = false; }
        const formData = this.extractFormData(record);
        if (!formData || Object.keys(formData).length === 0) result.warnings.push('Registro sem dados de formulário');
        return result;
    }

    detectAndResolveConflict(localRecord, remoteRecord) {
        if (!remoteRecord) return { hasConflict: false, winner: 'local', strategy: 'no_remote' };
        const localTime = new Date(localRecord.updatedAt || localRecord.createdAt || 0).getTime();
        const remoteTime = new Date(remoteRecord.updated_at || remoteRecord.created_at || 0).getTime();
        const timeDiff = Math.abs(localTime - remoteTime);
        if (timeDiff > 5000) {
            const winner = localTime > remoteTime ? 'local' : 'remote';
            return { hasConflict: true, winner, strategy: 'last_write_wins', details: `${winner} wins by ${timeDiff}ms` };
        }
        try {
            const localHash = this._quickHash(JSON.stringify(this.extractFormData(localRecord)));
            const remoteHash = this._quickHash(JSON.stringify(remoteRecord.dados || remoteRecord.data || {}));
            if (localHash === remoteHash) return { hasConflict: false, winner: 'local', strategy: 'identical_content', details: 'Content hashes match' };
            return { hasConflict: true, winner: 'local', strategy: 'content_hash_tiebreak', details: `Local hash ${localHash} vs Remote hash ${remoteHash}` };
        } catch (e) {
            return { hasConflict: true, winner: 'local', strategy: 'fallback_local', details: 'Hash comparison failed' };
        }
    }

    _quickHash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
        return (hash >>> 0).toString(16);
    }

    _compareVectorClocks(vc1, vc2) {
        console.warn('⚠️ _compareVectorClocks está deprecated (Fase 4)');
        return 'equal';
    }

    _parseSemver(version) {
        console.warn('⚠️ _parseSemver está deprecated (Fase 4)');
        const parts = (version || '1.0.0').split('.');
        return { major: parseInt(parts[0]) || 1, minor: parseInt(parts[1]) || 0, patch: parseInt(parts[2]) || 0 };
    }

    /**
     * @deprecated ADR-056 V7 — V7 write-back removido. Task status changes devem
     * usar o pipeline de eventos (window.syncAdapter.publishEvent).
     */
    async sendTaskStatusUpdate(taskId, newStatus, metadata = {}) {
        if (!this.supabaseClient) throw new Error('Cliente Supabase não configurado');
        try {
            const snapshotData = { tarefas: [{ id: taskId, status: newStatus, updated_at: new Date().toISOString(), ...metadata }] };
            const checksum = await this.calculateChecksum(snapshotData);
            const snapshot = {
                version: '1.0.0', timestamp: new Date().toISOString(), device_id: 'browser-mobile',
                origin_device: 'mobile', sync_type: 'task_status_update', data: snapshotData,
                metadata: { checksum, record_count: { tarefas: 1 }, compressed: false }
            };
            const filename = `task_status_${taskId}_${Date.now()}.json`;
            const uploadPath = `shared/inbox/${filename}`;
            const { error } = await this.supabaseClient.storage.from('sync-bucket').upload(uploadPath, JSON.stringify(snapshot));
            if (error) throw error;
            return { success: true, path: uploadPath };
        } catch (error) {
            console.error('❌ Erro ao enviar update de status da tarefa:', error);
            throw error;
        }
    }

    async syncEcopontoOcupacao(estado) {
        if (!this.supabaseClient) { console.warn('⚠️ Supabase client não disponível, sync adiado'); return; }
        try {
            const supabaseData = {
                user_id: estado.user_id || this.userId,
                tipo_form: 'ecopontoCaixasForm',
                dados: {
                    metadata: { version: '2.0', schema: 'ecoforms-professional', created_at: estado.updated_at, updated_at: estado.updated_at, form_type: 'ecopontoCaixasForm', sync_status: 'synced', source: 'mobile-app', quality: { completeness: 100, validation_status: 'completed', review_required: false } },
                    usuario: { id: estado.user_id || this.userId, nome: 'Operador', device_id: estado.device_id, perfil: 'operador' },
                    localizacao: { timestamp: estado.updated_at, origem: 'manual', confiabilidade: 'alta' },
                    inspecao: {
                        ecoponto: { id: estado.ecoponto_id, nome: estado.nome_ecoponto },
                        ocupacao: {
                            timestamp: estado.updated_at,
                            caixas: this._normalizeCaixasOcupacao({ ocupacao: estado.ocupacao, removidas: {} }),
                            resumo: estado.resumo, evento: null
                        }
                    }
                }
            };
            const { data, error } = await this.supabaseClient.from(this.tableName).insert([supabaseData]).select();
            if (error) throw error;
            estado.historico = [];
            estado.syncStatus = 'synced';
            await this.store.put({ ...estado, id: `ecoponto_ocupacao_${estado.ecoponto_id}` });
        } catch (error) {
            console.error('❌ Erro ao sincronizar ocupação:', error);
            estado.syncStatus = 'error';
            await this.store.put({ ...estado, id: `ecoponto_ocupacao_${estado.ecoponto_id}` });
        }
    }

    _normalizeCaixasOcupacao(caixasList) {
        const ocupacao = caixasList.ocupacao || {};
        const removidas = caixasList.removidas || {};
        const tiposCaixa = { 1: { nome: 'Entulho', cor: 'bg-gray-500' }, 2: { nome: 'Madeira', cor: 'bg-amber-600' }, 3: { nome: 'Poda', cor: 'bg-green-600' }, 4: { nome: 'Reciclável', cor: 'bg-blue-500' }, 5: { nome: 'Rejeito', cor: 'bg-gray-600' }, 6: { nome: 'Sucata', cor: 'bg-yellow-500' }, 7: { nome: 'Vidro', cor: 'bg-cyan-500' } };
        return Object.keys(tiposCaixa).map(id => ({ id: parseInt(id), nome: tiposCaixa[id].nome, cor: tiposCaixa[id].cor, ocupacao: ocupacao[id] || '', status: removidas[id] ? 'removida' : (ocupacao[id] ? 'ativa' : 'vazia'), nivel_critico: ocupacao[id] && parseInt(ocupacao[id]) >= 80 }));
    }
}

if (typeof window !== 'undefined') {
    window.FormSyncService = FormSyncService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FormSyncService };
}
