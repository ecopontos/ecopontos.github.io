/**
 * Smart Cache Service - Sistema inteligente de cache para JSONs
 * Carrega formulários e dados do Supabase Storage com cache local
 * Inclui fila de operações offline, resolução de conflitos e CRDTs leves
 */
class OperationQueue {
    constructor() {
        this.queue = [];
        this.storageKey = 'ecoforms_operation_queue';
        this.maxRetries = 3;
        this.isProcessing = false;
        this.loadFromStorage();
    }

    /**
     * Adiciona operação à fila
     * @param {string} type - CREATE/UPDATE/DELETE
     * @param {string} dataSource - ex: 'usuarios', 'form_data'
     * @param {string} recordId - ID único do registro
     * @param {object} data - dados da operação
     * @param {object} options - opções adicionais (version, conflictResolution, etc.)
     */
    addOperation(type, dataSource, recordId, data, options = {}) {
        const operation = {
            id: this.generateOperationId(),
            type: type.toUpperCase(),
            dataSource,
            recordId,
            data,
            timestamp: Date.now(),
            version: options.version || 1,
            conflictResolution: options.conflictResolution || 'timestamp', // 'timestamp', 'version', 'manual'
            retryCount: 0,
            status: 'pending', // 'pending', 'processing', 'completed', 'failed'
            error: null,
            ...options
        };

        this.queue.push(operation);
        this.saveToStorage();
        console.log(`📝 Operação ${type} adicionada à fila: ${dataSource}/${recordId}`);

        // Tentar processar imediatamente se online
        if (navigator.onLine) {
            this.processQueue();
        }

        return operation.id;
    }

    /**
     * Processa a fila de operações quando volta online
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        console.log(`🔄 Processando ${this.queue.length} operações na fila...`);

        try {
            const operationsToProcess = [...this.queue.filter(op => op.status === 'pending')];

            for (const operation of operationsToProcess) {
                try {
                    await this.processOperation(operation);
                    operation.status = 'completed';
                    console.log(`✅ Operação ${operation.type} processada: ${operation.dataSource}/${operation.recordId}`);
                } catch (error) {
                    operation.retryCount++;
                    operation.error = error.message;

                    if (operation.retryCount >= this.maxRetries) {
                        operation.status = 'failed';
                        console.error(`❌ Operação falhou definitivamente: ${operation.dataSource}/${operation.recordId}`, error);
                    } else {
                        operation.status = 'pending'; // retry later
                        console.warn(`⚠️ Operação falhou, tentando novamente (${operation.retryCount}/${this.maxRetries}): ${operation.dataSource}/${operation.recordId}`);
                    }
                }
            }

            // Limpar operações concluídas/expiradas
            this.cleanupQueue();
        } finally {
            // Garante que isProcessing seja resetado mesmo se cleanupQueue() lançar
            // ex: QuotaExceededError no localStorage
            this.isProcessing = false;
        }
    }

    /**
     * Processa uma operação individual
     */
    async processOperation(operation) {
        const { type, dataSource, recordId, data } = operation;

        // Usar o cliente Supabase do SmartCache
        const client = window.smartCache ? window.smartCache.getSupabaseClient() : null;

        if (!client) {
            throw new Error('Cliente Supabase não disponível');
        }

        switch (type) {
            case 'CREATE':
                await this.handleCreate(client, dataSource, data, operation);
                break;
            case 'UPDATE':
                await this.handleUpdate(client, dataSource, recordId, data, operation);
                break;
            case 'DELETE':
                await this.handleDelete(client, dataSource, recordId, operation);
                break;
            default:
                throw new Error(`Tipo de operação desconhecido: ${type}`);
        }
    }

    /**
     * Trata operação CREATE com resolução de conflitos
     */
    async handleCreate(client, dataSource, data, operation) {
        try {
            // Verificar se já existe (conflito)
            const existing = await client
                .from(dataSource)
                .select('*')
                .eq('id', data.id)
                .single();

            if (existing.data) {
                // Conflito! Resolver baseado na estratégia
                await this.resolveConflict(operation, existing.data, data, 'create');
            } else {
                // Criar normalmente
                const { error } = await client
                    .from(dataSource)
                    .insert([data]);

                if (error) throw error;
            }
        } catch (error) {
            if (error.code === 'PGRST116') { // Not found, ok to create
                const { error: insertError } = await client
                    .from(dataSource)
                    .insert([data]);

                if (insertError) throw insertError;
            } else {
                throw error;
            }
        }
    }

    /**
     * Trata operação UPDATE com resolução de conflitos
     */
    async handleUpdate(client, dataSource, recordId, data, operation) {
        // Buscar versão atual
        const { data: currentData, error: fetchError } = await client
            .from(dataSource)
            .select('*')
            .eq('id', recordId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        if (currentData) {
            // Verificar conflitos baseado na estratégia
            const hasConflict = this.detectConflict(operation, currentData, data);

            if (hasConflict) {
                await this.resolveConflict(operation, currentData, data, 'update');
            } else {
                // Atualizar normalmente
                const { error } = await client
                    .from(dataSource)
                    .update(data)
                    .eq('id', recordId);

                if (error) throw error;
            }
        } else {
            // Registro não existe, talvez criar?
            console.warn(`Registro ${recordId} não encontrado para UPDATE, criando...`);
            await this.handleCreate(client, dataSource, { ...data, id: recordId }, operation);
        }
    }

    /**
     * Trata operação DELETE
     */
    async handleDelete(client, dataSource, recordId, operation) {
        const { error } = await client
            .from(dataSource)
            .delete()
            .eq('id', recordId);

        if (error) throw error;
    }

    /**
     * Detecta conflitos baseado na estratégia configurada
     */
    detectConflict(operation, serverData, localData) {
        const strategy = operation.conflictResolution;

        switch (strategy) {
            case 'timestamp':
                return (serverData.updated_at && localData.updated_at &&
                    new Date(serverData.updated_at) > new Date(localData.updated_at));

            case 'version':
                return (serverData.version && localData.version &&
                    serverData.version > localData.version);

            case 'manual':
                return true; // Sempre considerar conflito para resolução manual

            default:
                return false;
        }
    }

    /**
     * Resolve conflitos baseado na estratégia
     */
    async resolveConflict(operation, serverData, localData, operationType) {
        const strategy = operation.conflictResolution;

        console.warn(`⚠️ Conflito detectado em ${operation.dataSource}/${operation.recordId} (${strategy})`);

        switch (strategy) {
            case 'timestamp':
                // Usar dados mais recentes
                const serverTime = new Date(serverData.updated_at || 0);
                const localTime = new Date(localData.updated_at || 0);

                if (serverTime > localTime) {
                    console.log('📅 Servidor mais recente, mantendo dados do servidor');
                    return; // Não fazer nada, servidor já tem dados mais recentes
                } else {
                    console.log('📅 Local mais recente, sobrescrevendo servidor');
                    await this.forceUpdate(window.smartCache.getSupabaseClient(), operation.dataSource, operation.recordId, localData);
                }
                break;

            case 'version':
                if ((serverData.version || 0) > (localData.version || 0)) {
                    console.log('🔢 Versão do servidor mais recente, mantendo dados do servidor');
                    return;
                } else {
                    console.log('🔢 Versão local mais recente, sobrescrevendo servidor');
                    await this.forceUpdate(window.smartCache.getSupabaseClient(), operation.dataSource, operation.recordId, localData);
                }
                break;

            case 'manual':
                // Para resolução manual, armazenar conflito para usuário decidir
                this.storeConflictForManualResolution(operation, serverData, localData);
                break;

            default:
                // Estratégia padrão: sobrescrever com dados locais
                await this.forceUpdate(window.smartCache.getSupabaseClient(), operation.dataSource, operation.recordId, localData);
        }
    }

    /**
     * Força atualização ignorando conflitos
     */
    async forceUpdate(client, dataSource, recordId, data) {
        const { error } = await client
            .from(dataSource)
            .upsert([data], { onConflict: 'id' });

        if (error) throw error;
    }

    /**
     * Armazena conflito para resolução manual (localStorage + Supabase)
     */
    storeConflictForManualResolution(operation, serverData, localData) {
        const conflict = {
            id: `conflict_${Date.now()}`,
            operationId: operation.id,
            dataSource: operation.dataSource,
            recordId: operation.recordId,
            serverData,
            localData,
            timestamp: Date.now(),
            resolved: false
        };

        const conflicts = JSON.parse(localStorage.getItem('ecoforms_conflicts') || '[]');
        conflicts.push(conflict);
        localStorage.setItem('ecoforms_conflicts', JSON.stringify(conflicts));

        // Notificar usuário sobre conflito
        if (window.notificationService) {
            window.notificationService.notifyConflict(conflict);
        }
    }


    /**
     * Gera ID único para operações
     */
    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Salva fila no localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Erro ao salvar fila de operações:', error);
        }
    }

    /**
     * Carrega fila do localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.queue = JSON.parse(stored);
                console.log(`📋 Carregadas ${this.queue.length} operações da fila`);
            }
        } catch (error) {
            console.error('Erro ao carregar fila de operações:', error);
            this.queue = [];
        }
    }

    /**
     * Limpa operações concluídas/expiradas (manter últimas 1000)
     */
    cleanupQueue() {
        // Manter apenas operações recentes e falhas para análise
        const maxOperations = 1000;
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 dias

        this.queue = this.queue
            .filter(op => op.status === 'failed' || op.timestamp > cutoffTime)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, maxOperations);

        this.saveToStorage();
    }

    /**
     * Retorna estatísticas da fila
     */
    getStats() {
        const stats = {
            total: this.queue.length,
            pending: this.queue.filter(op => op.status === 'pending').length,
            processing: this.queue.filter(op => op.status === 'processing').length,
            completed: this.queue.filter(op => op.status === 'completed').length,
            failed: this.queue.filter(op => op.status === 'failed').length
        };

        return stats;
    }
}

