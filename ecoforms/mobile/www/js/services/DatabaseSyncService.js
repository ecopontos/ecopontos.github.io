/**
 * DatabaseSyncService - Serviço para sincronização com view_ecoponto_caixas_latest
 * Permite que o formulário ecopontoCaixasForm atualize os dados com base nas informações mais recentes do banco
 */

class DatabaseSyncService {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        this.isOnline = navigator.onLine;
        this.conflictHistory = [];

        // Carregar histórico de conflitos do localStorage
        this.loadConflictHistory();

        // Event listeners para conectividade
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.clearCache();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    /**
     * Consulta os dados mais recentes de ocupação para um ecoponto específico
     * @param {string} ecopontoId - ID do ecoponto
     * @returns {Promise<Object>} Dados mais recentes por caixa
     */
    async getLatestOccupationData(ecopontoId) {
        try {
            // Verificar cache primeiro (mantemos o cache em memória para evitar hits repetidos no IDB)
            const cacheKey = `ecoponto_${ecopontoId}`;
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
                    console.log(`📦 Usando cache em memória para ecoponto ${ecopontoId}`);
                    return cached.data;
                }
            }

            console.log(`DataService: Consultando registros locais para ecoponto ${ecopontoId}...`);

            // Garantir que DataService está disponível
            if (!window.dataService) {
                console.warn('⚠️ DataService não disponível globalmente. Tentando instanciar...');
                // Em um cenário ideal, o DataService já deve estar inicializado
                if (typeof DataService !== 'undefined') {
                    window.dataService = new DataService();
                    await window.dataService.init();
                } else {
                    throw new Error('DataService não encontrado');
                }
            }

            // 1. Buscar formulários do tipo 'ecopontoCaixasForm' do IndexedDB
            const forms = await window.dataService.getFormData('ecopontoCaixasForm');

            // 2. Filtrar pelo ecopontoId e ordenar por data decrescente
            const submissions = forms
                .filter(f => f.data && f.data.ecoponto === ecopontoId)
                .sort((a, b) => {
                    const dateA = new Date(a.submittedAt || a.createdAt || 0);
                    const dateB = new Date(b.submittedAt || b.createdAt || 0);
                    return dateB - dateA;
                });

            console.log(`✅ Encontrados ${submissions.length} registros locais para ecoponto ${ecopontoId}`);

            if (submissions.length === 0) {
                return this.getDefaultOccupationData();
            }

            // 3. Pegar o mais recente
            const latestSubmission = submissions[0];

            // 4. Processar para o formato esperado
            const caixasList = latestSubmission.data.caixas_list || {};

            const processedData = {
                ocupacao: caixasList.ocupacao || {},
                removidas: caixasList.removidas || {},
                timestamps: {}, // Map de timestamps por caixa se disponível (geralmente não detalhado no form)
                timestamp: latestSubmission.submittedAt || latestSubmission.createdAt
            };

            // Tentar extrair timestamps detalhados se existirem
            // No formato atual do ecoponto-caixas-sync.js, timestamps podem estar no snapshot, mas não por caixa individual
            // Vamos assumir o timestamp da submissão para todos se não houver detalhe
            Object.keys(processedData.ocupacao).forEach(key => {
                processedData.timestamps[key] = processedData.timestamp;
            });

