/**
 * Smart Preloader - Sistema inteligente de pré-carregamento de dados
 * Otimiza o processo de configuração inicial do dispositivo com carregamento
 * inteligente, priorização e gerenciamento eficiente de recursos
 */

class SmartPreloader {
    constructor(deviceSetupService) {
        this.deviceSetupService = deviceSetupService;
        this.supabaseClient = null;
        this.bucketName = 'sync-bucket';

        // Estatísticas de download
        this.downloadStats = {
            startTime: null,
            endTime: null,
            totalFiles: 0,
            completedFiles: 0,
            totalSize: 0,
            downloadedSize: 0,
            currentSpeed: 0,
            averageSpeed: 0,
            estimatedTimeRemaining: null,
            lastAction: null
        };

        // Configurações
        this.config = {
            concurrencyLimit: 3,
            maxRetries: 3,
            backoffFactor: 1.5,
            compressionEnabled: true,
            priorityCategories: {
                critical: ['usuarios.json', 'ecoponto.json'],
                high: [],
                normal: [],
                low: []
            }
        };

        // Sistema preditivo
        this.predictiveSystem = new PredictivePreloader();

        // Inicializar
        this.init();
    }

    async init() {
        // Verificar disponibilidade do LZString para compressão
        if (typeof LZString === 'undefined' && typeof window !== 'undefined') {
            try {
                // Carregar LZString dinamicamente se não estiver disponível
                await this.loadScript('https://cdn.jsdelivr.net/npm/lz-string@1.4.4/libs/lz-string.min.js');
                console.log('✅ LZString carregado para compressão de dados');
            } catch (error) {
                console.warn('⚠️ LZString não disponível, compressão desabilitada:', error);
                this.config.compressionEnabled = false;
            }
        }

        // Inicializar cliente Supabase
        this.supabaseClient = await this.deviceSetupService.ensureSupabaseClient();
    }

