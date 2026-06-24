/**
 * Data Service - Serviço universal para persistência de dados de formulários no IndexedDB
 * Suporta armazenamento JSONB para qualquer tipo de formulário
 * Integração com Supabase para sincronização com backend
 *
 * Dependencies: stable-stringify.js (for checksum compatibility with Desktop)
 *               safe-json.js (for safe JSON serialization: BigInt, Date, circular refs)
 */

// Singleton para cliente Supabase global - agora usando window.globalSupabaseClient
// let globalSupabaseClient = null; // REMOVIDO - usando window.globalSupabaseClient

class DataService {
    constructor() {
        this.dbName = 'FormDataDB';
        this.dbVersion = 3; // v3: Adicionado índice uuid para deduplicação e idempotência
        this.storeName = 'formSubmissions';
        this.db = null;

        // Configuração Supabase
        this.supabaseUrl = null;
        this.supabaseKey = null;
        this.supabaseClient = null;
        this.tableName = 'suite'; // Nome da tabela no Supabase
        this.userId = '00000000-0000-0000-0000-000000000000'; // ID padrão do usuário

        // Configurações de upload
        this.maxUploadBytes = 5 * 1024 * 1024; // 5MB padrão
        this.autoCompressImages = true; // Compressão automática de imagens > 1MB
        this.compressionQuality = 0.8; // Qualidade JPEG para compressão
        this.maxImageWidth = 1920; // Largura máxima para redimensionamento

        // Controle de concorrência de sincronização (Fase 2)
        this._syncLock = {
            isSyncing: false,
            queue: []
        };
    }

    /**
     * Adquire o lock de sincronização. Se outro sync estiver em andamento,
     * enfileira a requisição e resolve quando o lock for liberado.
     * @returns {Promise<void>}
     * @private
     */
    async _acquireSyncLock() {
        if (!this._syncLock.isSyncing) {
            this._syncLock.isSyncing = true;
            return;
        }
        return new Promise((resolve) => {
            this._syncLock.queue.push(resolve);
        });
    }

    /**
     * Libera o lock de sincronização, permitindo o próximo da fila (se houver).
     * @private
     */
    _releaseSyncLock() {
        if (this._syncLock.queue.length > 0) {
            const next = this._syncLock.queue.shift();
            next();
        } else {
            this._syncLock.isSyncing = false;
        }
    }

    /**
     * Configura a conexão com Supabase usando singleton
     * @param {string} url - URL do projeto Supabase
     * @param {string} key - Chave pública do Supabase
     * @param {string} userId - ID do usuário (opcional)
     */
    configureSupabase(url, key, userId = null) {
        this.supabaseUrl = url;
        this.supabaseKey = key;
        if (userId) {
            this.userId = userId;
        }

        // Usar cliente singleton global ou criar novo se não existir
        if (typeof supabase !== 'undefined') {
            if (!window.globalSupabaseClient) {
                window.globalSupabaseClient = supabase.createClient(url, key);
                console.log('📊 DataService criou cliente Supabase singleton global');
            } else {
                console.log('📊 DataService usando cliente Supabase singleton existente');
            }
            this.supabaseClient = window.globalSupabaseClient;
        } else {
            console.warn('Biblioteca Supabase não encontrada. Carregue @supabase/supabase-js primeiro.');
        }
    }