/**
 * CRDTs leves para campos simples
 */
class SimpleCRDT {
    static mergeBoolean(local, server) {
        // Last Write Wins para booleanos
        return local.timestamp > server.timestamp ? local.value : server.value;
    }

    static mergeCounter(local, server) {
        // Soma para contadores
        return Math.max(local.value, server.value);
    }

    static mergeString(local, server) {
        // Last Write Wins para strings
        return local.timestamp > server.timestamp ? local.value : server.value;
    }

    static mergeArray(local, server) {
        // Merge de arrays (união sem duplicatas)
        const combined = [...local.value, ...server.value];
        return [...new Set(combined)];
    }
}

class SmartCacheService {
    constructor() {
        this.cache = {
            forms: new Map(),
            data: new Map()
        };
        this.storagePrefix = 'ecoforms_cache_';
        this.bucketName = 'sync-bucket'; // Bucket padrão do projeto EcoForms
        this.supabaseClient = null; // will use global client if available, otherwise use backend proxy endpoints
        this._isRefreshingExpired = false;
        this._lastRefreshStats = { refreshed: 0, failed: 0, pending: 0, timestamp: null };

        // NOVO: Fila de operações para sincronização offline/online
        this.operationQueue = new OperationQueue();

        // NOVO: Indicadores visuais de sincronização
        this.syncIndicators = new Map(); // Map<elementId, {status, lastUpdate, element}>

        // Integração com SystemConfig para versionamento e tracking
        this.systemConfig = null;
        if (typeof window !== 'undefined' && window.systemConfig) {
            this.systemConfig = window.systemConfig;
            console.log('📋 SmartCache integrado com SystemConfig');
        }
        // ALTERAÇÃO 2: Opção para desabilitar cache durante desenvolvimento
        // Adicionado: this.disableCache baseado no parâmetro URL 'dev_nocache=1'
        // Quando ativo: pula carregamento do cache e não salva novos dados
        // Para reverter: Remover linhas relacionadas a this.disableCache
        // Uso: http://127.0.0.1:5500/www/index.html?dev_nocache=1
        this.disableCache = new URLSearchParams(window.location.search).get('dev_nocache') === '1';
        if (this.disableCache) console.log('🚫 Cache desabilitado para desenvolvimento');
        this.initSupabase();

        // Quando voltar online, tentar atualizar caches expirados em background
        try {
            if (typeof window !== 'undefined' && window.addEventListener) {
                window.addEventListener('online', () => {
                    // Fire-and-forget background refresh
                    this.onOnline();
                });
            }
        } catch (e) {
            // ignore
        }

        // Listen for special file inputs with id pattern 'upload_<dataSource>' to allow data source updates
        try {
            if (typeof document !== 'undefined' && document.addEventListener) {
                document.addEventListener('change', async (ev) => {
                    try {
                        const target = ev.target;
                        if (!target || target.tagName !== 'INPUT' || target.type !== 'file' || !target.id) return;
                        if (!target.id.startsWith('upload_')) return;
                        const ds = target.id.replace(/^upload_/, '');
                        const file = (target.files && target.files[0]) || null;
                        if (!file) return;
                        console.log(`📥 Arquivo detectado para atualização de dataSource '${ds}': ${file.name}`);
                        // process in background
                        this.updateDataSourceFromFile(ds, file, { uploadToStorage: true }).then(result => {
                            console.log('✅ Atualização de dataSource concluída', ds, result);
                            // notify listeners
                            window.dispatchEvent(new CustomEvent('dataSourceUpdated', { detail: { dataSource: ds, result } }));
                        }).catch(err => {
                            console.error('❌ Erro ao atualizar dataSource a partir de arquivo:', err);
                            window.dispatchEvent(new CustomEvent('dataSourceUpdateFailed', { detail: { dataSource: ds, error: err } }));
                        });
                    } catch (e) {
                        // swallow
                    }
                });
            }
        } catch (e) {
            // ignore
        }
    }

    async initSupabase() {
        try {
            // Prefer existing global singleton or helper factories
            if (window.globalSupabaseClient) {
                this.supabaseClient = window.globalSupabaseClient;
                console.log('📦 SmartCache usando cliente Supabase singleton existente');
                return;
            }

            if (window.getSupabaseClientSync) {
                try {
                    const client = window.getSupabaseClientSync();
                    if (client) {
                        this.supabaseClient = client;
                        window.globalSupabaseClient = client;
                        console.log('📦 SmartCache obteve cliente Supabase via getSupabaseClientSync');
                        return;
                    }
                } catch (e) {
                    // ignore
                }
            }

            // If no client available, fall back to backend proxy endpoints for storage operations
            if (!this.supabaseClient) {
                console.warn('⚠️ SmartCache: cliente Supabase não disponível no cliente. Storage usará /api/upload e /api/signed-url quando suportado.');
            }
        } catch (e) {
            console.warn('Erro initSupabase', e);
        }
    }