    /**
     * Carrega um script externo dinamicamente
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Inicia o processo de pré-carregamento inteligente
     */
    async startSmartPreloading(selectedForms) {
        console.log('🚀 Iniciando pré-carregamento inteligente...');
        this.deviceSetupService.updateLoadingStep('data', 'loading', 'Analisando requisitos de dados...');

        // Iniciar estatísticas
        this.downloadStats.startTime = Date.now();
        this.downloadStats.totalFiles = 0;
        this.downloadStats.completedFiles = 0;
        this.downloadStats.totalSize = 0;
        this.downloadStats.downloadedSize = 0;

        try {
            // 1. Verificar espaço disponível
            const storageStatus = await this.checkStorageAvailability();
            if (storageStatus.critical) {
                console.warn('⚠️ Espaço de armazenamento crítico:', storageStatus);
                this.deviceSetupService.showAlert('Espaço de armazenamento limitado. Alguns dados podem não ser baixados.', 'warning');
            }

            // 2. Analisar dependências profundas dos formulários
            const dependencies = await this.analyzeFormDependencies(selectedForms);
            console.log(`🔍 Dependências identificadas: ${dependencies.length}`, dependencies);

            // 3. Adicionar dados preditivos baseados em padrões de uso
            const predictedData = this.getPredictiveData(selectedForms);
            const allDataSources = [...new Set([...dependencies, ...predictedData])];
            console.log(`🔮 Dados previstos: ${predictedData.length}`, predictedData);

            // 4. Priorizar fontes de dados
            const prioritizedSources = this.prioritizeDataSources(allDataSources);
            console.log('📊 Fontes de dados priorizadas:', prioritizedSources);

            // 5. Verificar quais fontes precisam ser baixadas (verificação de versão)
            const sourcesToDownload = await this.filterSourcesNeedingDownload(prioritizedSources);
            console.log(`📥 Fontes a baixar: ${sourcesToDownload.length}/${prioritizedSources.length}`);

            // Atualizar estatísticas
            this.downloadStats.totalFiles = sourcesToDownload.length;

            // 6. Criar UI detalhada para feedback
            this.createDetailedProgressUI();

            // 7. Baixar dados em paralelo com controle de concorrência
            this.deviceSetupService.updateLoadingStep('data', 'loading', 'Baixando dados do sistema...');
            const downloadResults = await this.downloadDataSourcesParallel(sourcesToDownload);

            // 8. Finalizar estatísticas
            this.downloadStats.endTime = Date.now();
            this.downloadStats.lastAction = {
                status: 'success',
                message: 'Download concluído com sucesso!'
            };

            console.log(`✅ Pré-carregamento concluído: ${downloadResults.success.length} sucesso, ${downloadResults.failed.length} falhas`);
            this.deviceSetupService.updateLoadingStep('data', 'success', `Dados baixados: ${downloadResults.success.length}/${sourcesToDownload.length}`);

            return {
                success: true,
                downloaded: downloadResults.success.length,
                failed: downloadResults.failed.length,
                totalTime: this.downloadStats.endTime - this.downloadStats.startTime
            };

        } catch (error) {
            console.error('❌ Erro no pré-carregamento inteligente:', error);
            this.deviceSetupService.updateLoadingStep('data', 'error', 'Erro no pré-carregamento');

            this.downloadStats.lastAction = {
                status: 'error',
                message: `Erro: ${error.message}`
            };

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Analisa dependências profundas dos formulários selecionados
     */
    async analyzeFormDependencies(selectedForms) {
        const dependencies = new Set();

        // Adicionar dependências essenciais
        this.config.priorityCategories.critical.forEach(dep => dependencies.add(dep));

        for (const formFile of selectedForms) {
            try {
                // Carregar dados do formulário
                const formData = await this.loadFormData(formFile);

                if (!formData) {
                    console.warn(`⚠️ Não foi possível carregar ${formFile} para análise`);
                    continue;
                }

                // Extrair dependências diretas
                const directDeps = this.extractDirectDataSources(formData);
                directDeps.forEach(dep => dependencies.add(dep));

                // Analisar dependências secundárias
                for (const dep of directDeps) {
                    try {
                        const secondaryDeps = await this.analyzeDataSourceDependencies(dep);
                        secondaryDeps.forEach(secDep => dependencies.add(secDep));
                    } catch (error) {
                        console.warn(`⚠️ Erro ao analisar dependências secundárias de ${dep}:`, error);
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao analisar ${formFile}:`, error);
            }
        }

        return Array.from(dependencies);
    }

    /**
     * Carrega dados de um formulário para análise
     * IMPORTANTE: Agora usa SmartCacheService.loadForm() para respeitar a preferência de fonte configurada
     */
    async loadFormData(formFile) {
        try {
            // Usar SmartCacheService que já implementa a lógica de preferência de fonte
            // (auto, local_only, supabase_first)
            if (window.smartCache) {
                // Remove extensão .json se existir para usar como formId
                const formId = formFile.replace(/\.json$/, '');
                const formData = await window.smartCache.loadForm(formId);
                return formData;
            }

            // Fallback para o método antigo se SmartCache não estiver disponível
            console.warn('⚠️ SmartCache não disponível, usando método de carregamento legado');

            // Verificar se já temos o formulário em cache local
            const cacheKey = `ecoforms_cache_forms_${formFile}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    return parsed.data || parsed;
                } catch (e) {
                    console.warn(`Cache inválido para ${formFile}`, e);
                }
            }

            // Se não houver cache, buscar do Supabase
            if (this.supabaseClient) {
                try {
                    const { data, error } = await this.supabaseClient.storage
                        .from(this.bucketName)
                        .download(`forms/${formFile}`);

                    if (error) {
                        console.warn(`Erro ao baixar ${formFile} para análise:`, error);
                        return null;
                    }

                    return JSON.parse(await data.text());
                } catch (error) {
                    console.warn(`Erro ao baixar ${formFile} do Supabase:`, error);
                }
            }

            // Fallback local removido
            return null;

            return null;
        } catch (error) {
            console.error(`❌ Erro ao carregar formulário ${formFile}:`, error);
            return null;
        }
    }

    /**
     * Extrai fontes de dados diretamente referenciadas em um formulário
     */
    extractDirectDataSources(formData) {
        const dataSources = new Set();

        const extractFromFields = (fields) => {
            if (!Array.isArray(fields)) return;

            fields.forEach(field => {
                // Verificar dataSource no campo
                if (field.dataSource) {
                    const ds = String(field.dataSource).replace(/\.json$/i, '') + '.json';
                    dataSources.add(ds);
                }

                // Verificar dataSource em config
                if (field.config && field.config.dataSource) {
                    const ds = String(field.config.dataSource).replace(/\.json$/i, '') + '.json';
                    dataSources.add(ds);
                }

                // Verificar outras propriedades que podem conter referências a dados
                ['source', 'dataUrl', 'optionsSource', 'lookupSource'].forEach(prop => {
                    if (field[prop] && typeof field[prop] === 'string' && field[prop].includes('.json')) {
                        const ds = field[prop].replace(/^.*\/([^\/]+\.json).*$/, '$1');
                        dataSources.add(ds);
                    }
                });

                // Recursão para campos aninhados
                if (field.campos && Array.isArray(field.campos)) {
                    extractFromFields(field.campos);
                }

                // Recursão para fields (nomenclatura alternativa)
                if (field.fields && Array.isArray(field.fields)) {
                    extractFromFields(field.fields);
                }

                // Verificar em subFields
                if (field.subFields && Array.isArray(field.subFields)) {
                    extractFromFields(field.subFields);
                }
            });
        };

        // Extrair de campos do formulário
        if (formData.campos) {
            extractFromFields(formData.campos);
        }
        if (formData.fields) {
            extractFromFields(formData.fields);
        }

        return Array.from(dataSources);
    }

    /**
     * Analisa dependências secundárias de uma fonte de dados
     */
    async analyzeDataSourceDependencies(dataSource) {
        const secondaryDeps = new Set();

        try {
            // Carregar dados da fonte
            const dataContent = await this.loadDataSource(dataSource);

            if (!dataContent) {
                return Array.from(secondaryDeps);
            }

            // Verificar referências a outros arquivos de dados
            if (Array.isArray(dataContent)) {
                dataContent.forEach(item => {
                    // Verificar campos que podem conter referências a outras fontes
                    Object.entries(item).forEach(([key, value]) => {
                        if (typeof value === 'string') {
                            // Verificar se o valor parece ser uma referência a um arquivo JSON
                            if (value.endsWith('.json')) {
                                const ds = value.replace(/^.*\/([^\/]+)$/, '$1');
                                secondaryDeps.add(ds);
                            }
                            // Verificar se o valor contém uma URL com referência a JSON
                            else if (value.includes('.json')) {
                                const match = value.match(/\/([^\/]+\.json)/);
                                if (match && match[1]) {
                                    secondaryDeps.add(match[1]);
                                }
                            }
                        }
                    });
                });
            }
        } catch (error) {
            console.warn(`Não foi possível analisar dependências secundárias de ${dataSource}:`, error);
        }

        return Array.from(secondaryDeps);
    }

    /**
     * Carrega dados de uma fonte para análise
     */
    async loadDataSource(dataSource) {
        // Verificar se já temos os dados em cache local
        const cacheKey = `ecoforms_cache_data_${dataSource}`;
        let dataContent = null;

        // Tentar cache primeiro
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                dataContent = parsed.data || parsed;
                return dataContent;
            } catch (e) {
                console.warn(`Cache inválido para ${dataSource}`, e);
            }
        }

        // Se não houver cache, buscar do Supabase
        if (this.supabaseClient) {
            try {
                const { data, error } = await this.supabaseClient.storage
                    .from(this.bucketName)
                    .download(`data/${dataSource}`);

                if (error) {
                    console.warn(`Erro ao baixar ${dataSource} para análise:`, error);
                    return null;
                }

                dataContent = JSON.parse(await data.text());
                return dataContent;
            } catch (error) {
                console.warn(`Erro ao baixar ${dataSource} do Supabase:`, error);
            }
        }

        // Fallback local removido
        return null;

        return null;
    }

    /**
     * Obtém dados adicionais com base em previsões de uso
     */
    getPredictiveData(selectedForms) {
        // Prever formulários relacionados
        const predictedForms = new Set();
        selectedForms.forEach(formId => {
            const related = this.predictiveSystem.predictNextForms(formId);
            related.forEach(form => predictedForms.add(form));
        });

        // Prever dados necessários para os formulários previstos
        const allForms = [...selectedForms, ...Array.from(predictedForms)];
        const predictedData = this.predictiveSystem.predictRequiredData(allForms);

        return predictedData;
    }

    /**
     * Prioriza fontes de dados para download
     */
    prioritizeDataSources(dataSources) {
        // Classificar fontes de dados por prioridade
        const critical = [];
        const high = [];
        const normal = [];
        const low = [];

        dataSources.forEach(ds => {
            if (this.config.priorityCategories.critical.includes(ds)) {
                critical.push({ source: ds, priority: 'critical' });
            } else if (this.config.priorityCategories.high.includes(ds)) {
                high.push({ source: ds, priority: 'high' });
            } else if (this.config.priorityCategories.low.includes(ds)) {
                low.push({ source: ds, priority: 'low' });
            } else {
                normal.push({ source: ds, priority: 'normal' });
            }
        });

        // Retornar lista ordenada por prioridade
        return [...critical, ...high, ...normal, ...low];
    }

    /**
     * Filtra fontes que realmente precisam ser baixadas
     */
    async filterSourcesNeedingDownload(prioritizedSources) {
        const sourcesToDownload = [];

        for (const source of prioritizedSources) {
            const shouldDownload = await this.shouldDownloadDataSource(source.source);

            if (shouldDownload.download) {
                sourcesToDownload.push({
                    ...source,
                    reason: shouldDownload.reason
                });
            }
        }

        return sourcesToDownload;
    }

    /**
     * Verifica se uma fonte de dados precisa ser baixada
     */
    async shouldDownloadDataSource(dataSource) {
        const cacheKey = `ecoforms_cache_data_${dataSource}`;
        const cached = localStorage.getItem(cacheKey);

        if (!cached) {
            return { download: true, reason: 'not_cached' };
        }

        try {
            const parsedCache = JSON.parse(cached);

            // Verificar se o cache expirou
            if (parsedCache.expires && Date.now() > parsedCache.expires) {
                return { download: true, reason: 'expired' };
            }

            // Verificar se há uma versão mais recente no servidor
            if (navigator.onLine && this.supabaseClient) {
                try {
                    const { data: metadata, error } = await this.supabaseClient.storage
                        .from(this.bucketName)
                        .createSignedUrl(`data/${dataSource}`, 60);

                    if (!error && metadata && metadata.signedUrl) {
                        // Verificar cabeçalhos para obter data de modificação
                        const response = await fetch(metadata.signedUrl, { method: 'HEAD' });
                        const lastModified = response.headers.get('last-modified');

                        if (lastModified) {
                            const serverDate = new Date(lastModified).getTime();
                            const cacheDate = parsedCache.timestamp || 0;

                            if (serverDate > cacheDate) {
                                return { download: true, reason: 'newer_version' };
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Erro ao verificar versão de ${dataSource}:`, error);
                    // Em caso de erro, continuar usando o cache
                }
            }

            // Usar cache existente
            return { download: false, reason: 'cache_valid' };
        } catch (error) {
            console.warn(`Erro ao verificar cache para ${dataSource}:`, error);
            return { download: true, reason: 'cache_error' };
        }
    }

    /**
     * Baixa fontes de dados em paralelo com controle de concorrência
     */
    async downloadDataSourcesParallel(dataSources, concurrencyLimit = null) {
        const limit = concurrencyLimit || this.config.concurrencyLimit;
        const results = {
            success: [],
            failed: []
        };

        // Função para processar um lote de downloads
        async function processBatch(batch) {
            const promises = batch.map(async (ds) => {
                try {
                    const result = await this.downloadWithRetry(ds.source);
                    return { source: ds.source, success: true, result };
                } catch (error) {
                    console.error(`Erro ao baixar ${ds.source}:`, error);
                    return { source: ds.source, success: false, error };
                }
            }, this);

            return await Promise.all(promises);
        }

        // Processar em lotes para controlar concorrência
        for (let i = 0; i < dataSources.length; i += limit) {
            const batch = dataSources.slice(i, i + limit);

            // Atualizar progresso
            this.downloadStats.lastAction = {
                status: 'loading',
                message: `Baixando lote ${Math.floor(i / limit) + 1}/${Math.ceil(dataSources.length / limit)}`
            };
            this.updateDetailedProgress();

            const batchResults = await processBatch.call(this, batch);

            batchResults.forEach(result => {
                this.downloadStats.completedFiles++;

                if (result.success) {
                    results.success.push(result.source);

                    // Atualizar estatísticas
                    if (result.result && result.result.size) {
                        this.downloadStats.downloadedSize += result.result.size;
                    }

                    this.downloadStats.lastAction = {
                        status: 'success',
                        message: `${result.source} baixado com sucesso`
                    };
                } else {
                    results.failed.push({ source: result.source, error: result.error });

                    this.downloadStats.lastAction = {
                        status: 'error',
                        message: `Erro ao baixar ${result.source}: ${result.error.message}`
                    };
                }

                // Atualizar progresso
                this.updateDetailedProgress();
                this.deviceSetupService.updateLoadingStep(
                    'data',
                    'loading',
                    `Baixando dados (${this.downloadStats.completedFiles}/${this.downloadStats.totalFiles})...`,
                    (this.downloadStats.completedFiles / this.downloadStats.totalFiles) * 100
                );
            });
        }

        return results;
    }

    /**
     * Baixa uma fonte de dados com retry automático
     */
    async downloadWithRetry(dataSource, maxRetries = null, backoffFactor = null) {
        const retries = maxRetries || this.config.maxRetries;
        const backoff = backoffFactor || this.config.backoffFactor;

        let attempt = 0;
        let lastError = null;

        while (attempt < retries) {
            try {
                // Tentar download
                const startTime = Date.now();
                const result = await this.downloadDataSource(dataSource);
                const endTime = Date.now();

                // Calcular velocidade
                if (result && result.size) {
                    const duration = (endTime - startTime) / 1000; // em segundos
                    this.downloadStats.currentSpeed = result.size / duration;
                }

                return result;
            } catch (error) {
                lastError = error;
                attempt++;

                this.downloadStats.lastAction = {
                    status: 'warning',
                    message: `Tentativa ${attempt} falhou para ${dataSource}, tentando novamente...`
                };
                this.updateDetailedProgress();

                if (attempt < retries) {
                    // Backoff exponencial
                    const delay = Math.pow(backoff, attempt) * 1000;
                    console.log(`Tentativa ${attempt} falhou, tentando novamente em ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Todas as tentativas falharam, tentar fallback
        try {
            return await this.downloadFromFallbackSource(dataSource);
        } catch (fallbackError) {
            throw new Error(`Falha após ${retries} tentativas: ${lastError.message}`);
        }
    }

    /**
     * Baixa uma fonte de dados
     */
    async downloadDataSource(dataSource) {
        if (!this.supabaseClient) {
            throw new Error('Cliente Supabase não disponível');
        }

        try {
            const { data, error } = await this.supabaseClient.storage
                .from(this.bucketName)
                .download(`data/${dataSource}`);

            if (error) {
                throw error;
            }

            const text = await data.text();
            const jsonData = JSON.parse(text);

            // Comprimir dados se habilitado
            let dataToStore = jsonData;
            let compressed = false;
            let originalSize = text.length;
            let compressedSize = originalSize;

            if (this.config.compressionEnabled && typeof LZString !== 'undefined') {
                try {
                    const compressedText = LZString.compressToUTF16(text);
                    compressedSize = compressedText.length * 2; // UTF-16 usa 2 bytes por caractere

                    // Só usar compressão se realmente economizar espaço
                    if (compressedSize < originalSize) {
                        compressed = true;
                        dataToStore = compressedText;
                    }
                } catch (compressionError) {
                    console.warn(`Erro ao comprimir ${dataSource}:`, compressionError);
                }
            }

            // Salvar no localStorage com cache
            const cacheKey = `ecoforms_cache_data_${dataSource}`;
            const cacheData = {
                data: dataToStore,
                compressed,
                originalSize,
                compressedSize,
                timestamp: Date.now(),
                expires: Date.now() + (24 * 60 * 60 * 1000), // 24 horas
                version: '1.0.0' // Versão padrão
            };

            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log(`✅ Dados ${dataSource} salvos no cache ${compressed ? '(comprimidos)' : ''}`);

            return {
                success: true,
                size: originalSize,
                compressed,
                compressionRatio: compressed ? (compressedSize / originalSize) : 1
            };
        } catch (error) {
            console.error(`Erro ao baixar ${dataSource}:`, error);
            throw error;
        }
    }

    /**
     * Tenta baixar dados de fontes alternativas ao Supabase.
     * CDN externo removido (era placeholder não configurado e causava falhas silenciosas).
     * Esta função agora tenta apenas o fallback via fetch() local.
     */
    async downloadFromFallbackSource(dataSource) {
        // Tentar fetch local (ex: arquivos embarcados no app)
        try {
            const response = await fetch(`data/${dataSource}`);
            if (response.ok) {
                const text = await response.text();
                const jsonData = JSON.parse(text);

                const cacheKey = `ecoforms_cache_data_${dataSource}`;
                const cacheData = {
                    data: jsonData,
                    timestamp: Date.now(),
                    expires: Date.now() + (24 * 60 * 60 * 1000),
                    source: 'local_fallback'
                };

                localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                console.log(`✅ Dados ${dataSource} salvos do fallback local`);

                return {
                    success: true,
                    size: text.length,
                    source: 'local_fallback'
                };
            }
        } catch (error) {
            console.warn(`Fallback local falhou para ${dataSource}:`, error);
        }

        throw new Error(`Fallback falhou para ${dataSource}: arquivo não encontrado localmente`);
    }

    /**
     * Verifica disponibilidade de armazenamento
     */
    async checkStorageAvailability() {
        try {
            // Estimar espaço disponível
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();

                const usedSpace = estimate.usage || 0;
                const totalSpace = estimate.quota || 0;
                const availableSpace = totalSpace - usedSpace;
                const usagePercentage = (usedSpace / totalSpace) * 100;

                return {
                    available: availableSpace,
                    total: totalSpace,
                    used: usedSpace,
                    usagePercentage,
                    critical: usagePercentage > 90
                };
            }
        } catch (error) {
            console.warn('Erro ao verificar armazenamento:', error);
        }

        // Fallback: verificação básica
        return await this.checkBasicStorageAvailability();
    }

    /**
     * Verificação básica de armazenamento
     */
    async checkBasicStorageAvailability() {
        try {
            // Testar se podemos escrever no localStorage
            const testKey = `storage_test_${Date.now()}`;
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);

            // Estimar uso atual do localStorage
            let totalSize = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                totalSize += (key.length + value.length) * 2; // Aproximação em bytes
            }

            return {
                available: true,
                estimatedUsage: totalSize,
                critical: totalSize > 4 * 1024 * 1024 // Alerta se uso > 4MB
            };
        } catch (error) {
            console.error('Erro ao verificar armazenamento básico:', error);
            return {
                available: false,
                error: error.message
            };
        }
    }

    /**
     * Cria UI detalhada para feedback de progresso
     */
    createDetailedProgressUI() {
        // Criar elementos de UI para feedback detalhado
        const container = document.getElementById('loading-status');

        if (!container) return;

        // Verificar se já existe
        if (document.getElementById('smart-preloader-stats')) return;

        // Adicionar seção de estatísticas
        const statsSection = document.createElement('div');
        statsSection.id = 'smart-preloader-stats';
        statsSection.className = 'stats-section';
        statsSection.style.margin = '20px 0';
        statsSection.style.padding = '15px';
        statsSection.style.background = '#f8f9fa';
        statsSection.style.borderRadius = '8px';
        statsSection.style.border = '1px solid #e2e6ea';

        statsSection.innerHTML = `
            <h4 style="margin-top: 0; margin-bottom: 15px; color: #495057;">Estatísticas de Download</h4>
            <div class="stats-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div class="stats-label" style="color: #6c757d;">Arquivos baixados:</div>
                <div class="stats-value" id="files-downloaded" style="font-weight: 600;">0/0</div>
            </div>
            <div class="stats-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div class="stats-label" style="color: #6c757d;">Tamanho total:</div>
                <div class="stats-value" id="total-size" style="font-weight: 600;">0 KB</div>
            </div>
            <div class="stats-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div class="stats-label" style="color: #6c757d;">Velocidade:</div>
                <div class="stats-value" id="download-speed" style="font-weight: 600;">0 KB/s</div>
            </div>
            <div class="stats-row" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div class="stats-label" style="color: #6c757d;">Tempo estimado:</div>
                <div class="stats-value" id="estimated-time" style="font-weight: 600;">Calculando...</div>
            </div>
        `;

        // Adicionar log de atividades
        const logSection = document.createElement('div');
        logSection.id = 'smart-preloader-log';
        logSection.className = 'log-section';
        logSection.style.margin = '20px 0';

        logSection.innerHTML = `
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #495057;">Log de Atividades</h4>
            <div class="log-container" id="activity-log" style="max-height: 150px; overflow-y: auto; background: #f8f9fa; border: 1px solid #e2e6ea; border-radius: 8px; padding: 10px; font-size: 14px;"></div>
        `;

        // Inserir antes do botão de retry
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            container.insertBefore(statsSection, retryBtn);
            container.insertBefore(logSection, retryBtn);
        } else {
            container.appendChild(statsSection);
            container.appendChild(logSection);
        }
    }

    /**
     * Atualiza UI com estatísticas detalhadas
     */
    updateDetailedProgress() {
        // Calcular estatísticas
        const elapsedTime = Date.now() - this.downloadStats.startTime;
        const remainingFiles = this.downloadStats.totalFiles - this.downloadStats.completedFiles;
        let estimatedTimeRemaining = null;

        if (this.downloadStats.completedFiles > 0) {
            const averageTimePerFile = elapsedTime / this.downloadStats.completedFiles;
            estimatedTimeRemaining = averageTimePerFile * remainingFiles;
        }

        // Atualizar elementos de UI
        const filesDownloaded = document.getElementById('files-downloaded');
        const totalSize = document.getElementById('total-size');
        const downloadSpeed = document.getElementById('download-speed');
        const estimatedTime = document.getElementById('estimated-time');

        if (filesDownloaded) {
            filesDownloaded.textContent = `${this.downloadStats.completedFiles}/${this.downloadStats.totalFiles}`;
        }

        if (totalSize) {
            totalSize.textContent = this.formatSize(this.downloadStats.downloadedSize);
        }

        if (downloadSpeed) {
            downloadSpeed.textContent = `${this.formatSize(this.downloadStats.currentSpeed)}/s`;
        }

        if (estimatedTime) {
            estimatedTime.textContent = estimatedTimeRemaining ? this.formatTime(estimatedTimeRemaining) : 'Calculando...';
        }

        // Adicionar entrada ao log
        if (this.downloadStats.lastAction) {
            const logContainer = document.getElementById('activity-log');
            if (logContainer) {
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry ${this.downloadStats.lastAction.status}`;
                logEntry.style.marginBottom = '5px';
                logEntry.style.padding = '5px';
                logEntry.style.borderLeft = `3px solid ${this.getStatusColor(this.downloadStats.lastAction.status)}`;

                logEntry.innerHTML = `
                    <span class="log-time" style="color: #6c757d; margin-right: 8px;">${this.formatTime24h(new Date())}</span>
                    <span class="log-message">${this.downloadStats.lastAction.message}</span>
                `;

                logContainer.insertBefore(logEntry, logContainer.firstChild);

                // Limitar número de entradas
                if (logContainer.children.length > 20) {
                    logContainer.removeChild(logContainer.lastChild);
                }
            }
        }
    }

    /**
     * Retorna cor para status
     */
    getStatusColor(status) {
        switch (status) {
            case 'success': return '#28a745';
            case 'error': return '#dc3545';
            case 'warning': return '#ffc107';
            case 'loading': return '#007bff';
            default: return '#6c757d';
        }
    }

    /**
     * Formata tamanho em bytes para exibição
     */
    formatSize(bytes) {
        if (bytes === undefined || bytes === null) return '0 B';
        if (bytes < 1024) return `${bytes.toFixed(0)} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * Formata tempo em milissegundos para exibição
     */
    formatTime(ms) {
        if (!ms) return 'Desconhecido';

        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Formata hora no formato 24h
     */
    formatTime24h(date) {
        return date.toTimeString().substring(0, 8);
    }
}

/**
 * Sistema preditivo para pré-carregamento inteligente
 */
class PredictivePreloader {
    constructor() {
        this.usagePatterns = this.loadUsagePatterns();
        this.currentSession = {
            startTime: Date.now(),
            accessedForms: new Set(),
            accessedData: new Set()
        };
    }

    loadUsagePatterns() {
        try {
            const stored = localStorage.getItem('ecoforms_usage_patterns');
            return stored ? JSON.parse(stored) : {
                formUsage: {},
                dataSourceUsage: {},
                sessions: []
            };
        } catch (error) {
            console.warn('Erro ao carregar padrões de uso:', error);
            return {
                formUsage: {},
                dataSourceUsage: {},
                sessions: []
            };
        }
    }

    saveUsagePatterns() {
        try {
            localStorage.setItem('ecoforms_usage_patterns', JSON.stringify(this.usagePatterns));
        } catch (error) {
            console.warn('Erro ao salvar padrões de uso:', error);
        }
    }

    recordFormAccess(formId) {
        // Registrar acesso ao formulário
        this.currentSession.accessedForms.add(formId);

        if (!this.usagePatterns.formUsage[formId]) {
            this.usagePatterns.formUsage[formId] = {
                accessCount: 0,
                lastAccess: null,
                relatedForms: {}
            };
        }

        const formStats = this.usagePatterns.formUsage[formId];
        formStats.accessCount++;
        formStats.lastAccess = Date.now();

        // Registrar relações entre formulários
        Array.from(this.currentSession.accessedForms).forEach(otherFormId => {
            if (otherFormId !== formId) {
                if (!formStats.relatedForms[otherFormId]) {
                    formStats.relatedForms[otherFormId] = 0;
                }
                formStats.relatedForms[otherFormId]++;
            }
        });

        this.saveUsagePatterns();
    }

    recordDataAccess(dataSourceId) {
        // Registrar acesso à fonte de dados
        this.currentSession.accessedData.add(dataSourceId);

        if (!this.usagePatterns.dataSourceUsage[dataSourceId]) {
            this.usagePatterns.dataSourceUsage[dataSourceId] = {
                accessCount: 0,
                lastAccess: null,
                relatedToForms: {}
            };
        }

        const dataStats = this.usagePatterns.dataSourceUsage[dataSourceId];
        dataStats.accessCount++;
        dataStats.lastAccess = Date.now();

        // Registrar relações com formulários
        Array.from(this.currentSession.accessedForms).forEach(formId => {
            if (!dataStats.relatedToForms[formId]) {
                dataStats.relatedToForms[formId] = 0;
            }
            dataStats.relatedToForms[formId]++;
        });

        this.saveUsagePatterns();
    }

    endSession() {
        // Salvar dados da sessão atual
        this.usagePatterns.sessions.push({
            startTime: this.currentSession.startTime,
            endTime: Date.now(),
            accessedForms: Array.from(this.currentSession.accessedForms),
            accessedData: Array.from(this.currentSession.accessedData)
        });

        // Limitar número de sessões armazenadas
        if (this.usagePatterns.sessions.length > 10) {
            this.usagePatterns.sessions = this.usagePatterns.sessions.slice(-10);
        }

        this.saveUsagePatterns();

        // Reiniciar sessão
        this.currentSession = {
            startTime: Date.now(),
            accessedForms: new Set(),
            accessedData: new Set()
        };
    }

    predictNextForms(currentFormId) {
        // Prever próximos formulários com base no uso atual
        if (!this.usagePatterns.formUsage[currentFormId]) {
            return [];
        }

        const formStats = this.usagePatterns.formUsage[currentFormId];
        const relatedForms = Object.entries(formStats.relatedForms)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(entry => entry[0]);

        return relatedForms;
    }

    predictRequiredData(formIds) {
        // Prever fontes de dados necessárias com base nos formulários
        const predictedData = new Set();

        formIds.forEach(formId => {
            Object.entries(this.usagePatterns.dataSourceUsage).forEach(([dataId, dataStats]) => {
                if (dataStats.relatedToForms[formId] && dataStats.relatedToForms[formId] > 0) {
                    predictedData.add(dataId);
                }
            });
        });

        return Array.from(predictedData);
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.SmartPreloader = SmartPreloader;
    window.PredictivePreloader = PredictivePreloader;
}