            // Armazenar em cache
            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });

            return processedData;

        } catch (error) {
            console.error('❌ Erro em getLatestOccupationData (local):', error);
            // Fallback: retornar vazio em vez de erro para não quebrar a UI
            return this.getDefaultOccupationData();
        }
    }

    /**
     * Processa os dados da view para o formato esperado pelo OccupationField
     * @param {Array} data - Dados brutos da view
     * @returns {Object} Dados processados no formato { ocupacao: {}, removidas: {} }
     */
    processViewData(data) {
        const processed = {
            ocupacao: {},
            removidas: {},
            timestamps: {},
            timestamp: null
        };

        let latestTimestamp = null;

        data.forEach(record => {
            const caixaId = record.caixa.toString();
            const ocupacao = record.ocupacao?.toString() || '';
            const timestamp = record.timestamp;

            // Verificar se este é o registro mais recente para esta caixa
            const currentRecord = processed.ocupacao[caixaId];
            const shouldUpdate = !currentRecord ||
                new Date(timestamp) > new Date(currentRecord.timestamp || 0);

            if (shouldUpdate) {
                processed.ocupacao[caixaId] = ocupacao;
                if (timestamp) {
                    processed.timestamps[caixaId] = timestamp;
                }
                if (timestamp && (!latestTimestamp || new Date(timestamp) > new Date(latestTimestamp))) {
                    latestTimestamp = timestamp;
                }
                console.log(`📦 Atualizando caixa ${caixaId}: ${ocupacao}% (timestamp: ${timestamp})`);
            } else {
                console.log(`📦 Mantendo valor atual da caixa ${caixaId}: ${processed.ocupacao[caixaId]}%`);
            }
        });

        if (latestTimestamp) {
            processed.timestamp = latestTimestamp;
        }

        return processed;
    }

    /**
     * Obtém dados padrão quando não há conexão ou dados disponíveis
     * @returns {Object} Dados padrão de ocupação
     */
    getDefaultOccupationData() {
        return {
            ocupacao: {},
            removidas: {}
        };
    }

    /**
     * Limpa o cache de um ecoponto específico
     * @param {string} ecopontoId - ID do ecoponto
     */
    clearEcopontoCache(ecopontoId) {
        const cacheKey = `ecoponto_${ecopontoId}`;
        this.cache.delete(cacheKey);
        console.log(`🗑️ Cache limpo para ecoponto ${ecopontoId}`);
    }

    /**
     * Limpa todo o cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache geral limpo');
    }

    /**
     * Força a atualização do cache para um ecoponto
     * @param {string} ecopontoId - ID do ecoponto
     */
    async refreshEcopontoData(ecopontoId) {
        this.clearEcopontoCache(ecopontoId);
        return await this.getLatestOccupationData(ecopontoId);
    }

    /**
     * Verifica se há conflitos entre dados locais e do banco.
     * Usa vector clocks quando disponíveis; cai em LWW por timestamp como fallback.
     * @param {Object} localData - Dados locais do formulário (pode conter .vc)
     * @param {Object} serverData - Dados do servidor (pode conter .vc)
     * @returns {Object} Informações sobre conflitos
     */
    detectConflicts(localData, serverData) {
        const conflicts = {
            hasConflicts: false,
            serverNewer: [],
            localNewer: [],
            details: [],
            localData,
            serverData
        };

        const allCaixas = new Set([
            ...Object.keys(serverData?.ocupacao || {}),
            ...Object.keys(localData?.ocupacao || {})
        ]);

        const normalizeValue = (value) => {
            if (value === null || value === undefined) {
                return '';
            }
            return value.toString();
        };

        const resolveTimestamp = (source = {}, caixaId) => {
            const mapTs = source.timestamps && source.timestamps[caixaId];
            return mapTs || source.timestamp || null;
        };

        const toMillis = (timestamp) => {
            if (!timestamp) {
                return null;
            }
            const time = new Date(timestamp).getTime();
            return Number.isNaN(time) ? null : time;
        };

        const formatValue = (value) => (value === '' ? 'vazio' : `${value}%`);

        // Tolerância de tempo para LWW
        const TIME_TOLERANCE = 5000; // 5 segundos

        allCaixas.forEach(caixaId => {
            const localValue = normalizeValue((localData.ocupacao || {})[caixaId]);
            const serverValue = normalizeValue((serverData.ocupacao || {})[caixaId]);

            // Se os valores forem idênticos, não há conflito
            if (localValue === serverValue) {
                return;
            }

            conflicts.hasConflicts = true;

            // LWW por timestamp
            const localTimestamp = resolveTimestamp(localData, caixaId);
            const serverTimestamp = resolveTimestamp(serverData, caixaId);
            const localTime = toMillis(localTimestamp);
            const serverTime = toMillis(serverTimestamp);

            const localHasValue = localValue !== '';
            const serverHasValue = serverValue !== '';

            let serverIsNewer = false;

            if (serverTime !== null && localTime !== null) {
                const timeDifference = Math.abs(serverTime - localTime);
                if (timeDifference <= TIME_TOLERANCE) {
                    console.log(`⏰ Timestamps próximos para caixa ${caixaId} (dif: ${timeDifference}ms), servidor preferido`);
                    serverIsNewer = true;
                } else {
                    serverIsNewer = serverTime > localTime;
                }
            } else if (serverTime !== null && localTime === null) {
                serverIsNewer = true;
            } else if (serverTime === null && localTime !== null) {
                serverIsNewer = false;
            } else if (!localHasValue && serverHasValue) {
                serverIsNewer = true;
            } else if (localHasValue && !serverHasValue) {
                serverIsNewer = false;
            }

            const message = serverIsNewer
                ? `Servidor tem valor mais recente: ${formatValue(serverValue)} vs ${formatValue(localValue)}`
                : `Local tem valor mais recente: ${formatValue(localValue)} vs ${formatValue(serverValue)}`;

            const detail = {
                caixaId,
                localValue,
                serverValue,
                localTimestamp,
                serverTimestamp,
                resolution: this.suggestConflictResolution(localValue, serverValue, serverIsNewer),
                message
            };

            if (serverIsNewer) {
                conflicts.serverNewer.push(detail);
            } else {
                conflicts.localNewer.push(detail);
            }

            conflicts.details.push(detail);
        });

        return conflicts;
    }

    /**
     * Sugere resolução para conflitos de dados
     * @param {string} localValue - Valor local
     * @param {string} serverValue - Valor do servidor
     * @param {boolean} serverIsNewer - Se o servidor é mais recente
     * @returns {string} Resolução sugerida
     */
    suggestConflictResolution(localValue, serverValue, serverIsNewer) {
        if (serverIsNewer) {
            return `Adotar valor do servidor (${serverValue}%)`;
        } else if (localValue && !serverValue) {
            return `Manter valor local (${localValue}%) - servidor vazio`;
        } else if (!localValue && serverValue) {
            return `Adotar valor do servidor (${serverValue}%)`;
        } else {
            return `Valores idênticos`;
        }
    }

    /**
     * Atualiza os dados do formulário com base nos dados mais recentes
     * @param {string} ecopontoId - ID do ecoponto
     * @param {Object} fieldInstance - Instância do campo OccupationField
     * @returns {Promise<Object>} Resultado da atualização
     */
    async updateFormField(ecopontoId, fieldInstance) {
        try {
            console.log(`🔄 Atualizando formulário com dados do ecoponto ${ecopontoId}...`);

            // Obter dados mais recentes do banco
            const serverData = await this.getLatestOccupationData(ecopontoId);

            // Obter dados atuais do formulário
            const fieldValue = (fieldInstance && typeof fieldInstance.getValue === 'function')
                ? fieldInstance.getValue()
                : {};
            const currentData = {
                ocupacao: fieldValue.ocupacao || {},
                removidas: fieldValue.removidas || {},
                timestamp: fieldValue.timestamp || null,
                timestamps: fieldValue.timestamps || {}
            };

            // Log para depuração de conflitos
            console.log(`📊 Comparando dados para ecoponto ${ecopontoId}:`);
            console.log(`   Dados do servidor:`, serverData);
            console.log(`   Dados atuais:`, currentData);

            // Detectar conflitos
            const conflicts = this.detectConflicts(currentData, serverData);

            if (conflicts.hasConflicts) {
                console.warn('⚠️ Conflitos detectados:', conflicts);

                // Conflitos resolvíveis por LWW
                const resolvedData = this.applyConflictResolution(currentData, serverData, conflicts);

                // Registrar conflito no histórico (localStorage)
                this.logConflictResolution(ecopontoId, conflicts, 'auto_applied');

                // Notificar sobre conflitos resolvidos
                this.notifyConflictResolution(ecopontoId, conflicts);

                // Atualizar o campo com os dados resolvidos
                fieldInstance.setValue(resolvedData, {
                    silent: true,
                    reason: 'database_sync_update'
                });

                return {
                    success: true,
                    conflicts: conflicts,
                    resolution: 'auto_applied',
                    message: `${conflicts.serverNewer.length + conflicts.localNewer.length} conflitos resolvidos automaticamente`
                };
            } else {
                console.log(`✅ Nenhum conflito detectado para ecoponto ${ecopontoId}, atualizando normalmente`);
            }

            // Se não há conflitos, atualizar normalmente
            fieldInstance.setValue(serverData, {
                silent: true,
                reason: 'database_sync_update'
            });

            console.log(`✅ Formulário atualizado com sucesso para ecoponto ${ecopontoId}`);

            return {
                success: true,
                conflicts: null,
                message: 'Dados atualizados sem conflitos'
            };

        } catch (error) {
            console.error('❌ Erro ao atualizar formulário:', error);
            return {
                success: false,
                error: error.message,
                message: 'Falha na atualização do formulário'
            };
        }
    }

    /**
     * Aplica resolução automática para conflitos
     * @param {Object} localData - Dados locais
     * @param {Object} serverData - Dados do servidor
     * @param {Object} conflicts - Informações sobre conflitos
     * @returns {Object} Dados resolvidos
     */
    applyConflictResolution(localData, serverData, conflicts) {
        const resolved = {
            ocupacao: { ...localData.ocupacao },
            removidas: { ...localData.removidas },
            timestamps: { ...(localData.timestamps || {}) },
            timestamp: localData.timestamp || null
        };

        let newestTimestamp = resolved.timestamp;

        // Primeiro, aplicar resoluções do servidor (valores mais recentes do servidor)
        conflicts.serverNewer.forEach(conflict => {
            resolved.ocupacao[conflict.caixaId] = conflict.serverValue;
            if (conflict.serverTimestamp) {
                resolved.timestamps[conflict.caixaId] = conflict.serverTimestamp;
                if (!newestTimestamp || new Date(conflict.serverTimestamp) > new Date(newestTimestamp)) {
                    newestTimestamp = conflict.serverTimestamp;
                }
            }
        });

        // Em seguida, aplicar resoluções locais (valores mais recentes localmente)
        conflicts.localNewer.forEach(conflict => {
            resolved.ocupacao[conflict.caixaId] = conflict.localValue;
            if (conflict.localTimestamp) {
                resolved.timestamps[conflict.caixaId] = conflict.localTimestamp;
                if (!newestTimestamp || new Date(conflict.localTimestamp) > new Date(newestTimestamp)) {
                    newestTimestamp = conflict.localTimestamp;
                }
            }
        });

        // Garantir que todos os campos do servidor que não estão em conflito sejam preservados
        // quando não há conflito real (por exemplo, valores idênticos)
        Object.keys(serverData.ocupacao || {}).forEach(caixaId => {
            if (!(caixaId in resolved.ocupacao) && !(conflicts.details.some(detail => detail.caixaId === caixaId))) {
                resolved.ocupacao[caixaId] = serverData.ocupacao[caixaId];
                if (serverData.timestamps && serverData.timestamps[caixaId]) {
                    resolved.timestamps[caixaId] = serverData.timestamps[caixaId];
                }
            }
        });

        if (newestTimestamp) {
            resolved.timestamp = newestTimestamp;
        }

        return resolved;
    }

    /**
     * Inicia monitoramento automático de atualizações para um ecoponto
     * @param {string} ecopontoId - ID do ecoponto
     * @param {Object} fieldInstance - Instância do campo
     * @param {number} intervalMs - Intervalo em milissegundos (padrão: 30 segundos)
     * @returns {number} ID do intervalo para cancelamento
     */
    startAutoUpdate(ecopontoId, fieldInstance, intervalMs = 30000) {
        console.log(`⏰ Iniciando atualização automática para ecoponto ${ecopontoId} (${intervalMs / 1000}s)`);

        const intervalId = setInterval(async () => {
            try {
                if (!this.isOnline) {
                    console.log('📴 Offline, pulando atualização automática');
                    return;
                }

                const result = await this.updateFormField(ecopontoId, fieldInstance);
                if (result.success) {
                    console.log(`✅ Atualização automática concluída para ecoponto ${ecopontoId}`);
                } else {
                    console.warn(`⚠️ Falha na atualização automática:`, result.message);
                }
            } catch (error) {
                console.error('❌ Erro na atualização automática:', error);
            }
        }, intervalMs);

        return intervalId;
    }

    /**
     * Para monitoramento automático de atualizações
     * @param {number} intervalId - ID do intervalo
     */
    stopAutoUpdate(intervalId) {
        if (intervalId) {
            clearInterval(intervalId);
            console.log('⏹️ Atualização automática parada');
        }
    }

    /**
     * Verifica se o formulário precisa ser atualizado
     * @param {string} ecopontoId - ID do ecoponto
     * @param {Object} localData - Dados locais
     * @param {Object} serverData - Dados do servidor
     * @returns {boolean} Se precisa atualizar
     */
    needsUpdate(localData, serverData) {
        // Se não há dados do servidor, não precisa atualizar
        if (!serverData || Object.keys(serverData.ocupacao || {}).length === 0) {
            return false;
        }

        // Verificar se há diferenças significativas
        const conflicts = this.detectConflicts(localData, serverData);
        return conflicts.hasConflicts;
    }

    /**
     * Registra conflito resolvido no histórico (localStorage)
     * @param {string} ecopontoId - ID do ecoponto
     * @param {Object} conflicts - Informações sobre conflitos
     * @param {string} resolutionType - Tipo de resolução ('auto_applied', 'user_confirmed', etc.)
     */
    logConflictResolution(ecopontoId, conflicts, resolutionType) {
        const conflictEntry = {
            id: this.generateId(),
            ecopontoId,
            timestamp: new Date().toISOString(),
            conflicts: conflicts,
            resolutionType,
            totalConflicts: conflicts.serverNewer.length + conflicts.localNewer.length
        };

        this.conflictHistory.unshift(conflictEntry);

        // Manter apenas os últimos 100 conflitos no histórico local
        if (this.conflictHistory.length > 100) {
            this.conflictHistory = this.conflictHistory.slice(0, 100);
        }

        // Salvar histórico atualizado no localStorage
        this.saveConflictHistory();

        console.log(`📋 Conflito registrado no histórico:`, conflictEntry);
    }

    /**
     * Notifica sobre resolução de conflitos
     * @param {string} ecopontoId - ID do ecoponto
     * @param {Object} conflicts - Informações sobre conflitos
     */
    notifyConflictResolution(ecopontoId, conflicts) {
        try {
            // Verificar se o NotificationService está disponível
            if (typeof window.notificationService !== 'undefined') {
                const totalConflicts = conflicts.serverNewer.length + conflicts.localNewer.length;

                let message = `Resolução automática de ${totalConflicts} conflito(s) detectado(s) para o ecoponto ${ecopontoId}. `;
                message += `Foram aplicadas ${conflicts.serverNewer.length} atualizações do servidor e `;
                message += `${conflicts.localNewer.length} manutenções de valores locais.`;

                // Criar notificação
                window.notificationService.createNotification({
                    title: 'Resolução de Conflitos de Dados',
                    message: message,
                    type: 'warning', // Usar tipo 'warning' para alertar sobre conflitos
                    persistent: false, // Não ser intrusivo, mas visível
                    showBrowserNotification: true, // Mostrar notificação do navegador
                    actions: [
                        { text: 'Revisar', action: 'review_conflicts', ecopontoId }
                    ],
                    data: {
                        action: 'conflict_resolution',
                        ecopontoId,
                        conflictCount: totalConflicts,
                        conflicts: conflicts
                    }
                });

                // Registrar listener global para lidar com a ação de revisão de conflitos
                if (!this.conflictReviewListenerRegistered) {
                    window.notificationService.subscribe((event, data) => {
                        if (event === 'new' && data && data.data && data.data.action === 'conflict_resolution') {
                            // Adicionar listener para quando o usuário clicar na ação de revisão
                            document.addEventListener('click', (e) => {
                                if (e.target && e.target.dataset && e.target.dataset.action === 'review_conflicts') {
                                    this.openConflictReviewModal(data.data.ecopontoId);
                                }
                            });
                        }
                    });
                    this.conflictReviewListenerRegistered = true;
                }

                console.log(`🔔 Notificação de conflito criada para ecoponto ${ecopontoId}`);
            } else {
                console.warn('⚠️ NotificationService não encontrado, não foi possível notificar sobre conflito');
            }
        } catch (error) {
            console.error('❌ Erro ao notificar sobre conflito:', error);
        }
    }

    /**
     * Obtém histórico de conflitos para um ecoponto específico
     * @param {string} ecopontoId - ID do ecoponto
     * @returns {Array} Histórico de conflitos
     */
    getConflictHistory(ecopontoId = null) {
        if (ecopontoId) {
            return this.conflictHistory.filter(entry => entry.ecopontoId === ecopontoId);
        }
        return this.conflictHistory;
    }

    /**
     * Gera ID único para entradas de histórico
     * @returns {string} ID único
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Salva o histórico de conflitos no localStorage
     */
    saveConflictHistory() {
        try {
            localStorage.setItem('ecoforms_conflict_history', JSON.stringify(this.conflictHistory));
        } catch (error) {
            console.error('❌ Erro ao salvar histórico de conflitos:', error);
        }
    }

    /**
     * Carrega o histórico de conflitos do localStorage
     */
    loadConflictHistory() {
        try {
            const saved = localStorage.getItem('ecoforms_conflict_history');
            if (saved) {
                this.conflictHistory = JSON.parse(saved);
            } else {
                this.conflictHistory = [];
            }
        } catch (error) {
            console.error('❌ Erro ao carregar histórico de conflitos:', error);
            this.conflictHistory = [];
        }
    }

    /**
     * Limpa o histórico de conflitos
     */
    clearConflictHistory() {
        this.conflictHistory = [];
        this.saveConflictHistory();
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.DatabaseSyncService = DatabaseSyncService;
}