    /**
     * Inicializa a conexão com o IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Erro ao abrir IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB inicializado com sucesso');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                // Criar object store se não existir
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // Criar índices para consultas eficientes
                    store.createIndex('formId', 'formId', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('syncStatus', 'syncStatus', { unique: false });
                    store.createIndex('tipoForm', 'tipoForm', { unique: false });
                    store.createIndex('activityId', 'activityId', { unique: false }); // v1 baseline
                    store.createIndex('uuid', 'uuid', { unique: true }); // v3: uuid para deduplicação

                    console.log('Object store criado com sucesso');
                }

                // Criar idempotency tracking store (v3)
                if (!db.objectStoreNames.contains('syncIdempotency')) {
                    const idempotencyStore = db.createObjectStore('syncIdempotency', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    idempotencyStore.createIndex('recordUUID', 'recordUUID', { unique: true });
                    idempotencyStore.createIndex('syncAttemptTime', 'syncAttemptTime', { unique: false });
                    console.log('🔧 [DataService] Object store "syncIdempotency" criado');
                }

                // Criar form field registry cache store (v3)
                if (!db.objectStoreNames.contains('formFieldRegistry')) {
                    const registryStore = db.createObjectStore('formFieldRegistry', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    registryStore.createIndex('formId', 'formId', { unique: true });
                    registryStore.createIndex('cachedAt', 'cachedAt', { unique: false });
                    console.log('🔧 [DataService] Object store "formFieldRegistry" criado');
                }

                // Atualizações de schema para stores existentes
                if (db.objectStoreNames.contains(this.storeName)) {
                    const transaction = event.target.transaction;
                    const store = transaction.objectStore(this.storeName);

                    if (oldVersion < 2) {
                        if (!store.indexNames.contains('activityId')) {
                            store.createIndex('activityId', 'activityId', { unique: false });
                            console.log('🔧 [DataService] Índice "activityId" adicionado');
                        }
                    }

                    if (oldVersion < 3) {
                        if (!store.indexNames.contains('uuid')) {
                            store.createIndex('uuid', 'uuid', { unique: true });
                            console.log('🔧 [DataService] Índice "uuid" adicionado para deduplicação');
                        }
                    }
                }
            };
        });
    }

    /**
     * Salva dados de formulário no IndexedDB
     * @param {Object} formData - Dados do formulário no formato padrão
     * @returns {Promise<number>} ID do registro salvo
     */
    async saveFormData(formData) {
        // Detecta form incremental de caixas
        if (formData.incremental && formData.formId === 'ecopontoCaixasForm') {
            return this.saveEcopontoCaixasIncremental(formData);
        }

        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // Função para limpar dados não serializáveis mantendo Arquivos e evitando ciclos
            const cleanDataForIndexedDB = (obj, seen = new WeakSet()) => {
                // Retornar primitivos e null
                if (obj === null || typeof obj !== 'object') {
                    return obj;
                }

                // Manter File e Blob intactos (suportados pelo IndexedDB)
                if ((typeof File !== 'undefined' && obj instanceof File) ||
                    (typeof Blob !== 'undefined' && obj instanceof Blob)) {
                    return obj;
                }

                // Remover nós DOM e elementos
                if (obj.nodeType || (typeof Node !== 'undefined' && obj instanceof Node) || (typeof Element !== 'undefined' && obj instanceof Element)) {
                    return null;
                }

                // Detectar ciclos
                if (seen.has(obj)) {
                    return null;
                }
                seen.add(obj);

                // Tratar Arrays recursivamente
                if (Array.isArray(obj)) {
                    return obj.map(item => cleanDataForIndexedDB(item, seen));
                }

                // Tratar Objetos recursivamente
                const cleaned = {};
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        const value = obj[key];
                        // Ignorar funções, undefined e symbols
                        if (typeof value === 'function' || typeof value === 'undefined' || typeof value === 'symbol') {
                            continue;
                        }
                        cleaned[key] = cleanDataForIndexedDB(value, seen);
                    }
                }
                return cleaned;
            };

            //  Criar estrutura profissional do JSONB
            const professionalJSONB = this.createProfessionalJSONB(formData);

            // Obter userId do dados doformulário ou do AuthManager
            const currentUserId = formData.user_id ||
                (window.authManager && window.authManager.isLoggedIn() ?
                    window.authManager.getCurrentUser()?.id : null) ||
                this.userId;

            // Validar que um userId válido foi fornecido
            if (!currentUserId || currentUserId === '00000000-0000-0000-0000-000000000000') {
                reject(new Error('Usuário não autenticado. Não é possível salvar dados sem um user_id válido.'));
                return;
            }

            // Obter setor_id do usuário atual (assume o primeiro setor por padrão se houver vários)
            const currentUserSectors = window.authManager && window.authManager.isLoggedIn() ?
                (window.authManager.getCurrentUser()?.setores || []) : [];
            const setorId = formData.setor_id || (currentUserSectors.length > 0 ? currentUserSectors[0] : null);

            // Adicionar metadados de controle e limpar dados
            const rawDataToSave = {
                ...formData,
                ...professionalJSONB, // Incluir estrutura profissional
                uuid: formData.uuid || generateUUIDv7(),
                syncStatus: 'pending', // pending, synced, error
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // Campos para compatibilidade com Supabase
                tipoForm: formData.formId || formData.tipo_form || 'unknown',
                userId: currentUserId,
                setorId: setorId,
                activityId: formData.activity_id || null // Link to activity if present
            };

            // Draft support
            if (formData.isDraft) {
                rawDataToSave.syncStatus = 'draft';
                rawDataToSave.status = 'draft'; // Server status if synced (optional)
            }

            // Clean the entire object to ensure all data is serializable for IndexedDB
            const dataToSave = cleanDataForIndexedDB(rawDataToSave);

            // Use put instead of add to support updates if ID exists
            const request = store.put(dataToSave);

            request.onsuccess = () => {
                console.log('Dados salvos no IndexedDB:', request.result);

                // Publicar evento via SyncAdapter (pipeline unificado)
                this._publishFormEvent(dataToSave, request.result).catch(error => {
                    console.warn('[DataService] Falha ao publicar evento:', error);
                });

                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Erro ao salvar dados:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Salva um rascunho do formulário (sem enviar para o servidor)
     * @param {Object} formData 
     */
    async saveDraft(formData) {
        return this.saveFormData({ ...formData, isDraft: true });
    }

    /**
     * Promove um rascunho para envio
     * @param {number} draftId 
     */
    async submitDraft(draftId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const getRequest = store.get(draftId);

            getRequest.onsuccess = () => {
                const record = getRequest.result;
                if (!record) {
                    reject(new Error('Rascunho não encontrado'));
                    return;
                }

                record.syncStatus = 'pending';
                record.status = 'submitted';
                record.updatedAt = new Date().toISOString();
                if (record.isDraft) delete record.isDraft;

                const updateRequest = store.put(record);
                updateRequest.onsuccess = () => {
                    console.log('Rascunho promovido para envio:', draftId);
                    if (this.supabaseClient) {
                        this.syncSingleRecord(draftId).catch(console.warn);
                    }
                    resolve(draftId);
                };
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Recupera todos os dados de um formulário específico
     * @param {string} formId - ID do formulário
     * @returns {Promise<Array>} Array com todos os registros do formulário
     */
    async getFormData(formId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('formId');
            const request = index.getAll(formId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Erro ao recuperar dados:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Recupera dados vinculados a uma atividade específica (Kanban)
     * @param {string|number} activityId 
     * @returns {Promise<Array>}
     */
    async getFormDataByActivityId(activityId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            // Garantir que o índice existe antes de tentar usar
            if (!store.indexNames.contains('activityId')) {
                resolve([]);
                return;
            }

            const index = store.index('activityId');
            const request = index.getAll(activityId);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error(`Erro ao recuperar dados da atividade ${activityId}:`, request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Recupera um registro específico pelo ID
     * @param {number} id - ID do registro
     * @returns {Promise<Object>} O registro encontrado ou undefined
     */
    async getFormDataById(id) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            // ID é numérico no IndexedDB (autoincrement)
            const request = store.get(parseInt(id));

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Erro ao recuperar registro por ID:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Recupera todos os dados pendentes de sincronização
     * @returns {Promise<Array>} Array com registros não sincronizados
     */
    async getPendingSync() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('syncStatus');
            const request = index.getAll('pending');

            request.onsuccess = () => {
                // Filtrar registros para separar os especiais de ocupação dos normais
                const allPending = request.result;
                const regularPending = allPending.filter(record =>
                    !(record.id && typeof record.id === 'string' && record.id.startsWith('ecoponto_ocupacao_'))
                );

                resolve(regularPending);
            };

            request.onerror = () => {
                console.error('Erro ao recuperar dados pendentes:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Recupera todos os dados pendentes de sincronização (inclusive especiais)
     * @returns {Promise<Array>} Array com todos os registros não sincronizados
     */
    async getAllPendingSync() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('syncStatus');
            const request = index.getAll('pending');

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Erro ao recuperar dados pendentes:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Atualiza o status de sincronização de um registro
     * @param {number} id - ID do registro
     * @param {string} status - Novo status (pending, synced, error)
     * @returns {Promise<void>}
     */
    async updateSyncStatus(recordId, status) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(recordId);

            request.onsuccess = () => {
                const record = request.result;
                if (record) {
                    record.syncStatus = status;
                    record.updatedAt = new Date().toISOString();
                    const updateRequest = store.put(record);
                    updateRequest.onsuccess = () => resolve();
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Registro não encontrado para atualização de status'));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Atualiza o status de ciclo de vida do registro (ex: submitted, approved, etc.)
     * @param {number} recordId 
     * @param {string} status 
     */
    async updateRecordStatus(recordId, status) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(recordId);

            request.onsuccess = () => {
                const record = request.result;
                if (record) {
                    record.status = status;
                    record.updatedAt = new Date().toISOString();
                    const updateRequest = store.put(record);
                    updateRequest.onsuccess = () => {
                        console.log(`Status do registro ${recordId} atualizado para: ${status}`);
                        resolve();
                    };
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    reject(new Error('Registro não encontrado para atualização de status de ciclo de vida'));
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove um registro específico
     * @param {number} id - ID do registro
     * @returns {Promise<void>}
     */
    async deleteRecord(id) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('Registro removido:', id);
                resolve();
            };

            request.onerror = () => {
                console.error('Erro ao remover registro:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Obtém estatísticas dos dados armazenados
     * @returns {Promise<Object>} Objeto com estatísticas
     */
    async getStats() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const allData = request.result;
                const stats = {
                    total: allData.length,
                    pending: allData.filter(item => item.syncStatus === 'pending').length,
                    synced: allData.filter(item => item.syncStatus === 'synced').length,
                    errors: allData.filter(item => item.syncStatus === 'error').length,
                    byForm: {},
                    supabaseConfig: {
                        configured: !!this.supabaseClient,
                        url: this.supabaseUrl ? this.supabaseUrl.substring(0, 30) + '...' : null,
                        tableName: this.tableName
                    }
                };

                // Agrupar por formulário
                allData.forEach(item => {
                    // Identificar registros especiais de ocupação de ecoponto
                    if (item.id && typeof item.id === 'string' && item.id.startsWith('ecoponto_ocupacao_')) {
                        const formType = 'ecoponto_ocupacao_especial';
                        if (!stats.byForm[formType]) {
                            stats.byForm[formType] = {
                                total: 0,
                                pending: 0,
                                synced: 0,
                                errors: 0
                            };
                        }
                        stats.byForm[formType].total++;
                        stats.byForm[formType][item.syncStatus]++;
                    } else {
                        const formType = item.tipoForm || item.formId || 'unknown';
                        if (!stats.byForm[formType]) {
                            stats.byForm[formType] = {
                                total: 0,
                                pending: 0,
                                synced: 0,
                                errors: 0
                            };
                        }
                        stats.byForm[formType].total++;
                        stats.byForm[formType][item.syncStatus]++;
                    }
                });

                resolve(stats);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Obtém todos os dados de formulários armazenados
     * @returns {Promise<Array>} Array com todos os dados
     */
    async getAllFormData() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Configura o nome da tabela Supabase
     * @param {string} tableName - Nome da tabela
     */
    setTableName(tableName) {
        this.tableName = tableName;
        console.log(`Nome da tabela Supabase definido como: ${tableName}`);
    }

    /**
     * Verifica o status da conexão com Supabase
     * @returns {Promise<Object>} Status da conexão
     */
    async checkSupabaseConnection() {
        if (!this.supabaseClient) {
            return {
                connected: false,
                error: 'Cliente Supabase não configurado'
            };
        }

        try {
            // Tentar verificar existência do bucket de sync/shared folder
            // Usar listBuckets ou getBucket nem sempre funciona dependendo da permissão
            // Tentar listar arquivos em shared é um bom teste de leitura
            const { data, error } = await this.supabaseClient
                .storage
                .from('sync-bucket')
                .list('shared', { limit: 1 });

            if (error) {
                return {
                    connected: false,
                    error: error.message,
                    tableName: 'storage:sync-bucket'
                };
            }

            return {
                connected: true,
                tableName: 'storage:sync-bucket',
                message: 'Conexão com Supabase Storage (sync-bucket) estabelecida com sucesso'
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                tableName: 'storage:sync-bucket'
            };
        }
    }

    /**
     * Força nova tentativa de sincronização para registros com erro
     * @param {number} maxRetries - Número máximo de tentativas por registro
     * @returns {Promise<Object>} Resultado da re-sincronização
     */
    /**
     * @deprecated Use window.syncAdapter.syncNow() em vez deste método.
     * Mantido para compatibilidade — redireciona para o pipeline de eventos.
     */
    async retryFailedSync(maxRetries = 3) {
        console.warn('[DataService] retryFailedSync() está depreciado. Use window.syncAdapter.syncNow().');
        const adapter = window.syncAdapter;
        if (adapter && adapter.isStarted()) {
            return adapter.syncNow();
        }
        return { success: true, retried: 0, fixed: 0, stillFailed: 0 };
    }

    /**
     * Tenta subscrever ao Supabase Realtime para receber notificação de novos
     * registros na suite, permitindo sync imediato ao invés de aguardar polling.
     * Falha silenciosamente — polling continua como fallback.
     */
    _trySubscribeRealtime() {
        if (!this.supabaseClient || !navigator.onLine) return;

        // Remover canal anterior se existir
        if (this._realtimeChannel) {
            try {
                this.supabaseClient.removeChannel(this._realtimeChannel);
            } catch (_) { /* ignore */ }
        }

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

    /**
     * Upload genérico de arquivo para Supabase Storage
     * @param {File|Blob} file
     * @param {string} bucket
     * @param {string} path
     * @returns {Promise<{path:string,url:string}>}
     */
    async uploadFileToStorage(file, bucket = 'sync-bucket', path = null) {
        // If no supabase client is available in the browser, we'll fallback to the backend proxy
        // which expects a `path` relative to the configured server bucket. We will store files
        // under a subfolder named after the requested bucket when falling back.

        let processedFile = file;

        // Comprimir imagens grandes automaticamente
        if (this.autoCompressImages && file.type.startsWith('image/') && file.size > 1024 * 1024) { // > 1MB
            try {
                console.log(`🗜️ Comprimindo imagem de ${Math.round(file.size / 1024 / 1024 * 100) / 100}MB...`);
                processedFile = await CameraField.compressImage(file, this.maxImageWidth, this.compressionQuality);
                console.log(`✅ Imagem comprimida para ${Math.round(processedFile.size / 1024 / 1024 * 100) / 100}MB`);
            } catch (error) {
                console.warn('⚠️ Falha na compressão, usando arquivo original:', error);
                processedFile = file;
            }
        }

        // Validação básica de MIME e tamanho (defensiva)
        const allowedMimes = ['image/jpeg', 'image/png'];
        const maxBytes = this.maxUploadBytes || (5 * 1024 * 1024); // 5MB padrão

        const mime = processedFile.type || (processedFile instanceof Blob ? processedFile.type : null);
        if (mime && !allowedMimes.includes(mime)) {
            throw new Error(`Tipo de arquivo não permitido: ${mime}`);
        }

        if (processedFile.size && processedFile.size > maxBytes) {
            throw new Error(`Arquivo maior que o máximo permitido (${maxBytes} bytes)`);
        }

        // Gerar nome se não informado - Segue padrão users/{userId}/images/
        const filename = path || `users/${this.userId}/images/${Date.now()}_${(processedFile.name || 'upload').replace(/\s+/g, '_')}`;
        // If we have a client, use it directly
        if (this.supabaseClient) {
            const { data, error } = await this.supabaseClient.storage.from(bucket).upload(filename, processedFile, { upsert: false });
            if (error) throw error;
            // Obter URL público (ou use createSignedUrl para privado)
            const { data: publicData } = this.supabaseClient.storage.from(bucket).getPublicUrl(filename);
            const publicUrl = publicData?.publicUrl || null;
            return { path: filename, url: publicUrl };
        }

        // Fallback: POST to backend proxy /api/upload which will store the file in the server-configured bucket
        try {
            const serverPath = `${bucket}/${filename}`; // stored under bucket folder inside server bucket
            const uploadUrl = `/api/upload?path=${encodeURIComponent(serverPath)}`;

            // If processedFile is a Blob/File we can POST it directly
            const resp = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': processedFile.type || 'application/octet-stream' },
                body: processedFile
            });

            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`Upload proxy failed: ${resp.status} ${txt}`);
            }

            // Request a signed download URL from the server
            const signedResp = await fetch(`/api/signed-url?path=${encodeURIComponent(serverPath)}&op=download&expires=3600`);
            if (!signedResp.ok) {
                const txt = await signedResp.text();
                throw new Error(`Signed URL request failed: ${signedResp.status} ${txt}`);
            }
            const signedJson = await signedResp.json();
            return { path: serverPath, url: signedJson.url };
        } catch (e) {
            throw new Error(`Fallback upload failed: ${e.message}`);
        }
    }

    /**
     * Detecta e faz upload de imagens/arquivos dentro de um registro.
     * Substitui File/Blob/dataURLs por URLs públicos e adiciona campo _storagePaths com metadados.
     * Rastreia erros de upload em _uploadErrors para visibilidade completa.
     * @param {Object} record
     * @returns {Promise<Object>} record modificado (cópia)
     */
    /**
     * Detecta e faz upload de imagens/arquivos dentro de um registro de forma recursiva.
     * Suporta strings DataURL puras e objetos compostos { dataUrl, ... }.
     * @param {Object} record - O registro original para processar
     * @returns {Promise<Object>} O registro com os arquivos substituídos por caminhos de storage
     */
    async uploadFilesInRecord(record) {
        // Deep-clone do registro para garantir imutabilidade do original em caso de falha parcial
        let copy;
        try {
            copy = structuredClone(record);
        } catch (_) {
            copy = JSON.parse(JSON.stringify(record));
        }
        copy._storagePaths = copy._storagePaths || {};
        copy._uploadErrors = [];

        let totalFilesToUpload = 0;
        let successfulUploads = 0;

        // Função interna para gerenciar o upload individual
        const handleItemUpload = async (item, fieldKey) => {
            totalFilesToUpload++;
            try {
                let fileToUpload = item;
                
                // Se for um objeto com dataUrl, extrair a string
                if (item && typeof item === 'object' && item.dataUrl) {
                    fileToUpload = item.dataUrl;
                }

                // Converter DataURL para Blob/File se necessário
                if (typeof fileToUpload === 'string' && fileToUpload.startsWith('data:')) {
                    const res = await fetch(fileToUpload);
                    const blob = await res.blob();
                    
                    // Validar se o mime é permitido (segue restrição em uploadFileToStorage)
                    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
                    if (blob.type && !allowedMimes.includes(blob.type.split(';')[0])) {
                        // Se não for imagem comum, tentar prosseguir se for blob genérico ou avisar
                        console.warn(`Tipo não mapeado explicitamente: ${blob.type}`);
                    }

                    const ext = (blob.type && blob.type.split('/')[1]) ? `.${blob.type.split('/')[1].split(';')[0]}` : '.jpg';
                    fileToUpload = new File([blob], `upload_${Date.now()}${ext}`, { type: blob.type });
                }

                // Verificar se temos um arquivo válido para upload
                const isFile = (typeof File !== 'undefined' && fileToUpload instanceof File) || 
                               (typeof Blob !== 'undefined' && fileToUpload instanceof Blob);

                if (isFile) {
                    const { url, path } = await this.uploadFileToStorage(fileToUpload);
                    copy._storagePaths[fieldKey] = path;
                    successfulUploads++;
                    console.log(`✅ Upload bem-sucedido para: ${fieldKey} -> ${path}`);
                    
                    // Se o item original era um objeto, preservar metadados mas atualizar a URL
                    if (item && typeof item === 'object' && item.dataUrl) {
                        return {
                            ...item,
                            url: url,
                            storagePath: path,
                            dataUrl: null, // Remover base64 para economizar espaço
                            uploadedAt: new Date().toISOString()
                        };
                    }
                    return url;
                }

                // Não é um arquivo/dataurl, subtrair do contador e retornar original
                totalFilesToUpload--;
                return item;

            } catch (err) {
                const errorInfo = {
                    field: fieldKey,
                    error: err.message || String(err),
                    timestamp: new Date().toISOString()
                };
                copy._uploadErrors.push(errorInfo);
                console.error(`❌ Erro no upload de ${fieldKey}:`, err.message);
                return item; // Retorna original para não perder o dado (mesmo que base64)
            }
        };

        // Função recursiva para navegar em qualquer profundidade
        const processRecursive = async (obj, currentPath = '') => {
            if (!obj || typeof obj !== 'object') return obj;

            // Evitar recursão infinita ou processar objetos de sistema
            if (obj instanceof File || obj instanceof Blob) {
                return await handleItemUpload(obj, currentPath);
            }

            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    const itemPath = currentPath ? `${currentPath}[${i}]` : `[${i}]`;
                    obj[i] = await processRecursive(obj[i], itemPath);
                }
                return obj;
            }

            // Caso especial: Objeto com dataUrl (CameraFieldV2)
            if (obj.dataUrl && typeof obj.dataUrl === 'string' && obj.dataUrl.startsWith('data:')) {
                return await handleItemUpload(obj, currentPath);
            }

            // Objeto normal: processar chaves
            for (const key of Object.keys(obj)) {
                // Pular chaves de controle
                if (key === '_storagePaths' || key === '_uploadErrors' || key === 'metadata') continue;

                const val = obj[key];
                const itemPath = currentPath ? `${currentPath}.${key}` : key;

                if (typeof val === 'string' && val.startsWith('data:')) {
                    obj[key] = await handleItemUpload(val, itemPath);
                } else if (val && typeof val === 'object') {
                    obj[key] = await processRecursive(val, itemPath);
                }
            }
            return obj;
        };

        // Iniciar processamento
        // Importante: No caso de registros do suite, os dados reais costumam estar em .data ou .dados
        if (copy.data || copy.dados) {
            if (copy.data) copy.data = await processRecursive(copy.data, 'data');
            if (copy.dados) copy.dados = await processRecursive(copy.dados, 'dados');
        } else {
            // Se não for a estrutura padrão, varre tudo
            for (const key of Object.keys(copy)) {
                if (key === '_storagePaths' || key === '_uploadErrors' || key === 'id' || key === 'uuid') continue;
                copy[key] = await processRecursive(copy[key], key);
            }
        }

        // Relatório final
        if (totalFilesToUpload > 0) {
            console.log(`📊 Upload concluído: ${successfulUploads}/${totalFilesToUpload} bem-sucedidos`);
        }

        if (copy._uploadErrors.length > 0) {
            const errorMsg = `${copy._uploadErrors.length} upload(s) falharam.`;
            // Não lançamos erro aqui para permitir que a sincronização do JSON continue se o usuário desejar,
            // ou podemos manter o comportamento original de falha crítica:
            throw new Error(`Falha no upload de arquivos: ${errorMsg}`);
        }

        // Limpar objeto de erros se vazio
        if (copy._uploadErrors.length === 0) {
            delete copy._uploadErrors;
        }

        return copy;
    }


    /**
     * Para a sincronização automática
     * @param {number} intervalId - ID do intervalo retornado por startAutoSync
     */
    stopAutoSync(intervalId) {
        if (intervalId) {
            clearInterval(intervalId);
            console.log('Sincronização automática interrompida');
        }
    }

    /**
     * Calcula checksum SHA-256 para validação de integridade
     * @param {Object} data - Dados para calcular hash
     * @returns {Promise<string>} Hex string do hash
     */
    async calculateChecksum(data) {
        // Usa safeStringify do safe-json.js para serialização robusta
        const stringify = (typeof safeStringify !== 'undefined')
            ? safeStringify
            : (typeof window !== 'undefined' && typeof window.safeStringify === 'function')
                ? window.safeStringify
                : ((value) => JSON.stringify(value)); // último fallback inseguro, apenas para emergência

        const jsonString = stringify(data);
        const msgBuffer = new TextEncoder().encode(jsonString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `sha256:${hashHex}`; // Prefix to match Desktop format
    }

    /**
     * Cria um snapshot de sincronização compatível com StorageSync
     * @param {Object} record - Registro do formulário
     * @returns {Promise<Object>} Objeto SyncSnapshot
     */
    async createSnapshot(record) {
        // Minimalist Registration: O Desktop reconstitui o contexto via activity_id
        const taskId = record.task_id || record.activityId || record.activity_id || null;
        const submittedAt = new Date().toISOString();

        // Extrair dados do formulário e preservar vector clock se presente
        const dadosExtraidos = this.extractFormData(record);
        const vcFromRecord = record.data?.vc || record.dados?.vc || record.vc || null;
        if (vcFromRecord && typeof vcFromRecord === 'object') {
            dadosExtraidos.vc = vcFromRecord;
        }

        const recordId = record.uuid || generateUUIDv7();
        const userId = record.userId || record.user_id || record.usuario_id || this.userId || null;
        const tipoForm = record.tipoForm || record.tipo_form || 'unknown';
        const statusV1 = record.status || 'submitted';

        const formData = {
            // v1 (retrocompatibilidade)
            id: recordId,
            task_id: taskId,
            activity_id: taskId,
            user_id: userId,
            dados: dadosExtraidos,
            status: statusV1,
            submitted_at: submittedAt,
            atualizado_em: submittedAt,
            // Schema versioning stamps
            _schema_version: record._schema_version || '1.0.0',
            _migrated_at: record._migrated_at ? null : new Date().toISOString(),
            _migration_from: record._migration_from || null,
            // v2 (compatibilidade com desktop)
            package_id: recordId,
            payload_json: JSON.stringify(dadosExtraidos),
            module_type: tipoForm,
            resource_type: 'form',
            version_no: record.version_no || 1,
            owner_id: userId,
            is_current: 1,
            created_at: record.createdAt || submittedAt,
            closed_at: null
        };

        const data = {
            suite: [formData]
        };

        const checksum = await this.calculateChecksum(data);

        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            device_id: (typeof device !== 'undefined' && device.uuid) ? device.uuid : 'browser-' + this.userId,
            origin_device: 'mobile',
            sync_type: 'incremental',
            data: data,
            metadata: {
                checksum: checksum,
                record_count: {
                    suite: 1
                },
                compressed: false, // Será atualizado por uploadSnapshot se comprimir
                file_size_bytes: 0,
                schema_version: record._schema_version || '1.0.0'
            }
        };
    }

    /**
     * @deprecated Upload de snapshots JSON substituído pelo pipeline de eventos.
     * Mantido como no-op para compatibilidade.
     */
    async uploadSnapshot(snapshot) {
        console.warn('[DataService] uploadSnapshot() está depreciado. Use _publishFormEvent() via SyncAdapter.');
        return 'deprecated';
    }

    /**
     * @deprecated Use window.syncAdapter.publishEvent() em vez deste método.
     * Mantido para compatibilidade — redireciona para o pipeline de eventos.
     */
    async syncSingleRecord(recordId, maxRetries = 3, validateBeforeSync = true) {
        console.warn('[DataService] syncSingleRecord() está depreciado. Use _publishFormEvent() via SyncAdapter.');
        const adapter = window.syncAdapter;
        if (adapter && adapter.isStarted()) {
            return { success: true, method: 'event_pipeline' };
        }
        return { success: false, error: 'SyncAdapter não disponível' };
    }

    /**
     * Escrita direta do registro na suite do Supabase.
     * @deprecated Use _publishFormEvent() via SyncAdapter em vez deste método.
     */
    async _publishFormEvent(savedData, recordId) {
        const adapter = window.syncAdapter;
        if (!adapter || !adapter.isStarted()) return;

        try {
            await adapter.publishEvent('ecoforms.registro.criado', {
                record_id: recordId,
                uuid: savedData.uuid,
                tipo_form: savedData.tipoForm || savedData.formId,
                user_id: savedData.userId,
                setor_id: savedData.setorId,
                form_data: savedData.form_data || savedData,
                created_at: savedData.createdAt,
            }, {
                aggregateType: 'registro',
                aggregateId: savedData.uuid || String(recordId),
            });
        } catch (err) {
            console.warn('[DataService] publishEvent falhou:', err);
        }
    }

    /**
     * @deprecated Escrita direta em suite substituída pelo pipeline de eventos.
     * Mantido como no-op para compatibilidade.
     */
    async _syncViaDirectWrite(record) {
        console.warn('[DataService] _syncViaDirectWrite() está depreciado. Use _publishFormEvent().');
        return { skipped: true, reason: 'deprecated' };
    }

    /**
     * Valida um registro antes de enviar para sync
     * @param {Object} record - Registro do IndexedDB
     * @returns {Promise<Object>} { valid, errors, warnings }
     */
    async _validateRecordBeforeSync(record) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Validações básicas obrigatórias
        if (!record.uuid) {
            result.errors.push('UUID obrigatório');
            result.valid = false;
        }

        if (!record.formId && !record.tipo_form) {
            result.errors.push('formId ou tipo_form obrigatório');
            result.valid = false;
        }

        const formData = this.extractFormData(record);
        if (!formData || Object.keys(formData).length === 0) {
            result.warnings.push('Registro sem dados de formulário');
        }

        // Tentar usar FormValidator se disponível
        if (typeof window !== 'undefined' && typeof window.FormValidator !== 'undefined') {
            try {
                const validator = new window.FormValidator();
                const schema = await this.loadAndCacheFormSchema(record.formId || record.tipo_form);

                if (schema && schema.length > 0) {
                    // Construir regras de validação a partir do schema
                    const rules = {};
                    for (const field of schema) {
                        if (field.required) {
                            rules[field.field_name] = { required: true, type: field.field_type || 'text' };
                        }
                    }

                    if (Object.keys(rules).length > 0) {
                        const validationResult = await validator.validate(formData, rules);
                        if (!validationResult.valid) {
                            result.warnings.push(`Validação de schema: ${JSON.stringify(validationResult.errors)}`);
                        }
                    }
                }
            } catch (err) {
                console.warn('⚠️ Erro ao usar FormValidator:', err.message);
                // Continuar sem validação de schema
            }
        }

        return result;
    }

    /**
     * Detecta e resolve conflitos entre versão local e remota.
     * Estratégia simplificada (Fase 4): LWW por timestamp + hash de conteúdo como desempate.
     * Vector Clocks e SemVer removidos por não serem usados pelo Desktop.
     * @param {Object} localRecord - Registro local do IndexedDB
     * @param {Object} remoteRecord - Registro remoto do servidor
     * @returns {Object} { hasConflict, winner, strategy, details }
     */
    detectAndResolveConflict(localRecord, remoteRecord) {
        if (!remoteRecord) {
            return { hasConflict: false, winner: 'local', strategy: 'no_remote' };
        }

        const localTime = new Date(localRecord.updatedAt || localRecord.createdAt || 0).getTime();
        const remoteTime = new Date(remoteRecord.updated_at || remoteRecord.created_at || 0).getTime();
        const timeDiff = Math.abs(localTime - remoteTime);

        // Se diferença > 5s, LWW simples
        if (timeDiff > 5000) {
            const winner = localTime > remoteTime ? 'local' : 'remote';
            return {
                hasConflict: true,
                winner,
                strategy: 'last_write_wins',
                details: `${winner} wins by ${timeDiff}ms`
            };
        }

        // Se timestamps muito próximos, usar hash de conteúdo como desempate
        // (mais robusto que comparar milissegundos)
        try {
            const localHash = this._quickHash(JSON.stringify(this.extractFormData(localRecord)));
            const remoteHash = this._quickHash(JSON.stringify(remoteRecord.dados || remoteRecord.data || {}));

            if (localHash === remoteHash) {
                return {
                    hasConflict: false,
                    winner: 'local',
                    strategy: 'identical_content',
                    details: 'Content hashes match'
                };
            }

            // Hashes diferentes mas timestamps próximos: preferir local (operador em campo)
            return {
                hasConflict: true,
                winner: 'local',
                strategy: 'content_hash_tiebreak',
                details: `Local hash ${localHash} vs Remote hash ${remoteHash}`
            };
        } catch (e) {
            // Fallback seguro: local vence
            return {
                hasConflict: true,
                winner: 'local',
                strategy: 'fallback_local',
                details: 'Hash comparison failed, defaulting to local'
            };
        }
    }

    /**
     * Hash rápido para comparação de conteúdo (djb2).
     * Não é criptográfico — apenas para desempate de conflitos.
     */
    _quickHash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return (hash >>> 0).toString(16);
    }

    /**
     * @deprecated Vector Clocks removidos na Fase 4. Mantido para compatibilidade.
     */
    _compareVectorClocks(vc1, vc2) {
        console.warn('⚠️ _compareVectorClocks está deprecated (Fase 4)');
        return 'equal';
    }

    /**
     * @deprecated SemVer removido na Fase 4. Mantido para compatibilidade.
     */
    _parseSemver(version) {
        console.warn('⚠️ _parseSemver está deprecated (Fase 4)');
        const parts = (version || '1.0.0').split('.');
        return {
            major: parseInt(parts[0]) || 1,
            minor: parseInt(parts[1]) || 0,
            patch: parseInt(parts[2]) || 0
        };
    }

    /**
     * Carrega e cacheia schema do formulário do Supabase
     * @param {string} formId - ID do formulário
     * @returns {Promise<Array>} Array de campos do formulário ou [] se offline
     */
    async loadAndCacheFormSchema(formId) {
        if (!this.db) {
            await this.init();
        }

        return new Promise(async (resolve, reject) => {
            // Tentar buscar do cache local primeiro
            const transaction = this.db.transaction(['formFieldRegistry'], 'readonly');
            const store = transaction.objectStore('formFieldRegistry');
            const index = store.index('formId');
            const request = index.get(formId);

            request.onsuccess = async () => {
                const cached = request.result;

                // Cache encontrado e recente (< 7 dias)
                if (cached) {
                    const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
                    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

                    if (cacheAge < sevenDaysMs) {
                        console.log(`✅ Form schema carregado do cache: ${formId}`);
                        resolve(cached.fields);
                        return;
                    }
                }

                // Cache expirado ou não existe - tentar buscar do Storage
                if (!this.supabaseClient) {
                    console.warn(`⚠️ Sem conexão e sem cache para ${formId}, retornando []`);
                    resolve(cached ? cached.fields : []);
                    return;
                }

                try {
                    // Buscar do Storage em vez de tabela direta
                    const { data: fileData, error: storageError } = await this.supabaseClient
                        .storage
                        .from('sync-bucket')
                        .download('shared/form_field_registry.json');

                    if (storageError) throw storageError;

                    const text = await fileData.text();
                    const registry = JSON.parse(text);
                    
                    // Filtrar campos do formulário específico
                    const allFields = registry.data || registry.form_field_registry || registry;
                    const fields = Array.isArray(allFields) 
                        ? allFields.filter(f => f.form_id === formId).sort((a, b) => (a.display_priority || 0) - (b.display_priority || 0))
                        : [];

                    // Cachear no IndexedDB
                    const txWrite = this.db.transaction(['formFieldRegistry'], 'readwrite');
                    const storeWrite = txWrite.objectStore('formFieldRegistry');

                    // Deletar cache antigo se existir
                    if (cached) {
                        const deleteReq = storeWrite.delete(cached.id);
                    }

                    // Inserir novo cache
                    const newCacheEntry = {
                        formId: formId,
                        fields: fields,
                        cachedAt: new Date().toISOString()
                    };

                    storeWrite.add(newCacheEntry);
                    console.log(`✅ Form schema carregado do Storage e cacheado: ${formId}`);
                    resolve(fields);
                } catch (error) {
                    console.error(`❌ Erro ao carregar form schema ${formId}:`, error);
                    // Retornar cache expirado se estiver disponível
                    if (cached) {
                        console.log(`⚠️ Usando cache expirado para ${formId}`);
                        resolve(cached.fields);
                    } else {
                        resolve([]);
                    }
                }
            };

            request.onerror = async () => {
                console.warn('⚠️ Erro ao acessar cache, tentando Storage...');

                if (!this.supabaseClient) {
                    resolve([]);
                    return;
                }

                try {
                    // Buscar do Storage em vez de tabela direta
                    const { data: fileData, error: storageError } = await this.supabaseClient
                        .storage
                        .from('sync-bucket')
                        .download('shared/form_field_registry.json');

                    if (storageError) throw storageError;

                    const text = await fileData.text();
                    const registry = JSON.parse(text);
                    
                    // Filtrar campos do formulário específico
                    const allFields = registry.data || registry.form_field_registry || registry;
                    const fields = Array.isArray(allFields) 
                        ? allFields.filter(f => f.form_id === formId).sort((a, b) => (a.display_priority || 0) - (b.display_priority || 0))
                        : [];

                    resolve(fields);
                } catch (err) {
                    resolve([]);
                }
            };
        });
    }

    /**
     * Registra uma tentativa de sincronização para idempotência
     * @param {string} recordUUID - UUID do registro
     * @param {string} method - Método de sync (direct_write, storage_inbox, etc)
     * @param {boolean} success - Se foi bem-sucedido
     * @returns {Promise<void>}
     */
    async recordSyncAttempt(recordUUID, method, success) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncIdempotency'], 'readwrite');
            const store = transaction.objectStore('syncIdempotency');

            const attempt = {
                recordUUID: recordUUID,
                method: method,
                success: success,
                syncAttemptTime: new Date().toISOString(),
                checksum: '' // Será preenchido com hash da snapshot
            };

            const request = store.add(attempt);
            request.onsuccess = () => {
                console.log(`📝 Tentativa de sync registrada: ${recordUUID} (${method}, ${success ? 'OK' : 'FAIL'})`);
                resolve();
            };
            request.onerror = () => {
                console.warn('⚠️ Falha ao registrar tentativa de sync:', request.error);
                resolve(); // Não falhar toda a sincronização por erro de registro
            };
        });
    }

    /**
     * Verifica se um UUID já foi sincronizado com sucesso
     * @param {string} recordUUID - UUID do registro
     * @returns {Promise<boolean>} True se já foi sincronizado
     */
    async checkSyncIdempotency(recordUUID) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['syncIdempotency'], 'readonly');
            const store = transaction.objectStore('syncIdempotency');
            const index = store.index('recordUUID');

            const request = index.get(recordUUID);
            request.onsuccess = () => {
                const record = request.result;
                if (record && record.success) {
                    console.log(`✅ UUID já sincronizado com sucesso: ${recordUUID}`);
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            request.onerror = () => {
                resolve(false); // Se houver erro, permitir nova tentativa
            };
        });
    }

    /**
     * @deprecated Use window.syncAdapter.syncNow() em vez deste método.
     * Mantido para compatibilidade — redireciona para o pipeline de eventos.
     */
    async syncPendingData() {
        console.warn('[DataService] syncPendingData() está depreciado. Use window.syncAdapter.syncNow().');
        const adapter = window.syncAdapter;
        if (adapter && adapter.isStarted()) {
            const result = await adapter.syncNow();
            return { success: true, synced: result.pushed, errors: result.errors.length };
        }
        return { success: true, message: 'SyncAdapter não disponível', synced: 0, errors: 0 };
    }

    /**
     * Extrai e organiza os dados do formulário para envio ao Supabase
     * Cria uma estrutura JSONB limpa e bem organizada:
     * {
     *   metadata: { ...contexto, device, user... },
     *   form_data: { ...campos preenchidos... },
     *   attachments: [ ...referências de arquivos... ]
     * }
     * @param {Object} record - Registro completo do IndexedDB
     * @returns {Object} Dados organizados do formulário
     */
    extractFormData(record) {
        // Apenas extrai os campos de dados brutos do formulário, sem metadados redundantes
        let payload = {};

        // Preferência: se record.data existe e é um objeto, usar como base
        if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
            payload = { ...record.data };
        } else if (record.dados && typeof record.dados === 'object' && !Array.isArray(record.dados)) {
            // Fallback para 'dados' (estrutura antiga)
            payload = { ...record.dados };
        } else {
            // Extrair campos individuais do record, excluindo metadados
            const excludeKeys = [
                'id', 'syncStatus', 'createdAt', 'updatedAt', 'userId', 'tipoForm', 'activityId',
                'metadata', 'usuario', 'localizacao', 'atendimento', 'inspecao', 'dados',
                '_storagePaths', '_uploadErrors', 'professional_jsonb',
                'formId', 'formTitulo', 'form_title', 'tipo_form', 'form_type',
                'data', 'device', 'deviceId', 'device_id', 'perfil', 'equipe',
                'incremental', 'activity_id', 'task_id', 'submitted_at', 'uuid', 'status',
                'db', 'vc' // Vector clock
            ];

            for (const key in record) {
                if (record.hasOwnProperty(key) && !excludeKeys.includes(key)) {
                    // Exclude internal IndexedDB fields starting with _
                    if (!key.startsWith('_') && typeof record[key] !== 'function') {
                        payload[key] = record[key];
                    }
                }
            }
        }

        // Anexos são importantes manter
        if (record._storagePaths && typeof record._storagePaths === 'object') {
            payload._attachments = record._storagePaths;
        }

        // Preservar vector clock se presente para conflict resolution
        if (record.vc && typeof record.vc === 'object') {
            payload.vc = record.vc;
        }

        return payload;
    }

    /**
     * Limpa todos os dados sincronizados (mantém apenas pendentes)
     * @returns {Promise<number>} Número de registros removidos
     */
    async cleanupSyncedData() {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('syncStatus');
            const request = index.getAll('synced');

            request.onsuccess = () => {
                const syncedData = request.result;
                let deletedCount = 0;

                const deletePromises = syncedData.map(item => {
                    return new Promise((resolveDelete) => {
                        const deleteRequest = store.delete(item.id);
                        deleteRequest.onsuccess = () => {
                            deletedCount++;
                            resolveDelete();
                        };
                        deleteRequest.onerror = () => resolveDelete();
                    });
                });

                Promise.all(deletePromises).then(() => {
                    console.log(`${deletedCount} registros sincronizados removidos`);
                    resolve(deletedCount);
                });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Configura opções de upload e compressão
     * @param {Object} options - Opções de configuração
     * @param {number} options.maxUploadBytes - Tamanho máximo de upload em bytes
     * @param {boolean} options.autoCompressImages - Habilitar compressão automática
     * @param {number} options.compressionQuality - Qualidade da compressão (0-1)
     * @param {number} options.maxImageWidth - Largura máxima para redimensionamento
     */
    configureUpload(options = {}) {
        if (options.maxUploadBytes !== undefined) {
            this.maxUploadBytes = options.maxUploadBytes;
        }
        if (options.autoCompressImages !== undefined) {
            this.autoCompressImages = options.autoCompressImages;
        }
        if (options.compressionQuality !== undefined) {
            this.compressionQuality = Math.max(0.1, Math.min(1, options.compressionQuality));
        }
        if (options.maxImageWidth !== undefined) {
            this.maxImageWidth = Math.max(800, options.maxImageWidth);
        }
        console.log('📊 Configurações de upload atualizadas:', {
            maxUploadBytes: this.maxUploadBytes,
            autoCompressImages: this.autoCompressImages,
            compressionQuality: this.compressionQuality,
            maxImageWidth: this.maxImageWidth
        });
    }

    /**
     * Salva dados incrementais do ecopontoCaixasForm
     * Consolida eventos por ecoponto
     */
    async saveEcopontoCaixasIncremental(formData) {
        const ecopontoId = formData.data.ecoponto;
        const evento = formData.data.incrementalEvento || formData.data.caixas_list.incrementalEvento;

        if (!ecopontoId || !evento) {
            console.warn('⚠️ Dados incrementais incompletos, salvando como registro normal');
            return this.saveFormData({ ...formData, incremental: false });
        }

        const caixaId = evento.caixaId;
        const nivelNovo = evento.nivel;
        const isRemoved = evento.removed || false;

        // 1. Busca estado atual do ecoponto no IndexedDB
        const storeKey = `ecoponto_ocupacao_${ecopontoId}`;
        let estadoAtual = await this.getEcopontoEstado(storeKey);

        if (!estadoAtual) {
            // Primeiro evento deste ecoponto
            estadoAtual = {
                ecoponto_id: ecopontoId,
                nome_ecoponto: formData.data.ecopontoLabel || formData.data.ecoponto,
                ocupacao: {},
                resumo: {
                    total_caixas: 7,
                    caixas_criticas: 0,
                    caixas_preenchidas: 0,
                    caixas_removidas: 0
                },
                historico: []
            };
        }

        const nivelAnterior = estadoAtual.ocupacao[caixaId] || '';

        // 2. Atualiza ocupação
        if (isRemoved) {
            delete estadoAtual.ocupacao[caixaId];
        } else {
            estadoAtual.ocupacao[caixaId] = nivelNovo;
        }

        // 3. Recalcula resumo
        const ocupacoes = Object.values(estadoAtual.ocupacao).filter(v => v && v !== '');
        const caixasPreenchidas = ocupacoes.length;
        const caixasCriticas = ocupacoes.filter(v => parseInt(v) >= 80).length;
        const caixasRemovidas = estadoAtual.historico.filter(h => h.acao === 'remove').length;

        estadoAtual.resumo = {
            total_caixas: 7,
            caixas_criticas: caixasCriticas,
            caixas_preenchidas: caixasPreenchidas,
            caixas_removidas: caixasRemovidas
        };

        // 4. Adiciona ao histórico local (para sync posterior)
        estadoAtual.historico.push({
            caixa_id: caixaId,
            ocupacao_anterior: nivelAnterior,
            ocupacao_nova: isRemoved ? null : nivelNovo,
            acao: isRemoved ? 'remove' : (nivelAnterior ? 'update' : 'add'),
            timestamp: evento.timestamp || new Date().toISOString(),
            evento_id: evento.id || generateUUIDv7()
        });

        // 5. Adiciona estrutura profissional
        const professionalStructure = this.createProfessionalJSONB(formData);
        estadoAtual.professional_jsonb = professionalStructure;

        // 6. Metadados de controle
        estadoAtual.updated_at = new Date().toISOString();
        estadoAtual.device_id = formData.deviceId || formData.data.meta?.deviceId;
        estadoAtual.user_id = this.userId;
        estadoAtual.syncStatus = 'pending';

        // 7. Salva no IndexedDB
        await this.saveEcopontoEstado(storeKey, estadoAtual);

        console.log(`✅ Estado do ecoponto ${ecopontoId} atualizado localmente`);

        // 8. Agenda sincronização (se online)
        if (navigator.onLine && this.supabaseClient) {
            setTimeout(() => this.syncEcopontoOcupacao(estadoAtual), 1000);
        }

        return storeKey;
    }

    /**
     * Busca estado de um ecoponto no IndexedDB
     */
    async getEcopontoEstado(storeKey) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName], 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(storeKey);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Salva estado de um ecoponto no IndexedDB
     */
    async saveEcopontoEstado(storeKey, estado) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);

            // Usar put() ao invés de add() para sobrescrever
            const request = store.put({ ...estado, id: storeKey });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Sincroniza estado do ecoponto com Supabase (usando suite com estrutura JSONB)
     */
    async syncEcopontoOcupacao(estado) {
        if (!this.supabaseClient) {
            console.warn('⚠️ Supabase client não disponível, sync adiado');
            return;
        }

        try {
            console.log(`🔄 Sincronizando ecoponto ${estado.ecoponto_id} via suite...`);

            // Preparar dados no formato profissional JSONB para a suite
            const supabaseData = {
                user_id: estado.user_id || this.userId,
                tipo_form: 'ecopontoCaixasForm',
                dados: {
                    metadata: {
                        version: '2.0',
                        schema: 'ecoforms-professional',
                        created_at: estado.updated_at,
                        updated_at: estado.updated_at,
                        form_type: 'ecopontoCaixasForm',
                        sync_status: 'synced',
                        source: 'mobile-app',
                        quality: {
                            completeness: 100,
                            validation_status: 'completed',
                            review_required: false
                        }
                    },
                    usuario: {
                        id: estado.user_id || this.userId,
                        nome: 'Operador',
                        device_id: estado.device_id,
                        perfil: 'operador'
                    },
                    localizacao: {
                        timestamp: estado.updated_at,
                        origem: 'manual',
                        confiabilidade: 'alta'
                    },
                    inspecao: {
                        ecoponto: {
                            id: estado.ecoponto_id,
                            nome: estado.nome_ecoponto
                        },
                        ocupacao: {
                            timestamp: estado.updated_at,
                            caixas: this.normalizeCaixasOcupacao({
                                ocupacao: estado.ocupacao,
                                removidas: {} // Pode ser adicionado se necessário
                            }),
                            resumo: estado.resumo,
                            evento: null
                        }
                    }
                }
            };

            // Inserir no Supabase na tabela suite
            const { data, error } = await this.supabaseClient
                .from(this.tableName)
                .insert([supabaseData])
                .select();

            if (error) {
                console.error('❌ Erro ao inserir na suite:', error);
                throw error;
            }

            console.log(`✅ Dados do ecoponto ${estado.ecoponto_id} sincronizados via suite`);

            // Limpa histórico local após sync bem-sucedido
            estado.historico = [];
            estado.syncStatus = 'synced';
            await this.saveEcopontoEstado(`ecoponto_ocupacao_${estado.ecoponto_id}`, estado);

            console.log(`✅ Ecoponto ${estado.ecoponto_id} 100% sincronizado via suite`);

        } catch (error) {
            console.error('❌ Erro ao sincronizar ocupação via suite:', error);
            estado.syncStatus = 'error';
            await this.saveEcopontoEstado(`ecoponto_ocupacao_${estado.ecoponto_id}`, estado);
        }
    }

    /**
     * @deprecated ADR-056 V7 — V7 write-back removido. Task status changes devem
     * usar o pipeline de eventos (window.syncAdapter.publishEvent).
     * Use window.syncAdapter.publishEvent('task.atualizada'/'task.concluida', ...) instead.
     * 
     * Envia update de status de tarefa para o desktop (legado — será removido)
     * @param {string} taskId - ID da tarefa
     * @param {string} newStatus - Novo status ('a_fazer', 'em_progresso', 'concluido')
     * @param {Object} metadata - Metadados adicionais (opcional)
     */
    async sendTaskStatusUpdate(taskId, newStatus, metadata = {}) {
        if (!this.supabaseClient) {
            throw new Error('Cliente Supabase não configurado');
        }

        try {
            console.log(`📤 Enviando update de status da tarefa ${taskId} para ${newStatus}`);

            const snapshotData = {
                tarefas: [{
                    id: taskId,
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                    ...metadata
                }]
            };

            const checksum = await this.calculateChecksum(snapshotData);

            const snapshot = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                device_id: 'browser-mobile',
                origin_device: 'mobile',
                sync_type: 'task_status_update',
                data: snapshotData,
                metadata: {
                    checksum: checksum,
                    record_count: { tarefas: 1 },
                    compressed: false
                }
            };

            const filename = `task_status_${taskId}_${Date.now()}.json`;
            const uploadPath = `shared/inbox/${filename}`;

            const { error } = await this.supabaseClient.storage
                .from('sync-bucket')
                .upload(uploadPath, JSON.stringify(snapshot));

            if (error) {
                throw error;
            }

            console.log(`✅ Update de status da tarefa ${taskId} enviado para ${uploadPath}`);
            return { success: true, path: uploadPath };

        } catch (error) {
            console.error('❌ Erro ao enviar update de status da tarefa:', error);
            throw error;
        }
    }

    /**
     * Gera UUID v4 usando crypto.randomUUID() se disponível.
     * Fallback seguro com crypto.getRandomValues (nunca usa Math.random).
     */
    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            // Versão 4: bits 12-15 do time_hi_and_version field = 0100
            array[6] = (array[6] & 0x0f) | 0x40;
            // Variant: bits 6-7 do clock_seq_hi_and_reserved = 10
            array[8] = (array[8] & 0x3f) | 0x80;
            const hex = [...array].map(b => b.toString(16).padStart(2, '0')).join('');
            return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
        }
        // Fallback de emergência: lançar erro em vez de usar Math.random
        throw new Error('crypto.randomUUID e crypto.getRandomValues não estão disponíveis. Não é possível gerar UUID seguro.');
    }

    /**
     * Cria estrutura profissional do JSONB com base no tipo de formulário
     * @param {Object} formData - Dados originais do formulário
     * @returns {Object} Estrutura JSONB profissional
     */
    createProfessionalJSONB(formData) {
        const timestamp = new Date().toISOString();
        const formId = formData.formId || formData.formId || 'unknown';

        // Estrutura base profissional
        const professionalStructure = {
            metadata: {
                version: '2.0',
                schema: 'ecoforms-professional',
                created_at: timestamp,
                updated_at: timestamp,
                form_type: formId,
                sync_status: 'pending',
                source: 'mobile-app',
                quality: {
                    completeness: this.calculateCompleteness(formData),
                    validation_status: 'pending',
                    review_required: false
                }
            },
            usuario: {
                id: this.userId,
                nome: formData.usuario || formData.userName || 'Usuário',
                device_id: formData.deviceId || formData.device_id || null,
                perfil: this.getUserProfile()
            },
            localizacao: {
                timestamp: timestamp,
                origem: 'manual',
                confiabilidade: 'alta'
            }
        };

        // Processar dados específicos por tipo de formulário
        switch (formId) {
            case 'ecopontoForm':
                return {
                    ...professionalStructure,
                    atendimento: this.createProfessionalAtendimento(formData)
                };

            case 'ecopontoCaixasForm':
                return {
                    ...professionalStructure,
                    inspecao: this.createProfessionalInspecaoCaixas(formData)
                };

            default:
                return {
                    ...professionalStructure,
                    dados: this.createProfessionalGenericData(formData)
                };
        }
    }

    /**
     * Cria estrutura profissional para dados genéricos de formulário
     * @param {Object} formData - Dados do formulário
     * @returns {Object} Dados formatados
     */
    createProfessionalGenericData(formData) {
        const data = formData.data || formData;

        // Remove campos de controle e metadados, mantendo apenas dados do formulário
        const cleanData = {};
        const metadataFields = ['formId', 'formTitulo', 'tipo_form', 'usuario', 'user_id',
            'perfil', 'equipe', 'timestamp', 'device', 'incremental', 'activity_id'];

        for (const key in data) {
            if (data.hasOwnProperty(key) && !metadataFields.includes(key)) {
                cleanData[key] = data[key];
            }
        }

        return {
            campos: cleanData,
            resumo: {
                total_campos: Object.keys(cleanData).length,
                campos_preenchidos: Object.keys(cleanData).filter(k =>
                    cleanData[k] !== null && cleanData[k] !== undefined && cleanData[k] !== ''
                ).length
            }
        };
    }

    /**
     * Cria estrutura profissional para atendimento ecoponto
     */
    createProfessionalAtendimento(formData) {
        const data = formData.data || formData;

        return {
            identificacao: {
                placa_veiculo: this.normalizePlaca(data.placa),
                tipo_veiculo: this.detectVehicleType(data.placa),
                ecoponto: {
                    id: data.ecoponto,
                    nome: data.ecopontoLabel || data.ecoponto_nome || data.ecoponto,
                    bairro: data.bairro
                }
            },
            entrega: {
                timestamp: this.combineDateTime(data.data, data.hora),
                residuos: this.normalizeResiduos(data.residuos),
                quantidade_total: this.calculateTotalResiduos(data.residuos),
                classificacao: this.classifyEntrega(data.residuos)
            },
            validacao: {
                placa_valida: this.validatePlaca(data.placa),
                residuos_permitidos: this.validateResiduos(data.residuos),
                horario_permitido: this.validateHorario(data.hora)
            }
        };
    }

    /**
     * Cria estrutura profissional para inspeção de caixas
     */
    createProfessionalInspecaoCaixas(formData) {
        const data = formData.data || formData;
        const caixasList = data.caixas_list || {};

        return {
            ecoponto: {
                id: data.ecoponto,
                nome: data.ecopontoLabel || data.ecoponto_nome || data.ecoponto
            },
            ocupacao: {
                timestamp: data.timestamp || new Date().toISOString(),
                caixas: this.normalizeCaixasOcupacao(caixasList),
                resumo: {
                    total: 7,
                    preenchidas: Object.keys(caixasList.ocupacao || {}).length,
                    criticas: this.countCriticalBoxes(caixasList.ocupacao),
                    removidas: Object.keys(caixasList.removidas || {}).length,
                    taxa_ocupacao: this.calculateOccupancyRate(caixasList.ocupacao)
                }
            },
            evento: caixasList.incrementalEvento || null
        };
    }

    /**
     * Cria estrutura genérica profissional
     */
    createProfessionalGenericData(formData) {
        const data = formData.data || formData;

        return {
            original: data,
            processado: {
                campos_preenchidos: Object.keys(data).filter(key => data[key] !== null && data[key] !== undefined && data[key] !== '').length,
                campos_totais: Object.keys(data).length,
                campos_criticos: this.extractCriticalFields(data)
            }
        };
    }

    /**
     * Normaliza placa do veículo
     */
    normalizePlaca(placa) {
        if (!placa) return null;
        return placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    /**
     * Detecta tipo de veículo pela placa
     */
    detectVehicleType(placa) {
        if (!placa) return 'desconhecido';
        const placaLimpa = this.normalizePlaca(placa);

        // Mercosul: ABC1D23 (7 caracteres, 4ª é número)
        if (placaLimpa.length === 7 && /\d/.test(placaLimpa[3])) {
            return 'mercosul';
        }

        // Placa antiga: ABC1234 (7 caracteres, 4ª é letra)
        if (placaLimpa.length === 7 && /[A-Z]/.test(placaLimpa[3])) {
            return 'antiga';
        }

        return 'desconhecido';
    }

    /**
     * Valida placa
     */
    validatePlaca(placa) {
        if (!placa) return false;
        const placaLimpa = this.normalizePlaca(placa);

        // Mercosul ou antiga
        return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placaLimpa);
    }

    /**
     * Normaliza lista de resíduos
     */
    normalizeResiduos(residuos) {
        if (!residuos) return [];
        if (Array.isArray(residuos)) return residuos;
        if (typeof residuos === 'string') return residuos.split(',').map(r => r.trim());
        return [];
    }

    /**
     * Calcula total de resíduos
     */
    calculateTotalResiduos(residuos) {
        return this.normalizeResiduos(residuos).length;
    }

    /**
     * Classifica tipo de entrega
     */
    classifyEntrega(residuos) {
        const lista = this.normalizeResiduos(residuos);

        if (lista.length === 0) return 'vazia';
        if (lista.length === 1) return 'simples';
        if (lista.length <= 3) return 'mista';
        return 'complexa';
    }

    /**
     * Valida resíduos
     */
    validateResiduos(residuos) {
        const lista = this.normalizeResiduos(residuos);
        const permitidos = ['entulho', 'madeira', 'poda', 'reciclavel', 'rejeito', 'sucata', 'vidro'];

        return lista.every(residuo => permitidos.includes(residuo.toLowerCase()));
    }

    /**
     * Valida horário
     */
    validateHorario(hora) {
        if (!hora) return false;

        const [horas, minutos] = hora.split(':').map(Number);
        if (isNaN(horas) || isNaN(minutos)) return false;

        // Horário comercial: 7h às 18h
        return horas >= 7 && horas <= 18;
    }

    /**
     * Combina data e hora
     */
    combineDateTime(data, hora) {
        if (!data || !hora) return new Date().toISOString();

        try {
            const [ano, mes, dia] = data.split('-');
            const [horas, minutos] = hora.split(':');

            return new Date(ano, mes - 1, dia, horas, minutos).toISOString();
        } catch (error) {
            return new Date().toISOString();
        }
    }

    /**
     * Normaliza ocupação das caixas
     */
    normalizeCaixasOcupacao(caixasList) {
        const ocupacao = caixasList.ocupacao || {};
        const removidas = caixasList.removidas || {};

        const tiposCaixa = {
            1: { nome: 'Entulho', cor: 'bg-gray-500' },
            2: { nome: 'Madeira', cor: 'bg-amber-600' },
            3: { nome: 'Poda', cor: 'bg-green-600' },
            4: { nome: 'Reciclável', cor: 'bg-blue-500' },
            5: { nome: 'Rejeito', cor: 'bg-gray-600' },
            6: { nome: 'Sucata', cor: 'bg-yellow-500' },
            7: { nome: 'Vidro', cor: 'bg-cyan-500' }
        };

        return Object.keys(tiposCaixa).map(id => ({
            id: parseInt(id),
            nome: tiposCaixa[id].nome,
            cor: tiposCaixa[id].cor,
            ocupacao: ocupacao[id] || '',
            status: removidas[id] ? 'removida' : (ocupacao[id] ? 'ativa' : 'vazia'),
            nivel_critico: ocupacao[id] && parseInt(ocupacao[id]) >= 80
        }));
    }

    /**
     * Conta caixas críticas
     */
    countCriticalBoxes(ocupacao) {
        if (!ocupacao) return 0;
        return Object.values(ocupacao).filter(nivel => parseInt(nivel) >= 80).length;
    }

    /**
     * Calcula taxa de ocupação
     */
    calculateOccupancyRate(ocupacao) {
        if (!ocupacao || Object.keys(ocupacao).length === 0) return 0;

        const valores = Object.values(ocupacao).filter(v => v && v !== '');
        if (valores.length === 0) return 0;

        const total = valores.reduce((sum, nivel) => sum + parseInt(nivel) || 0, 0);
        return Math.round(total / valores.length);
    }

    /**
     * Calcula completude dos dados
     */
    calculateCompleteness(formData) {
        const data = formData.data || formData;
        const camposPreenchidos = Object.keys(data).filter(key => {
            const valor = data[key];
            return valor !== null && valor !== undefined && valor !== '';
        }).length;

        const camposTotais = Object.keys(data).length;
        return camposTotais > 0 ? Math.round((camposPreenchidos / camposTotais) * 100) : 0;
    }

    /**
     * Extrai campos críticos
     */
    extractCriticalFields(data) {
        const camposCriticos = ['placa', 'ecoponto', 'data', 'hora', 'residuos'];
        const encontrados = {};

        camposCriticos.forEach(campo => {
            if (data[campo] !== undefined && data[campo] !== null && data[campo] !== '') {
                encontrados[campo] = data[campo];
            }
        });

        return encontrados;
    }

    /**
     * Obtém perfil do usuário a partir do AuthManager
     */
    getUserProfile() {
        return window.authManager?.getCurrentUser()?.perfil ?? 'operador';
    }
}

// Instância global do serviço
const dataService = new DataService();

// SEMPRE exportar para window primeiro (para o browser)
if (typeof window !== 'undefined') {
    window.DataService = DataService;
    window.dataService = dataService;
    console.log('✅ DataService exposto globalmente:', typeof window.dataService);
}

// Exportar para uso em outros módulos (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataService, dataService };
}

// Auto-inicializar quando carregado
dataService.init().then(() => {
    console.log('✅ DataService inicializado com sucesso');
}).catch(err => {
    console.error('❌ Erro ao inicializar DataService:', err);
});