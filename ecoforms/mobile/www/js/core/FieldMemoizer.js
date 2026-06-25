/**
 * FieldMemoizer - Sistema de memoização para campos de formulário
 * Cache inteligente de renderização para campos com lógica complexa
 * 
 * Características:
 * - Cache baseado em hash de props
 * - Invalidação automática quando props mudam
 * - TTL configurável por campo
 * - LRU (Least Recently Used) eviction
 * - Métricas de hit/miss
 * - Suporte a campos condicionais
 * 
 * @example
 * const memoizer = new FieldMemoizer({ maxSize: 100 });
 * 
 * const cached = memoizer.memoize(fieldId, fieldConfig, () => {
 *   return expensiveRenderFunction(fieldConfig);
 * });
 */

import { eventBus } from './EventEmitter.js';

export class FieldMemoizer {
    constructor(options = {}) {
        this.options = {
            maxSize: 200, // Máximo de campos em cache
            ttl: 60000, // TTL padrão: 1 minuto
            enabled: true,
            trackMetrics: true,
            ...options
        };

        this.cache = new Map();
        this.accessOrder = []; // Para LRU
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            invalidations: 0
        };

        this.hashCache = new Map(); // Cache de hashes para performance
    }

    /**
     * Memoiza renderização de um campo
     * @param {string} fieldId - ID único do campo
     * @param {object} config - Configuração do campo
     * @param {Function} renderFn - Função de renderização
     * @param {object} options - Opções de memoização
     * @returns {*} - Resultado renderizado (do cache ou novo)
     */
    memoize(fieldId, config, renderFn, options = {}) {
        if (!this.options.enabled) {
            return renderFn();
        }

        const cacheKey = this.getCacheKey(fieldId, config);
        const cached = this.get(cacheKey);

        // Cache hit
        if (cached) {
            this.updateAccessOrder(cacheKey);
            this.metrics.hits++;
            
            eventBus.emit('fieldMemoizerHit', { fieldId, cacheKey });
            
            return cached.value;
        }

        // Cache miss - renderizar
        this.metrics.misses++;
        const startTime = performance.now();
        const result = renderFn();
        const renderTime = performance.now() - startTime;

        // Armazenar no cache
        this.set(cacheKey, result, {
            fieldId,
            config,
            renderTime,
            ttl: options.ttl || this.options.ttl
        });

        eventBus.emit('fieldMemoizerMiss', {
            fieldId,
            cacheKey,
            renderTime
        });

        return result;
    }

    /**
     * Gera chave de cache baseada em fieldId e hash da config
     * @param {string} fieldId - ID do campo
     * @param {object} config - Configuração do campo
     * @returns {string} - Chave de cache
     */
    getCacheKey(fieldId, config) {
        const hash = this.hashConfig(config);
        return `${fieldId}_${hash}`;
    }

    /**
     * Gera hash da configuração do campo
     * @param {object} config - Configuração do campo
     * @returns {string} - Hash da configuração
     */
    hashConfig(config) {
        // Verificar cache de hash
        const configStr = JSON.stringify(config);
        
        if (this.hashCache.has(configStr)) {
            return this.hashCache.get(configStr);
        }

        // Gerar hash simples mas eficiente
        let hash = 0;
        for (let i = 0; i < configStr.length; i++) {
            const char = configStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converter para 32bit integer
        }

        const hashStr = hash.toString(36);
        this.hashCache.set(configStr, hashStr);

        return hashStr;
    }

    /**
     * Obtém valor do cache
     * @param {string} key - Chave de cache
     * @returns {object|null} - Entrada do cache ou null
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Verificar TTL
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            this.metrics.evictions++;
            return null;
        }

        return entry;
    }

    /**
     * Armazena valor no cache
     * @param {string} key - Chave de cache
     * @param {*} value - Valor a armazenar
     * @param {object} metadata - Metadados da entrada
     */
    set(key, value, metadata = {}) {
        // Aplicar LRU eviction se cache estiver cheio
        if (this.cache.size >= this.options.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            ttl: metadata.ttl || this.options.ttl,
            metadata
        });

        this.accessOrder.push(key);
    }

    /**
     * Atualiza ordem de acesso (LRU)
     * @param {string} key - Chave acessada
     */
    updateAccessOrder(key) {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    /**
     * Remove chave da ordem de acesso
     * @param {string} key - Chave a remover
     */
    removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index !== -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    /**
     * Remove entrada menos recentemente usada (LRU eviction)
     */
    evictLRU() {
        if (this.accessOrder.length === 0) {
            return;
        }

        const lruKey = this.accessOrder.shift();
        this.cache.delete(lruKey);
        this.metrics.evictions++;

        eventBus.emit('fieldMemoizerEviction', { key: lruKey });
    }

    /**
     * Invalida cache de um campo específico
     * @param {string} fieldId - ID do campo
     */
    invalidate(fieldId) {
        let invalidated = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.metadata.fieldId === fieldId) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
                invalidated++;
            }
        }

        this.metrics.invalidations += invalidated;

        eventBus.emit('fieldMemoizerInvalidated', {
            fieldId,
            count: invalidated
        });

        return invalidated;
    }

    /**
     * Invalida cache de múltiplos campos
     * @param {string[]} fieldIds - Array de IDs de campos
     */
    invalidateMultiple(fieldIds) {
        const fieldIdSet = new Set(fieldIds);
        let invalidated = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (fieldIdSet.has(entry.metadata.fieldId)) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
                invalidated++;
            }
        }

        this.metrics.invalidations += invalidated;

        eventBus.emit('fieldMemoizerInvalidatedMultiple', {
            fieldIds,
            count: invalidated
        });

        return invalidated;
    }

    /**
     * Invalida cache por padrão
     * @param {RegExp|Function} pattern - Padrão ou função de teste
     */
    invalidateByPattern(pattern) {
        let invalidated = 0;

        for (const [key, entry] of this.cache.entries()) {
            const shouldInvalidate = pattern instanceof RegExp
                ? pattern.test(entry.metadata.fieldId)
                : pattern(entry.metadata.fieldId, entry.metadata.config);

            if (shouldInvalidate) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
                invalidated++;
            }
        }

        this.metrics.invalidations += invalidated;

        eventBus.emit('fieldMemoizerInvalidatedPattern', {
            pattern: pattern.toString(),
            count: invalidated
        });

        return invalidated;
    }

    /**
     * Limpa todo o cache
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.accessOrder = [];
        this.hashCache.clear();
        this.metrics.invalidations += size;

        eventBus.emit('fieldMemoizerCleared', { size });
    }

    /**
     * Pré-aquece cache com campos
     * @param {Array} fields - Array de campos para pré-carregar
     * @param {Function} renderFn - Função de renderização
     */
    async warmup(fields, renderFn) {
        const startTime = performance.now();
        let warmedUp = 0;

        for (const field of fields) {
            try {
                this.memoize(field.id, field, () => renderFn(field));
                warmedUp++;
            } catch (error) {
                console.error(`Erro ao pré-aquecer campo ${field.id}:`, error);
            }
        }

        const duration = performance.now() - startTime;

        eventBus.emit('fieldMemoizerWarmedUp', {
            fields: warmedUp,
            duration
        });

        return { warmedUp, duration };
    }

    /**
     * Retorna métricas de cache
     * @returns {object} - Métricas
     */
    getMetrics() {
        const total = this.metrics.hits + this.metrics.misses;
        const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

        return {
            ...this.metrics,
            total,
            hitRate: hitRate.toFixed(2) + '%',
            cacheSize: this.cache.size,
            maxSize: this.options.maxSize,
            usage: ((this.cache.size / this.options.maxSize) * 100).toFixed(2) + '%'
        };
    }

    /**
     * Reseta métricas
     */
    resetMetrics() {
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            invalidations: 0
        };
    }

    /**
     * Retorna entradas do cache para debug
     */
    getCacheEntries() {
        return Array.from(this.cache.entries()).map(([key, entry]) => ({
            key,
            fieldId: entry.metadata.fieldId,
            age: Date.now() - entry.timestamp,
            renderTime: entry.metadata.renderTime
        }));
    }

    /**
     * Configurar opções dinamicamente
     */
    configure(options) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Habilita ou desabilita memoização
     */
    setEnabled(enabled) {
        this.options.enabled = !!enabled;
        
        if (!enabled) {
            this.clear();
        }
    }
}

