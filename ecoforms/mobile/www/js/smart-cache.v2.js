/**
 * SmartCache v2 - Versão simplificada e modernizada
 * 
 * Mudanças principais:
 * - Reduzido de 6 para 3 níveis de fallback
 * - Código mais limpo e legível
 * - Melhor tratamento de erros
 * - Logging estruturado
 * - TypeScript via JSDoc
 * 
 * @typedef {import('./types/data-registry').DataSourceOptions} DataSourceOptions
 * @typedef {import('./types/data-registry').CachedData} CachedData
 */

class SmartCacheV2 {
    constructor() {
        this.storagePrefix = 'ecoforms_cache_';
        this.supabaseClient = null;
        this.maxAge = 24 * 60 * 60 * 1000; // 24 horas
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0
        };
    }

    /**
     * Inicializa o SmartCache
     */
    async init() {
        // Usar cliente Supabase global
        if (window.globalSupabaseClient) {
            this.supabaseClient = window.globalSupabaseClient;
            console.log('✅ SmartCache v2 initialized');
        } else {
            console.warn('⚠️ Supabase client not available');
        }

        // Limpar cache expirado na inicialização
        this.clearExpiredCache();
    }

    /**
     * Carrega data source com estratégia simplificada (3 níveis)
     * @param {string} sourceType - Tipo de dados (ex: 'bairros')
     * @param {DataSourceOptions} [options] - Opções de carregamento
     * @returns {Promise<any[]>}
     */
    async loadDataSource(sourceType, options = {}) {
        const { cache = true, fallbackToExpired = true } = options;

        // 1️⃣ Tentar cache válido
        if (cache) {
            const cached = this.getFromCache(sourceType);
            if (cached) {
                this.stats.hits++;
                console.log(`📋 [Cache HIT] ${sourceType} (${cached.length} items)`);
                return cached;
            }
        }

        // 2️⃣ Buscar do Supabase Storage
        try {
            this.stats.misses++;
            console.log(`📥 [Storage] Fetching ${sourceType}...`);

            // Buscar do Storage em vez de tabela direta
            const { data: fileData, error: storageError } = await this.supabaseClient
                .storage
                .from('sync-bucket')
                .download('shared/data_registry.json');

            if (storageError) throw storageError;

            const text = await fileData.text();
            const registry = JSON.parse(text);
            
            // Extrair dados do registry
            const allData = registry.data || registry.data_registry || registry;
            let data = [];
            
            if (Array.isArray(allData)) {
                data = allData.filter(r => r.tipo === sourceType);
            }

            // Agregar conteúdo de múltiplas linhas
            const aggregated = this.aggregateContent(data);

            // Salvar em cache
            if (cache && aggregated.length > 0) {
                this.saveToCache(sourceType, aggregated);
            }

            console.log(`✅ [Storage] ${sourceType} loaded (${aggregated.length} items)`);
            return aggregated;

        } catch (error) {
            this.stats.errors++;
            console.error(`❌ [Storage] Error loading ${sourceType}:`, error);

            // 3️⃣ Fallback: cache expirado
            if (fallbackToExpired) {
                const expired = this.getFromCache(sourceType, { ignoreExpiration: true });
                if (expired && expired.length > 0) {
                    console.warn(`⚠️ [Cache EXPIRED] Using stale ${sourceType} (${expired.length} items)`);
                    return expired;
                }
            }

            // Retornar array vazio ao invés de falhar
            console.warn(`⚠️ [Empty] Returning empty array for ${sourceType}`);
            return [];
        }
    }

    /**
     * Agrega conteúdo de múltiplas linhas do data_registry
     * @param {any[]} rows - Linhas do data_registry
     * @returns {any[]}
     */
    aggregateContent(rows) {
        if (!rows || !rows.length) return [];

        return rows.reduce((acc, row) => {
            const content = row.conteudo;
            if (Array.isArray(content)) {
                return [...acc, ...content];
            } else if (content && typeof content === 'object') {
                return [...acc, content];
            }
            return acc;
        }, []);
    }

    /**
     * Obtém dados do cache local
     * @param {string} sourceType
     * @param {{ignoreExpiration?: boolean}} [options]
     * @returns {any[] | null}
     */
    getFromCache(sourceType, options = {}) {
        const { ignoreExpiration = false } = options;
        const key = `${this.storagePrefix}data_${sourceType}`;

        try {
            const stored = localStorage.getItem(key);
            if (!stored) return null;

            /** @type {CachedData} */
            const { content, timestamp } = JSON.parse(stored);

            // Verificar expiração
            if (!ignoreExpiration) {
                const age = Date.now() - timestamp;
                if (age > this.maxAge) {
                    localStorage.removeItem(key);
                    return null;
                }
            }

            return content;
        } catch (error) {
            console.error(`Error reading cache for ${sourceType}:`, error);
            localStorage.removeItem(key);
            return null;
        }
    }

    /**
     * Salva dados no cache local
     * @param {string} sourceType
     * @param {any[]} content
     */
    saveToCache(sourceType, content) {
        const key = `${this.storagePrefix}data_${sourceType}`;

        try {
            /** @type {CachedData} */
            const data = {
                content,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`💾 [Cache SAVE] ${sourceType} (${content.length} items)`);
        } catch (error) {
            console.error(`Error saving cache for ${sourceType}:`, error);
            // Tentar limpar espaço
            if (error.name === 'QuotaExceededError') {
                this.clearOldestCache();
                // Tentar novamente
                try {
                    localStorage.setItem(key, JSON.stringify({ content, timestamp: Date.now() }));
                } catch (retryError) {
                    console.error('Failed to save cache even after cleanup:', retryError);
                }
            }
        }
    }

    /**
     * Limpa cache expirado
     * @returns {number} Número de itens removidos
     */
    clearExpiredCache() {
        const keys = Object.keys(localStorage);
        const now = Date.now();
        let removed = 0;

        keys.forEach(key => {
            if (!key.startsWith(this.storagePrefix)) return;

            try {
                const stored = localStorage.getItem(key);
                if (!stored) return;

                const { timestamp } = JSON.parse(stored);

                if (now - timestamp > this.maxAge) {
                    localStorage.removeItem(key);
                    removed++;
                }
            } catch (error) {
                // Remover cache corrompido
                localStorage.removeItem(key);
                removed++;
            }
        });

        if (removed > 0) {
            console.log(`🗑️ Cleared ${removed} expired cache items`);
        }

        return removed;
    }

    /**
     * Limpa o cache mais antigo (quando quota excedida)
     */
    clearOldestCache() {
        const keys = Object.keys(localStorage);
        let oldestKey = null;
        let oldestTime = Infinity;

        keys.forEach(key => {
            if (!key.startsWith(this.storagePrefix)) return;

            try {
                const stored = localStorage.getItem(key);
                if (!stored) return;

                const { timestamp } = JSON.parse(stored);

                if (timestamp < oldestTime) {
                    oldestTime = timestamp;
                    oldestKey = key;
                }
            } catch (error) {
                // Ignorar
            }
        });

        if (oldestKey) {
            localStorage.removeItem(oldestKey);
            console.log(`🗑️ Removed oldest cache: ${oldestKey}`);
        }
    }

    /**
     * Limpa todo o cache
     */
    clearAllCache() {
        const keys = Object.keys(localStorage);
        let removed = 0;

        keys.forEach(key => {
            if (key.startsWith(this.storagePrefix)) {
                localStorage.removeItem(key);
                removed++;
            }
        });

        console.log(`🗑️ Cleared all cache (${removed} items)`);
        this.stats = { hits: 0, misses: 0, errors: 0 };
    }

    /**
     * Obtém estatísticas do cache
     * @returns {{hits: number, misses: number, errors: number, hitRate: string, size: number}}
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(1) : '0.0';

        // Calcular tamanho do cache
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(k => k.startsWith(this.storagePrefix));

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            errors: this.stats.errors,
            hitRate: `${hitRate}%`,
            size: cacheKeys.length
        };
    }

    /**
     * Pré-carrega múltiplas fontes de dados
     * @param {string[]} sourceTypes
     * @returns {Promise<void>}
     */
    async preloadDataSources(sourceTypes) {
        console.log(`📦 Preloading ${sourceTypes.length} data sources...`);

        const promises = sourceTypes.map(sourceType =>
            this.loadDataSource(sourceType).catch(err => {
                console.error(`Failed to preload ${sourceType}:`, err);
                return [];
            })
        );

        await Promise.all(promises);
        console.log(`✅ Preload complete`);
    }
}

// Exportar e criar instância global
if (typeof window !== 'undefined') {
    window.SmartCacheV2 = SmartCacheV2;
    window.smartCacheV2 = new SmartCacheV2();

    // Inicializar quando Supabase estiver pronto
    if (window.globalSupabaseClient) {
        window.smartCacheV2.init();
    } else {
        // Aguardar Supabase
        document.addEventListener('supabase:ready', () => {
            window.smartCacheV2.init();
        });
    }
}

export default SmartCacheV2;