    /**
     * Obtém cliente Supabase, com fallback lazy para globais
     */
    getSupabaseClient() {
        if (this.supabaseClient) return this.supabaseClient;

        // Tentar obter da window global
        if (window.globalSupabaseClient) {
            this.supabaseClient = window.globalSupabaseClient;
            return this.supabaseClient;
        }

        // Tentar obter via factory global (sync)
        if (window.getSupabaseClientSync) {
            try {
                const client = window.getSupabaseClientSync();
                if (client) {
                    this.supabaseClient = client;
                    return this.supabaseClient;
                }
            } catch (e) {
                // ignore
            }
        }

        // Tentar obter do AuthManager
        if (window.authManager && window.authManager.supabaseClient) {
            this.supabaseClient = window.authManager.supabaseClient;
            return this.supabaseClient;
        }

        return null;
    }

    /**
     * Salva dados no cache (memória + localStorage)
     * @param {string} type - 'forms' ou 'data'
     * @param {string} id - ID do item
     * @param {object} data - Dados a serem salvos
     * @param {number} ttl - Time to live em milissegundos (padrão: 24h)
     */
    saveToCache(type, id, data, ttl = 24 * 60 * 60 * 1000) {
        if (this.disableCache) {
            console.log(`🚫 Cache desabilitado - não salvando ${type}/${id}`);
            return;
        }

        try {
            // Salvar no cache em memória
            if (this.cache[type]) {
                this.cache[type].set(id, data);
            }

            // Salvar no localStorage
            const cacheKey = `${this.storagePrefix}${type}_${id}`;
            const cacheData = {
                data: data,
                timestamp: Date.now(),
                cachedAt: Date.now(),
                expires: Date.now() + ttl,
                version: data.version || data._version || 1
            };

            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log(`💾 ${type}/${id} salvo no cache (expira em ${new Date(cacheData.expires).toLocaleString()})`);
        } catch (error) {
            console.warn(`⚠️ Erro ao salvar ${type}/${id} no cache:`, error);
        }
    }

    /**
     * Recupera dados do cache (memória ou localStorage)
     * @param {string} type - 'forms' ou 'data'
     * @param {string} id - ID do item
     * @returns {object|null} - Dados do cache ou null se não encontrado/expirado
     */
    getFromCache(type, id) {
        if (this.disableCache) {
            console.log(`🚫 Cache desabilitado - não lendo ${type}/${id}`);
            return null;
        }

        try {
            // Tentar cache em memória primeiro
            if (this.cache[type] && this.cache[type].has(id)) {
                const data = this.cache[type].get(id);
                console.log(`📦 ${type}/${id} recuperado do cache em memória`);
                return data;
            }

            // Tentar localStorage
            const cacheKey = `${this.storagePrefix}${type}_${id}`;
            const cachedItem = localStorage.getItem(cacheKey);

            if (!cachedItem) {
                return null;
            }

            const parsedItem = JSON.parse(cachedItem);

            // Verificar expiração
            const now = Date.now();
            if (now > parsedItem.expires) {
                console.log(`⏰ Cache expirado para ${type}/${id}`);
                localStorage.removeItem(cacheKey);
                return null;
            }

            // Restaurar no cache em memória
            if (this.cache[type]) {
                this.cache[type].set(id, parsedItem.data);
            }

            console.log(`📦 ${type}/${id} recuperado do localStorage`);
            return parsedItem.data;
        } catch (error) {
            console.warn(`⚠️ Erro ao recuperar ${type}/${id} do cache:`, error);
            return null;
        }
    }