/**
 * FieldRenderer - Gerenciador de renderização com memoização integrada
 * Combina VirtualScroller e FieldMemoizer para performance máxima
 */
export class FieldRenderer {
    constructor(options = {}) {
        this.memoizer = new FieldMemoizer(options.memoizerOptions);
        this.renderers = new Map(); // Cache de funções de renderização por tipo
        
        this.options = {
            enableMemoization: true,
            memoizeExpensiveOnly: false, // Apenas campos complexos
            expensiveThreshold: 10, // ms - tempo para considerar caro
            ...options
        };

        this.renderTimes = new Map(); // Histórico de tempos de renderização
    }

    /**
     * Registra renderer para um tipo de campo
     * @param {string} fieldType - Tipo do campo
     * @param {Function} renderer - Função de renderização
     */
    registerRenderer(fieldType, renderer) {
        this.renderers.set(fieldType, renderer);
    }

    /**
     * Renderiza um campo com memoização automática
     * @param {object} field - Configuração do campo
     * @returns {HTMLElement|string} - Elemento renderizado
     */
    render(field) {
        const fieldType = field.type || 'text';
        const renderer = this.renderers.get(fieldType);

        if (!renderer) {
            console.warn(`Renderer não registrado para tipo: ${fieldType}`);
            return this.renderFallback(field);
        }

        // Decidir se deve memoizar
        const shouldMemoize = this.shouldMemoizeField(field);

        if (shouldMemoize && this.options.enableMemoization) {
            return this.memoizer.memoize(field.id, field, () => {
                return this.executeRenderer(renderer, field);
            });
        } else {
            return this.executeRenderer(renderer, field);
        }
    }

