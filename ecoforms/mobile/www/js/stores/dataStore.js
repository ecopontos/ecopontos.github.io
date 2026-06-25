/**
 * Store centralizado para data sources
 * Substitui window.selectorData e window.rawDataSources
 */

/**
 * Cria o store de dados
 * @returns {Object}
 */
export function createDataStore() {
    return {
        // Cache de dados normalizados (para uso em campos)
        /** @type {Object.<string, any[]>} */
        normalized: {},

        // Cache de dados brutos (para processamento avançado)
        /** @type {Object.<string, any[]>} */
        raw: {},

        // Estados de loading por data source
        /** @type {Object.<string, boolean>} */
        loading: {},

        // Erros por data source
        /** @type {Object.<string, string>} */
        errors: {},

        // Getters
        /**
         * Obtém dados normalizados de uma fonte
         * @param {string} sourceType - Tipo da fonte (ex: 'bairros')
         * @returns {any[]}
         */
        getData(sourceType) {
            return this.normalized[sourceType] || [];
        },

        /**
         * Obtém dados brutos de uma fonte
         * @param {string} sourceType
         * @returns {any[]}
         */
        getRawData(sourceType) {
            return this.raw[sourceType] || [];
        },

        /**
         * Verifica se uma fonte está carregando
         * @param {string} sourceType
         * @returns {boolean}
         */
        isLoading(sourceType) {
            return this.loading[sourceType] || false;
        },

        /**
         * Obtém erro de uma fonte
         * @param {string} sourceType
         * @returns {string | undefined}
         */
        getError(sourceType) {
            return this.errors[sourceType];
        },

        /**
         * Verifica se uma fonte tem dados carregados
         * @param {string} sourceType
         * @returns {boolean}
         */
        hasData(sourceType) {
            return (this.normalized[sourceType]?.length || 0) > 0;
        },

        // Setters
        /**
         * Define dados para uma fonte
         * @param {string} sourceType
         * @param {any[]} rawData - Dados brutos
         * @param {any[]} normalizedData - Dados normalizados
         */
        setData(sourceType, rawData, normalizedData) {
            this.raw[sourceType] = rawData;
            this.normalized[sourceType] = normalizedData;
            this.loading[sourceType] = false;
            delete this.errors[sourceType];
        },

        /**
         * Define estado de loading
         * @param {string} sourceType
         * @param {boolean} loading
         */
        setLoading(sourceType, loading) {
            this.loading[sourceType] = loading;
        },

        /**
         * Define erro para uma fonte
         * @param {string} sourceType
         * @param {string} error
         */
        setError(sourceType, error) {
            this.errors[sourceType] = error;
            this.loading[sourceType] = false;
        },

        /**
         * Limpa dados de uma fonte
         * @param {string} sourceType
         */
        clearData(sourceType) {
            delete this.normalized[sourceType];
            delete this.raw[sourceType];
            delete this.loading[sourceType];
            delete this.errors[sourceType];
        },

        /**
         * Limpa todos os dados
         */
        clearAll() {
            this.normalized = {};
            this.raw = {};
            this.loading = {};
            this.errors = {};
        },

        // Utilities
        /**
         * Obtém estatísticas do cache
         * @returns {{total: number, loading: number, errors: number}}
         */
        getStats() {
            return {
                total: Object.keys(this.normalized).length,
                loading: Object.values(this.loading).filter(Boolean).length,
                errors: Object.keys(this.errors).length
            };
        }
    };
}

// Registrar store no Alpine quando disponível
if (typeof window !== 'undefined') {
    document.addEventListener('alpine:init', () => {
        if (window.Alpine && typeof window.Alpine.store === 'function') {
            window.Alpine.store('data', createDataStore());
            console.log('✅ Data store registered');
        }
    });
}