    /**
     * Invalida o cache (remove itens locais e da memória)
     * @param {string} type - 'forms', 'data', ou 'all'
     * @param {string} id - Opcional: ID específico para remover
     */
    invalidateCache(type = 'all', id = null) {
        console.log(`🧹 Invalidando cache: ${type}${id ? '/' + id : ''}`);

        const clearType = (targetType) => {
            // Limpar memória
            if (this.cache[targetType]) {
                if (id) {
                    this.cache[targetType].delete(id);
                } else {
                    this.cache[targetType].clear();
                }
            }

            // Limpar localStorage
            const prefix = `${this.storagePrefix}${targetType}_`;
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(prefix)) {
                    if (id) {
                        if (key === `${prefix}${id}`) localStorage.removeItem(key);
                    } else {
                        localStorage.removeItem(key);
                    }
                }
            });
        };

        if (type === 'all') {
            clearType('forms');
            clearType('data');
            // Limpar metadados de conflitos também? Talvez não.
        } else {
            clearType(type);
        }

        console.log('✅ Cache invalidado com sucesso');
    }



    /**
     * NOVO: Adiciona operação à fila para sincronização offline
     * @param {string} type - CREATE/UPDATE/DELETE
     * @param {string} dataSource - tabela/coleção
     * @param {string} recordId - ID do registro
     * @param {object} data - dados da operação
     * @param {object} options - opções (version, conflictResolution, etc.)
     */
    addOfflineOperation(type, dataSource, recordId, data, options = {}) {
        // Adicionar timestamp e versão se não fornecidos
        if (!data.updated_at) {
            data.updated_at = new Date().toISOString();
        }
        if (!data.version) {
            data.version = (options.version || 1);
        }

        const operationId = this.operationQueue.addOperation(type, dataSource, recordId, data, options);

        // Atualizar indicadores visuais
        this.updateSyncIndicator(`${dataSource}_${recordId}`, 'pending');

        return operationId;
    }

    /**
     * NOVO: Processa fila de operações quando volta online
     */
    async processOfflineQueue() {
        console.log('🔄 Processando fila de operações offline...');
        await this.operationQueue.processQueue();

        // Atualizar estatísticas
        const stats = this.operationQueue.getStats();
        console.log(`📊 Estatísticas da fila:`, stats);

        // Notificar sobre processamento concluído
        if (window.notificationService) {
            window.notificationService.notifyQueueProcessed(stats);
        }
    }

    /**
     * NOVO: Cria/atualiza indicador visual de sincronização
     * @param {string} elementId - ID do elemento HTML
     * @param {string} status - 'synced', 'pending', 'error', 'offline'
     * @param {object} metadata - metadados adicionais
     */
    updateSyncIndicator(elementId, status, metadata = {}) {
        const indicator = this.syncIndicators.get(elementId) || {};

        // Criar ou atualizar elemento visual
        let element = indicator.element;
        if (!element) {
            element = document.createElement('span');
            element.className = 'sync-indicator';
            element.id = `sync_${elementId}`;

            // Tentar encontrar elemento pai para inserir o indicador
            const parentElement = document.getElementById(elementId) ||
                document.querySelector(`[data-record-id="${elementId}"]`);
            if (parentElement) {
                parentElement.appendChild(element);
            }
        }

        // Atualizar classes e conteúdo baseado no status
        element.className = 'sync-indicator';

        switch (status) {
            case 'synced':
                element.classList.add('synced');
                element.innerHTML = '✅';
                element.title = `Sincronizado em ${new Date().toLocaleString()}`;
                break;

            case 'pending':
                element.classList.add('pending');
                element.innerHTML = '⏳';
                element.title = 'Aguardando sincronização';
                break;

            case 'error':
                element.classList.add('error');
                element.innerHTML = '❌';
                element.title = `Erro: ${metadata.error || 'Falha na sincronização'}`;
                break;

            case 'offline':
                element.classList.add('offline');
                element.innerHTML = '📴';
                element.title = 'Modo offline - será sincronizado quando online';
                break;

            default:
                element.innerHTML = '❓';
                element.title = 'Status desconhecido';
        }

        // Atualizar registro
        this.syncIndicators.set(elementId, {
            status,
            lastUpdate: Date.now(),
            element,
            metadata
        });
    }

    /**
     * NOVO: Remove indicador visual
     */
    removeSyncIndicator(elementId) {
        const indicator = this.syncIndicators.get(elementId);
        if (indicator && indicator.element) {
            indicator.element.remove();
        }
        this.syncIndicators.delete(elementId);
    }

    /**
     * NOVO: Aplica CRDT para merge de dados conflitantes
     * @param {string} fieldType - 'boolean', 'counter', 'string', 'array'
     * @param {object} localData - {value, timestamp}
     * @param {object} serverData - {value, timestamp}
     */
    applyCRDT(fieldType, localData, serverData) {
        switch (fieldType) {
            case 'boolean':
                return SimpleCRDT.mergeBoolean(localData, serverData);
            case 'counter':
                return SimpleCRDT.mergeCounter(localData, serverData);
            case 'string':
                return SimpleCRDT.mergeString(localData, serverData);
            case 'array':
                return SimpleCRDT.mergeArray(localData, serverData);
            default:
                // Fallback para Last Write Wins
                return localData.timestamp > serverData.timestamp ? localData.value : serverData.value;
        }
    }

    /**
     * Handler chamado quando o dispositivo volta online.
     * Processa fila de operações offline e refresh de caches expirados.
     */
    async onOnline() {
        console.log('📡 Conexão restaurada - processando operações offline...');

        // Processar fila de operações offline
        try {
            await this.processOfflineQueue();
        } catch (e) {
            console.warn('⚠️ Erro ao processar fila offline:', e);
        }

        // Refresh de caches expirados (com guard contra execução simultânea)
        if (!this.disableCache && !this._isRefreshingExpired) {
            this._isRefreshingExpired = true;
            try {
                await this.refreshExpiredCaches({ concurrency: 3, maxRetries: 3 });
                console.log('✅ Refresh de caches expirados finalizado');
            } catch (e) {
                console.warn('⚠️ Erro no refresh de caches expirados:', e);
            } finally {
                this._isRefreshingExpired = false;
            }
        }
    }

    /**
     * NOVO: Retorna estatísticas da sincronização
     */
    getSyncStats() {
        const queueStats = this.operationQueue.getStats();
        const indicators = Array.from(this.syncIndicators.values());

        return {
            queue: queueStats,
            indicators: {
                total: indicators.length,
                synced: indicators.filter(i => i.status === 'synced').length,
                pending: indicators.filter(i => i.status === 'pending').length,
                error: indicators.filter(i => i.status === 'error').length,
                offline: indicators.filter(i => i.status === 'offline').length
            },
            conflicts: JSON.parse(localStorage.getItem('ecoforms_conflicts') || '[]').length
        };
    }

    /**
     * NOVO: Resolve conflito manualmente
     * @param {string} conflictId - ID do conflito
     * @param {string} resolution - 'local', 'server', 'merge'
     * @param {object} customData - dados customizados para resolução
     */
    async resolveConflict(conflictId, resolution, customData = {}) {
        const conflicts = JSON.parse(localStorage.getItem('ecoforms_conflicts') || '[]');
        const conflictIndex = conflicts.findIndex(c => c.id === conflictId);

        if (conflictIndex === -1) {
            throw new Error(`Conflito ${conflictId} não encontrado`);
        }

        const conflict = conflicts[conflictIndex];
        let resolvedData;

        switch (resolution) {
            case 'local':
                resolvedData = conflict.localData;
                break;
            case 'server':
                resolvedData = conflict.serverData;
                break;
            case 'merge':
                resolvedData = this.mergeConflictData(conflict.localData, conflict.serverData, customData);
                break;
            default:
                throw new Error(`Resolução inválida: ${resolution}`);
        }

        // Aplicar resolução
        await this.operationQueue.resolveConflict(conflict, resolvedData);

        // Remover conflito da lista
        conflicts.splice(conflictIndex, 1);
        localStorage.setItem('ecoforms_conflicts', JSON.stringify(conflicts));

        // Atualizar indicador
        this.updateSyncIndicator(`${conflict.dataSource}_${conflict.recordId}`, 'synced');

        // Notificar resolução
        if (window.notificationService) {
            window.notificationService.notifyConflictResolved(conflictId, resolution);
        }

        return resolvedData;
    }

    /**
     * NOVO: Merge inteligente de dados conflitantes
     */
    mergeConflictData(localData, serverData, customData = {}) {
        const merged = { ...serverData };

        // Aplicar CRDTs para campos específicos
        Object.keys(localData).forEach(field => {
            if (customData[field] && customData[field].resolution) {
                // Resolução customizada por campo
                switch (customData[field].resolution) {
                    case 'local':
                        merged[field] = localData[field];
                        break;
                    case 'server':
                        // Já está no merged
                        break;
                    case 'custom':
                        merged[field] = customData[field].value;
                        break;
                }
            } else {
                // Aplicar CRDT automático baseado no tipo
                const fieldType = this.inferFieldType(localData[field]);
                merged[field] = this.applyCRDT(fieldType, {
                    value: localData[field],
                    timestamp: localData.updated_at || Date.now()
                }, {
                    value: serverData[field],
                    timestamp: serverData.updated_at || Date.now()
                });
            }
        });

        merged.updated_at = new Date().toISOString();
        merged.version = Math.max(localData.version || 1, serverData.version || 1) + 1;

        return merged;
    }

    /**
     * NOVO: Infere tipo de campo para CRDT
     */
    inferFieldType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'counter';
        if (typeof value === 'string') return 'string';
        if (Array.isArray(value)) return 'array';
        return 'string'; // fallback
    }

    /**
     * NOVO: Lista conflitos pendentes
     */
    getPendingConflicts() {
        return JSON.parse(localStorage.getItem('ecoforms_conflicts') || '[]');
    }

    /**
     * NOVO: Limpa conflitos resolvidos automaticamente
     */
    clearResolvedConflicts() {
        const conflicts = this.getPendingConflicts();
        const activeConflicts = conflicts.filter(c => !c.resolved);
        localStorage.setItem('ecoforms_conflicts', JSON.stringify(activeConflicts));
    }

    /**
     * Carrega um formulário - comportamento baseado na preferência de fonte
     * Preferências:
     * - 'auto': setup cache → local cache → Supabase (padrão)
     * - 'local_only': setup cache → local cache → erro (não tenta Supabase)
     * - 'supabase_first': Supabase → setup cache → local cache
     * Agora com versionamento e metadados
     */

    /**
     * Carrega um formulário - comportamento baseado na preferência de fonte
     * Preferências:
     * - 'auto': setup cache → local cache → Supabase (padrão)
     * - 'local_only': setup cache → local cache → erro (não tenta Supabase)
     * - 'supabase_first': Supabase → setup cache → local cache
     * Agora com versionamento e metadados
     */

    /**
     * Carrega um formulário - comportamento baseado na preferência de fonte
     * Preferências:
     * - 'auto': setup cache → local cache → Supabase (padrão)
     * - 'local_only': setup cache → local cache → erro (não tenta Supabase)
     * - 'supabase_first': Supabase → setup cache → local cache
     * Agora com versionamento e metadados
     */
    /**
     * NOVO: Baixa arquivos compartilhados (form_registry, data_registry, users)
     * Não requer compressão pois o Desktop envia raw JSON para compatibilidade.
     */
    async fetchSharedFile(filename) {
        try {
            const client = this.getSupabaseClient();
            if (!client) {
                console.warn(`⚠️ Cliente Supabase não disponível para baixar ${filename}`);
                return null;
            }

            console.log(`📥 Baixando arquivo compartilhado: ${filename}...`);
            const { data, error } = await client.storage
                .from('sync-bucket') // Nome do bucket fixo conforme desktop
                .download(`shared/${filename}`);

            if (error) throw error;

            const text = await data.text();

            // Tentar parsear o snapshot wrapper se existir, ou raw array
            const json = JSON.parse(text);

            // Verificar se é um wrapper de snapshot (sync-v1)
            // O desktop envia: { form_registry: [...], ... } dentro de um snapshot wrapper
            // Snapshot format: { version, data: { form_registry: [] }, metadata: ... }
            if (json.data && (json.data.form_registry || json.data.data_registry || json.data.usuarios)) {
                return json.data;
            }

            return json; // Fallback se for raw array direto
        } catch (error) {
            console.warn(`⚠️ Falha ao baixar ${filename}:`, error.message);
            return null;
        }
    }

    /**
     * Carrega um formulário - comportamento baseado na preferência de fonte
     * Preferências:
     * - 'auto': setup cache → local cache → Supabase Storage (shared/form_registry.json)
     * - 'local_only': setup cache → local cache → erro
     * - 'supabase_first': Supabase Storage → setup cache → local cache
     */
    async loadForm(formId) {
        const startTime = Date.now();
        let version = null;
        let form = null;
        let source = 'unknown';
        const preference = this.getFormSourcePreference();

        formId = String(formId || '').replace(/\.json$/i, '');
        console.log(`📋 Carregando formulário ${formId} com preferência: ${preference}`);

        // MODO: supabase_first - tentar Supabase primeiro
        if (preference === 'supabase_first') {
            try {
                console.log(`📥 [supabase_first] Buscando em shared/form_registry.json...`);

                // Baixar registro mestre
                const registryData = await this.fetchSharedFile('form_registry.json');
                const forms = registryData?.form_registry || [];

                // Encontrar formulário específico
                const formRecord = forms.find(f => f.form_id === formId);

                if (!formRecord) {
                    const fallback = this.loadLocalFallback(formId, startTime);
                    if (fallback) return fallback;
                    throw new Error(`Formulário ${formId} não encontrado no form_registry remoto`);
                }

                // Parsear conteúdo se for string
                const form = typeof formRecord.conteudo === 'string'
                    ? JSON.parse(formRecord.conteudo)
                    : formRecord.conteudo;

                // Injetar versão
                if (!form.version && formRecord.versao) form.version = formRecord.versao;
                source = 'supabase_storage';

                // Adicionar metadados de versionamento
                if (this.systemConfig && typeof this.systemConfig.getFormVersion === 'function') {
                    version = this.systemConfig.getFormVersion(formId);
                    if (version) {
                        form._version = version;
                        form._lastUpdated = new Date().toISOString();
                        form._source = 'supabase';
                    }
                }

                // Salvar no cache
                if (!this.disableCache) this.saveToCache('forms', formId, form);

                // Registrar sucesso
                if (this.systemConfig && typeof this.systemConfig.recordSyncEvent === 'function') {
                    this.systemConfig.recordSyncEvent('form_loaded', {
                        formId,
                        version: version || 'unknown',
                        source,
                        loadTime: Date.now() - startTime
                    });
                }

                return form;
            } catch (supabaseError) {
                console.warn(`⚠️ [supabase_first] Supabase falhou, tentando caches locais:`, supabaseError.message);
                // Fallback para caches locais
            }
        }

        // MODO: auto - Comportamento híbrido (Network First se online, Cache First se offline)
        if (preference === 'auto') {
            const isOnline = this.isOnline();

            // Se estiver online, tentar Supabase primeiro (Network First) para garantir frescor
            if (isOnline) {
                try {
                    console.log(`🌐 [auto/online] Buscando formulário ${formId} atualizado...`);
                    const registryData = await this.fetchSharedFile('form_registry.json');
                    const forms = registryData?.form_registry || [];
                    const formRecord = forms.find(f => f.form_id === formId);

                    if (formRecord) {
                        const form = typeof formRecord.conteudo === 'string'
                            ? JSON.parse(formRecord.conteudo)
                            : formRecord.conteudo;

                        if (!form.version && formRecord.versao) form.version = formRecord.versao;
                        source = 'supabase_storage';

                        // Injetar metadados
                        if (this.systemConfig && typeof this.systemConfig.getFormVersion === 'function') {
                            version = this.systemConfig.getFormVersion(formId);
                            if (version) {
                                form._version = version;
                                form._lastUpdated = new Date().toISOString();
                                form._source = 'supabase';
                            }
                        }

                        // Atualizar cache
                        if (!this.disableCache) this.saveToCache('forms', formId, form);

                        console.log(`✅ [auto/online] Formulário ${formId} atualizado e salvo no cache`);
                        return form;
                    } else {
                        const fallback = this.loadLocalFallback(formId, startTime);
                        if (fallback) return fallback;
                    }
                } catch (networkError) {
                    console.warn(`⚠️ [auto/online] Falha na rede, revertendo para cache local:`, networkError);
                    // Falha silenciosa, continua para lógica de cache abaixo
                }
            } else {
                console.log(`📱 [auto/offline] Dispositivo offline, buscando do cache local...`);
            }
        }

        // 1. Tentar dados instalados durante setup (localStorage)
        if (!this.disableCache) {
            const setupCacheKey = `ecoforms_cache_forms_${formId}.json`;
            const setupCacheData = localStorage.getItem(setupCacheKey);

            if (setupCacheData) {
                try {
                    const cache = JSON.parse(setupCacheData);
                    // Se preference force 'local_only', ignorar expiração do setup se não houver outro
                    const isValid = (cache.data && Date.now() < cache.expires);

                    if (isValid) {
                        console.log(`📱 Formulário ${formId} carregado do cache de setup`);
                        return cache.data;
                    } else {
                        // Cache expirado, remover
                        localStorage.removeItem(setupCacheKey);
                    }
                } catch (error) {
                    localStorage.removeItem(setupCacheKey);
                }
            }
        }

        // 2. Tentar cache local standard
        if (!this.disableCache) {
            form = this.getFromCache('forms', formId);
            if (form) {
                console.log(`📋 Formulário ${formId} carregado do cache local`);
                source = 'local_cache';
                return form;
            }
        }

        // MODO: local_only ou Falha de Cache - Erro se não encontrado
        if (preference === 'local_only') {
            const error = new Error(`Formulário ${formId} não encontrado em caches locais (modo local_only)`);
            console.error(`❌ [local_only] ${error.message}`);
            throw error;
        }

        // 3. Carregar do Supabase Storage ('auto' mode default)
        try {
            console.log(`📥 Buscando formulário ${formId} em shared/form_registry.json...`);

            const registryData = await this.fetchSharedFile('form_registry.json');
            const forms = registryData?.form_registry || [];

            const formRecord = forms.find(f => f.form_id === formId);

            if (!formRecord) {
                const fallback = this.loadLocalFallback(formId, startTime);
                if (fallback) return fallback;
                throw new Error(`Formulário ${formId} não encontrado no form_registry remoto`);
            }

            form = typeof formRecord.conteudo === 'string'
                ? JSON.parse(formRecord.conteudo)
                : formRecord.conteudo;

            if (!form.version && formRecord.versao) form.version = formRecord.versao;
            source = 'supabase_storage';

            // Adicionar metadados
            if (this.systemConfig && typeof this.systemConfig.getFormVersion === 'function') {
                version = this.systemConfig.getFormVersion(formId);
                if (version) {
                    form._version = version;
                    form._lastUpdated = new Date().toISOString();
                    form._source = 'supabase';
                }
            }

            // Salvar no cache (se não desabilitado)
            if (!this.disableCache) this.saveToCache('forms', formId, form);
            console.log(`✅ Formulário ${formId} salvo no cache local`);

            // Registrar carregamento bem-sucedido
            if (this.systemConfig && typeof this.systemConfig.recordSyncEvent === 'function') {
                this.systemConfig.recordSyncEvent('form_loaded', {
                    formId,
                    version: version || 'unknown',
                    source,
                    loadTime: Date.now() - startTime
                });
            }

            return form;
        } catch (error) {
            console.error(`❌ Erro ao carregar formulário ${formId} do Storage:`, error);
            const fallback = this.loadLocalFallback(formId, startTime);
            if (fallback) return fallback;
            throw new Error(`Formulário ${formId} não encontrado no Supabase Storage`);
        }
    }

    getLocalFallbackDefinition(formId) {
        if (typeof window === 'undefined' || !window.localFormBackups) return null;
        const normalizedId = String(formId || '').replace(/\.json$/i, '');
        const forms = window.localFormBackups.forms || {};
        return forms[normalizedId] || forms[normalizedId.toLowerCase()] || null;
    }

    loadLocalFallback(formId, startTime) {
        const definition = this.getLocalFallbackDefinition(formId);
        if (!definition) return null;
        const fallback = JSON.parse(JSON.stringify(definition));
        fallback._source = 'local_fallback';
        fallback._version = fallback._version || fallback.version || 'local';
        if (!this.disableCache) this.saveToCache('forms', formId, fallback);
        if (this.systemConfig && typeof this.systemConfig.recordSyncEvent === 'function') {
            this.systemConfig.recordSyncEvent('form_loaded', {
                formId,
                version: fallback._version,
                source: 'local_fallback',
                loadTime: Date.now() - startTime
            });
        }
        console.warn(`🛠️ Formulário ${formId} carregado via fallback local`);
        return fallback;
    }

    /**
     * Carrega dados de referência - primeiro do cache de setup, depois cache, depois Supabase Storage
     */
    async loadDataSource(dataSource) {
        // Validar parâmetro
        if (!dataSource || dataSource === 'undefined') {
            console.warn('⚠️ loadDataSource chamado com parâmetro inválido:', dataSource);
            return [];
        }

        // 1. Tentar dados instalados durante setup (localStorage)
        if (!this.disableCache) {
            const setupCacheKey = `ecoforms_cache_data_${dataSource}.json`;
            const setupCacheData = localStorage.getItem(setupCacheKey);

            if (setupCacheData) {
                try {
                    const cache = JSON.parse(setupCacheData);
                    const isValid = !cache.expires || Date.now() < cache.expires;

                    if (cache.data && isValid) {
                        console.log(`📱 Dados ${dataSource} carregados do cache de setup`);
                        return Array.isArray(cache.data) ? cache.data : cache.data.data || [];
                    } else if (!isValid) {
                        localStorage.removeItem(setupCacheKey);
                    }
                } catch (error) {
                    localStorage.removeItem(setupCacheKey);
                }
            }
        }

        // 2. Tentar cache local (se não desabilitado)
        let data = null;
        if (!this.disableCache) {
            data = this.getFromCache('data', dataSource);
            if (data) {
                console.log(`📋 Dados ${dataSource} carregados do cache local`);
                return data;
            }
        }

        // 3. Carregar do Supabase Storage
        try {
            console.log(`📥 Buscando dados ${dataSource} em shared/data_registry.json...`);

            const registryData = await this.fetchSharedFile('data_registry.json');
            const dataRecords = registryData?.data_registry || [];

            // Filtrar registros para este tipo
            const recordsQuery = dataRecords.filter(r => r.tipo === dataSource);

            if (recordsQuery.length === 0) {
                throw new Error(`Dados ${dataSource} não encontrados no data_registry remoto`);
            }

            // Agregar conteúdo
            if (recordsQuery.length === 1) {
                const content = recordsQuery[0].conteudo;
                data = typeof content === 'string' ? JSON.parse(content) : content;
            } else {
                data = recordsQuery.reduce((acc, record) => {
                    const content = typeof record.conteudo === 'string'
                        ? JSON.parse(record.conteudo)
                        : record.conteudo;

                    if (Array.isArray(content)) {
                        return [...acc, ...content];
                    } else if (content && typeof content === 'object') {
                        return [...acc, content];
                    }
                    return acc;
                }, []);
            }

            // Salvar no cache (se não desabilitado)
            if (!this.disableCache) this.saveToCache('data', dataSource, data);
            console.log(`✅ Dados ${dataSource} salvos no cache local`);

            return Array.isArray(data) ? data : (data.data || data);
        } catch (error) {
            console.error(`❌ Erro ao carregar dados ${dataSource} do Supabase Storage:`, error);

            // Fallbacks (setup e cache expirado) mantidos...
            try {
                const setupCacheKey = `ecoforms_cache_data_${dataSource}.json`;
                const setupRaw = localStorage.getItem(setupCacheKey);
                if (setupRaw) {
                    const parsed = JSON.parse(setupRaw);
                    const maybeData = Array.isArray(parsed.data) ? parsed.data : (parsed.data || []);
                    if (maybeData && maybeData.length) return maybeData;
                }
            } catch (e) { }

            // ... (outros fallbacks omitidos por brevidade, código original tinha)

            throw new Error(`Dados ${dataSource} não encontrados no Supabase Storage nem em cache local`);
        }
    }

    /**
     * NOVO: Sincroniza usuários para permissões (auth-manager)
     */
    async syncUsers() {
        try {
            console.log('👥 Sincronizando tabela de usuários (shared/users.json)...');
            const userData = await this.fetchSharedFile('users.json');
            const users = userData?.usuarios || [];

            if (users.length > 0) {
                // Salvar em um localstorage específico para AuthManager usar
                localStorage.setItem('ecoforms_users_cache', JSON.stringify(users));
                console.log(`✅ ${users.length} usuários cacheados para login offline`);
                return users;
            }
        } catch (error) {
            console.warn('Falha ao sincronizar usuários:', error);
        }
        return [];
    }

    /**
     * Lista formulários disponíveis no Storage (via shared/form_registry.json)
     */
    async listAvailableForms() {
        try {
            const registryData = await this.fetchSharedFile('form_registry.json');
            const forms = registryData?.form_registry || [];

            return forms.map(row => ({
                id: row.form_id, // Note: campo pode ser form_id ou id dependendo do dump
                name: row.titulo || row.slug || row.form_id,
                size: 0, // Não temos o tamanho do arquivo individual
                lastModified: row.atualizado_em,
                version: row.versao
            }));
        } catch (error) {
            console.error('❌ Erro ao listar formulários:', error);
            return [];
        }
    }


    /**
     * Lista dados disponíveis no Storage
     */
    async listAvailableData() {
        try {
            const registryData = await this.fetchSharedFile('data_registry.json');
            const dataRecords = registryData?.data_registry || [];

            return dataRecords.map(row => ({
                id: row.tipo,
                name: row.tipo || row.id,
                size: 0,
                lastModified: row.updated_at,
                version: row.versao
            }));
        } catch (error) {
            console.error('❌ Erro ao listar dados:', error);
            return [];
        }
    }

    /**
     * Faz refresh dos itens expirados do cache (forms e data)
     * options: { concurrency, maxRetries }
     */
    async refreshExpiredCaches(options = {}) {
        const { concurrency = 2, maxRetries = 3 } = options;

        // Compilar lista de keys expiradas
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.storagePrefix));
        const now = Date.now();
        const expiredKeys = [];

        keys.forEach(key => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                const isOnline = this.isOnline();
                const maxAge = isOnline ? (24 * 60 * 60 * 1000) : (7 * 24 * 60 * 60 * 1000);
                const age = now - (parsed.timestamp || 0);
                if (age >= maxAge) {
                    expiredKeys.push(key);
                }
            } catch (e) {
                // considerar expirado se corrompido
                expiredKeys.push(key);
            }
        });

        if (expiredKeys.length === 0) {
            // update stats
            this._lastRefreshStats = { refreshed: 0, failed: 0, pending: 0, timestamp: Date.now() };
            return;
        }

        // Processar com limite de concorrência
        const queue = expiredKeys.slice();
        const active = [];

        let refreshedCount = 0;
        let failedCount = 0;

        const worker = async () => {
            while (queue.length) {
                const key = queue.shift();
                try {
                    const res = await this._refreshSingleKey(key, maxRetries);
                    if (res && res.success) refreshedCount++;
                    else failedCount++;
                } catch (e) {
                    failedCount++;
                    console.warn(`⚠️ Falha ao atualizar ${key}:`, e);
                }
            }
        };

        for (let i = 0; i < concurrency; i++) {
            active.push(worker());
        }

        await Promise.all(active);

        // atualizar estatísticas
        this._lastRefreshStats = {
            refreshed: refreshedCount,
            failed: failedCount,
            pending: expiredKeys.length - (refreshedCount + failedCount),
            timestamp: Date.now()
        };
    }

    async _refreshSingleKey(cacheKey, maxRetries = 3) {
        // cacheKey example: ecoforms_cache_data_bairros
        try {
            const parts = cacheKey.replace(this.storagePrefix, '').split('_');
            const type = parts.shift();
            const id = parts.join('_');

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    if (type === 'forms') {
                        // Buscar do shared/form_registry.json em vez de SQL
                        const registryData = await this.fetchSharedFile('form_registry.json');
                        const forms = registryData?.form_registry || [];
                        const formRecord = forms.find(f => f.form_id === id);

                        if (formRecord) {
                            const fresh = typeof formRecord.conteudo === 'string'
                                ? JSON.parse(formRecord.conteudo)
                                : formRecord.conteudo;

                            if (formRecord.versao) fresh.version = formRecord.versao;

                            this.saveToCache('forms', id, fresh);
                            return { key: cacheKey, success: true };
                        }
                    } else if (type === 'data') {
                        // Buscar do shared/data_registry.json em vez de SQL
                        const registryData = await this.fetchSharedFile('data_registry.json');
                        const dataRecords = registryData?.data_registry || [];
                        const recordsQuery = dataRecords.filter(r => r.tipo === id);

                        if (recordsQuery.length > 0) {
                            let fresh;
                            if (recordsQuery.length === 1) {
                                const content = recordsQuery[0].conteudo;
                                fresh = typeof content === 'string' ? JSON.parse(content) : content;
                            } else {
                                fresh = recordsQuery.reduce((acc, record) => {
                                    const content = typeof record.conteudo === 'string'
                                        ? JSON.parse(record.conteudo)
                                        : record.conteudo;

                                    if (Array.isArray(content)) {
                                        return [...acc, ...content];
                                    } else if (content && typeof content === 'object') {
                                        return [...acc, content];
                                    }
                                    return acc;
                                }, []);
                            }

                            if (fresh) {
                                this.saveToCache('data', id, fresh);
                                return { key: cacheKey, success: true };
                            }
                        }
                    }
                    // se não encontrar, lança erro para retry
                    throw new Error(`Item ${type}/${id} não encontrado no Storage`);
                } catch (e) {
                    const delay = Math.pow(2, attempt) * 1000;
                    if (attempt < maxRetries) await this._sleep(delay);
                }
            }

            // Depois de todas as tentativas, retornar falha
            return { key: cacheKey, success: false };
        } catch (e) {
            // falha silenciosa
            throw e;
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retorna estatísticas do último refresh de caches expirados
     */
    getRefreshStats() {
        return this._lastRefreshStats || { refreshed: 0, failed: 0, pending: 0, timestamp: null };
    }

    /**
     * Atualiza um dataSource a partir de um arquivo (JSON ou CSV)
     * @param {string} dataSource - nome do dataSource (ex: 'participantes')
     * @param {File} file - arquivo enviado pelo usuário
     * @param {Object} options - { uploadToStorage: boolean }
     */
    async updateDataSourceFromFile(dataSource, file, options = { uploadToStorage: true }) {
        if (!file) throw new Error('Arquivo não fornecido');

        // Ler conteúdo
        const text = await file.text();
        let parsed = null;

        // Tentar JSON primeiro
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            // tentar CSV simples (primeira linha headers)
            try {
                parsed = this._parseCsvToObjects(text);
            } catch (csvErr) {
                throw new Error('Falha ao parsear arquivo: não é JSON nem CSV válido');
            }
        }

        // Normalize: se for objeto com chave 'data' ou similar, extrair array
        if (parsed && !Array.isArray(parsed) && parsed.data && Array.isArray(parsed.data)) {
            parsed = parsed.data;
        }

        if (!Array.isArray(parsed)) {
            throw new Error('Formato inválido: esperado array de objetos');
        }

        // Se for participantes, validar e normalizar campos obrigatórios
        let normalized = parsed;
        let invalidCount = 0;
        if (dataSource === 'participantes') {
            const res = this._normalizeAndValidateData(parsed, ['id', 'nome', 'galpao']);
            normalized = res.valid;
            invalidCount = res.invalidCount;
            console.log(`📊 participantes: ${normalized.length} válidos, ${invalidCount} inválidos`);
            if (normalized.length === 0) {
                throw new Error('Nenhum registro válido encontrado no arquivo de participantes');
            }
        }

        // Salvar no cache local imediatamente
        try {
            this.saveToCache('data', dataSource, normalized);
        } catch (e) {
            console.warn('Não foi possível salvar no cache local:', e);
        }

        // Opcional: enviar para Supabase Storage (bucket 'suite', path data/<dataSource>.json)
        if (options.uploadToStorage) {
            try {
                const jsonStr = JSON.stringify(parsed, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const path = `data/${dataSource}.json`;

                if (this.supabaseClient) {
                    // Prefer client-side upload when a Supabase client is available
                    try { await this.supabaseClient.storage.from(this.bucketName).remove([path]).catch(() => { }); } catch (e) { }
                    const { error } = await this.supabaseClient.storage.from(this.bucketName).upload(path, blob, { upsert: true });
                    if (error) throw error;
                } else {
                    // Fallback: use backend proxy endpoint to upload (no client key exposed in browser)
                    try {
                        const uploadUrl = `/api/upload?path=${encodeURIComponent(path)}`;
                        const resp = await fetch(uploadUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: jsonStr
                        });
                        if (!resp.ok) {
                            const txt = await resp.text();
                            throw new Error(`Upload failed: ${resp.status} ${txt}`);
                        }
                    } catch (e) {
                        console.warn('Falha ao enviar dataSource para backend upload proxy:', e);
                    }
                }
            } catch (e) {
                console.warn('Falha ao enviar dataSource para Supabase Storage:', e);
            }
        }

        // Notificar e retornar resultado
        return { success: true, count: normalized.length, invalid: invalidCount };
    }

    /**
     * Normaliza e valida um array de objetos garantindo presence de campos obrigatórios.
     * Retorna { valid: Array, invalidCount: number }
     */
    _normalizeAndValidateData(items, requiredFields = []) {
        const valid = [];
        let invalidCount = 0;

        const normalizeKey = k => (k || '').toString().trim().toLowerCase();

        for (let i = 0; i < items.length; i++) {
            const raw = items[i];
            if (!raw || typeof raw !== 'object') { invalidCount++; continue; }

            // Build lookup map of lowercase keys -> value
            const map = {};
            Object.keys(raw).forEach(k => {
                map[normalizeKey(k)] = raw[k];
            });

            const out = {};
            // id: prefer numeric if possible
            let idVal = map.id !== undefined ? map.id : (map['ident'] !== undefined ? map['ident'] : undefined);
            if (idVal === undefined || idVal === null || idVal === '') {
                // generate an id
                idVal = `gen_${Date.now()}_${i}`;
            } else if (typeof idVal === 'string' && /^\d+$/.test(idVal.trim())) {
                idVal = parseInt(idVal.trim(), 10);
            }
            out.id = idVal;

            // nome/name/full_name
            const nomeKey = map.nome !== undefined ? 'nome' : (map.name !== undefined ? 'name' : (map['full_name'] !== undefined ? 'full_name' : null));
            const nomeVal = nomeKey ? map[normalizeKey(nomeKey)] : null;
            out.nome = (nomeVal !== undefined && nomeVal !== null) ? String(nomeVal).trim() : '';

            // galpao
            const galKey = map.galpao !== undefined ? 'galpao' : (map['galpão'] !== undefined ? 'galpão' : (map['galpao_nome'] !== undefined ? 'galpao_nome' : null));
            const galVal = galKey ? map[normalizeKey(galKey)] : null;
            out.galpao = (galVal !== undefined && galVal !== null) ? String(galVal).trim() : '';

            // copy other fields preserving original keys
            Object.keys(raw).forEach(k => {
                const lk = normalizeKey(k);
                if (lk === 'id' || lk === 'nome' || lk === 'name' || lk === 'full_name' || lk === 'galpao' || lk === 'galpão' || lk === 'galpao_nome') return;
                out[k] = raw[k];
            });

            // verify required fields
            let ok = true;
            for (const field of requiredFields) {
                if (!out[field] && out[field] !== 0) { ok = false; break; }
            }

            if (ok) valid.push(out); else invalidCount++;
        }

        return { valid, invalidCount };
    }

    _parseCsvToObjects(text) {
        // CSV simples, separador vírgula, primeira linha headers
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 1) throw new Error('CSV vazio');
        const headers = lines[0].split(/,|;|\t/).map(h => h.trim());
        const out = [];
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(/,|;|\t/);
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = (row[j] !== undefined) ? row[j].trim() : '';
            }
            out.push(obj);
        }
        return out;
    }

    /**
     * Busca dados do cache mesmo se expirados (para fallback)
     */
    getCachedData(key, forceExpired = false) {
        try {
            const cacheKey = this.storagePrefix + key;
            const cachedItem = localStorage.getItem(cacheKey);

            if (!cachedItem) {
                return null;
            }

            const parsedItem = JSON.parse(cachedItem);

            // Se forceExpired = true, retorna mesmo se expirado
            if (forceExpired) {
                console.log(`⚠️ Retornando dados expirados para '${key}'`);
                return parsedItem.data;
            }

            // Verificação normal de expiração
            const now = Date.now();
            if (now > parsedItem.expires) {
                return null; // Expirado
            }

            return parsedItem.data;
        } catch (error) {
            console.error(`❌ Erro ao buscar cache para '${key}':`, error);
            return null;
        }
    }

    /**
     * Verifica se há dados em cache (mesmo expirados)
     */
    hasCachedData(key) {
        const cacheKey = this.storagePrefix + key;
        return localStorage.getItem(cacheKey) !== null;
    }

    /**
     * Obtém informações sobre o cache (incluindo data de expiração)
     */
    getCacheInfo(key) {
        try {
            const cacheKey = this.storagePrefix + key;
            const cachedItem = localStorage.getItem(cacheKey);

            if (!cachedItem) {
                return null;
            }

            const parsedItem = JSON.parse(cachedItem);
            const now = Date.now();

            return {
                key: key,
                hasData: !!parsedItem.data,
                isExpired: now > parsedItem.expires,
                expiryDate: new Date(parsedItem.expires),
                cachedAt: new Date(parsedItem.cachedAt || parsedItem.timestamp || now)
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Retorna os valores permitidos para preferência de fonte de formulários
     */
    getAllowedFormSourcePreferences() {
        return ['auto', 'local_only', 'supabase_first'];
    }

    /**
     * Valida se uma preferência de fonte de formulário é válida
     */
    isValidFormSourcePreference(preference) {
        return this.getAllowedFormSourcePreferences().includes(preference);
    }

    /**
     * Obtém a preferência atual de fonte de formulários
     */
    getFormSourcePreference() {
        if (this.systemConfig && typeof this.systemConfig.getFormSourcePreference === 'function') {
            return this.systemConfig.getFormSourcePreference();
        }
        return 'auto'; // Fallback padrão
    }

    /**
     * Limpa todo o cache
     */
    clearCache() {
        this.cache.forms.clear();
        this.cache.data.clear();

        // Limpar localStorage também
        const keys = Object.keys(localStorage).filter(key => key.startsWith(this.storagePrefix));
        keys.forEach(key => localStorage.removeItem(key));

        console.log('🗑️ Cache limpo completamente');
    }
    /**
     * Verifica se o dispositivo está online
     */
    isOnline() {
        return navigator.onLine;
    }
}

// Instância global
window.smartCache = new SmartCacheService();