    /**
     * Executa renderer e rastreia tempo
     */
    executeRenderer(renderer, field) {
        const startTime = performance.now();
        const result = renderer(field);
        const renderTime = performance.now() - startTime;

        // Armazenar tempo de renderização
        this.recordRenderTime(field.id, renderTime);

        return result;
    }

    /**
     * Determina se campo deve ser memoizado
     */
    shouldMemoizeField(field) {
        // Sempre memoizar se não for modo seletivo
        if (!this.options.memoizeExpensiveOnly) {
            return true;
        }

        // Verificar histórico de render time
        const avgTime = this.getAverageRenderTime(field.id);
        if (avgTime && avgTime > this.options.expensiveThreshold) {
            return true;
        }

        // Heurísticas baseadas no tipo de campo
        const expensiveTypes = [
            'signature',
            'photo-gallery',
            'camera',
            'checklist',
            'vistoria-checklist',
            'presence',
            'conditional-group'
        ];

        if (expensiveTypes.includes(field.type)) {
            return true;
        }

        // Campos com lógica condicional complexa
        if (field.conditionalLogic && field.conditionalLogic.rules?.length > 3) {
            return true;
        }

        // Campos com muitos options
        if (field.options && field.options.length > 20) {
            return true;
        }

        return false;
    }

    /**
     * Registra tempo de renderização
     */
    recordRenderTime(fieldId, time) {
        if (!this.renderTimes.has(fieldId)) {
            this.renderTimes.set(fieldId, []);
        }

        const times = this.renderTimes.get(fieldId);
        times.push(time);

        // Manter apenas últimas 10 medições
        if (times.length > 10) {
            times.shift();
        }
    }

    /**
     * Obtém tempo médio de renderização de um campo
     */
    getAverageRenderTime(fieldId) {
        const times = this.renderTimes.get(fieldId);
        
        if (!times || times.length === 0) {
            return null;
        }

        const sum = times.reduce((a, b) => a + b, 0);
        return sum / times.length;
    }

    /**
     * Renderização fallback para campos sem renderer
     */
    renderFallback(field) {
        return `
            <div class="field-container field-fallback" data-field-id="${field.id}">
                <label>${field.label || field.id}</label>
                <input type="text" id="${field.id}" placeholder="Renderer não disponível" disabled />
            </div>
        `;
    }

    /**
     * Invalida cache de um campo
     */
    invalidate(fieldId) {
        return this.memoizer.invalidate(fieldId);
    }

    /**
     * Obtém métricas combinadas
     */
    getMetrics() {
        return {
            memoizer: this.memoizer.getMetrics(),
            renderers: this.renderers.size,
            trackedFields: this.renderTimes.size
        };
    }
}

export default FieldMemoizer;
