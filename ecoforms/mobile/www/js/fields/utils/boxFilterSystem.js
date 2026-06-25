/**
 * Sistema de Filtros Inteligentes para Caixas
 * Otimiza armazenamento e importação de dados no localStorage
 */

// Configuração de categorias de caixas
const BOX_CATEGORIES = {
    ALL: {
        id: 'all',
        name: 'Todos',
        icon: '📦',
        types: [], // Vazio significa todos os tipos
        color: '#2196F3'
    },
    CONSTRUCTION: {
        id: 'construction',
        name: 'Construção Civil',
        icon: '🏗️',
        types: ['Entulho', 'Madeira', 'Poda'],
        color: '#8B4513'
    },
    RECYCLABLE: {
        id: 'recyclable',
        name: 'Recicláveis',
        icon: '♻️',
        types: ['Reciclável', 'Vidro'],
        color: '#4CAF50'
    },
    WASTE: {
        id: 'waste',
        name: 'Resíduos',
        icon: '🗑️',
        types: ['Rejeito', 'Sucata'],
        color: '#FF5722'
    }
};

// Configuração de filtros por ecoponto
const ECOPOINT_FILTERS = {
    'Itacorubi': {
        enabled: true,
        categories: ['all', 'construction', 'recyclable', 'waste'],
        priority: ['Reciclável', 'Entulho', 'Vidro', 'Madeira', 'Poda', 'Sucata', 'Rejeito']
    }
};

// Cache inteligente para filtros
class BoxFilterCache {
    constructor() {
        this.cacheKey = 'box_filters_cache';
        this.expiryTime = 24 * 60 * 60 * 1000; // 24 horas
        this.maxCacheSize = 50; // Máximo de entradas no cache
    }

    // Salva filtro no cache
    saveFilter(ecopoint, category, filteredBoxes) {
        try {
            const cache = this.getCache();
            const key = `${ecopoint}_${category}`;

            cache[key] = {
                data: filteredBoxes,
                timestamp: Date.now(),
                count: filteredBoxes.length
            };

            // Limpa cache antigo se necessário
            this.cleanOldEntries(cache);

            localStorage.setItem(this.cacheKey, JSON.stringify(cache));
        } catch (error) {
            console.warn('Erro ao salvar cache de filtros:', error);
        }
    }

    // Carrega filtro do cache
    loadFilter(ecopoint, category) {
        try {
            const cache = this.getCache();
            const key = `${ecopoint}_${category}`;
            const entry = cache[key];

            if (entry && this.isValidEntry(entry)) {
                return entry.data;
            }

            return null;
        } catch (error) {
            console.warn('Erro ao carregar cache de filtros:', error);
            return null;
        }
    }

    // Obtém cache completo
    getCache() {
        try {
            const cache = localStorage.getItem(this.cacheKey);
            return cache ? JSON.parse(cache) : {};
        } catch (error) {
            console.warn('Erro ao obter cache:', error);
            return {};
        }
    }

    // Verifica se entrada do cache é válida
    isValidEntry(entry) {
        return entry &&
               entry.timestamp &&
               (Date.now() - entry.timestamp) < this.expiryTime;
    }

    // Limpa entradas antigas do cache
    cleanOldEntries(cache) {
        const entries = Object.entries(cache);
        if (entries.length <= this.maxCacheSize) return;

        // Ordena por timestamp (mais recente primeiro)
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);

        // Remove entradas antigas
        const toRemove = entries.slice(this.maxCacheSize);
        toRemove.forEach(([key]) => delete cache[key]);
    }

    // Limpa todo o cache
    clearCache() {
        try {
            localStorage.removeItem(this.cacheKey);
        } catch (error) {
            console.warn('Erro ao limpar cache:', error);
        }
    }

    // Obtém estatísticas do cache
    getStats() {
        const cache = this.getCache();
        const entries = Object.values(cache);

        return {
            totalEntries: entries.length,
            totalSize: entries.reduce((sum, entry) => sum + (entry.count || 0), 0),
            oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
            newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null
        };
    }
}

// Sistema de filtros inteligente
class BoxFilterSystem {
    constructor() {
        this.cache = new BoxFilterCache();
        this.allBoxes = [];
        this.filteredBoxes = [];
    }

    // Carrega dados das caixas
    async loadBoxesData() {
        try {
            const response = await fetch('data/caixas.json');
            this.allBoxes = await response.json();
            return this.allBoxes;
        } catch (error) {
            console.error('Erro ao carregar dados das caixas:', error);
            return [];
        }
    }

    // Aplica filtros inteligentes
    applySmartFilters(ecopoint, category = null, options = {}) {
        const cacheKey = category || 'all';
        let filteredBoxes = this.cache.loadFilter(ecopoint, cacheKey);

        if (!filteredBoxes) {
            // Aplica filtros se não estiver em cache
            filteredBoxes = this.filterBoxes(ecopoint, category, options);

            // Salva no cache
            this.cache.saveFilter(ecopoint, cacheKey, filteredBoxes);
        }

        this.filteredBoxes = filteredBoxes;
        return filteredBoxes;
    }

    // Filtra caixas por critérios
    filterBoxes(ecopoint, category = null, options = {}) {
        let boxes = [...this.allBoxes];

        // Filtro por ecoponto
        boxes = boxes.filter(box => box.ecoponto === ecopoint);

        // Filtro por categoria se especificada
        if (category && category !== 'all' && BOX_CATEGORIES[category.toUpperCase()]) {
            const categoryData = BOX_CATEGORIES[category.toUpperCase()];
            boxes = boxes.filter(box => categoryData.types.includes(box.nome));
        }
        // Se categoria for 'all' ou não especificada, retorna todas as caixas

        // Filtro por prioridade (ordenação inteligente)
        const ecopointConfig = ECOPOINT_FILTERS[ecopoint];
        if (ecopointConfig && ecopointConfig.priority) {
            boxes.sort((a, b) => {
                const aIndex = ecopointConfig.priority.indexOf(a.nome);
                const bIndex = ecopointConfig.priority.indexOf(b.nome);
                return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
            });
        }

        // Filtros adicionais
        if (options.excludeEmpty !== false) {
            // Remove caixas vazias se não especificado o contrário
            boxes = boxes.filter(box => box.nome && box.nome.trim());
        }

        if (options.limit && typeof options.limit === 'number') {
            boxes = boxes.slice(0, options.limit);
        }

        return boxes;
    }

    // Obtém categorias disponíveis para um ecoponto
    getAvailableCategories(ecopoint) {
        const ecopointConfig = ECOPOINT_FILTERS[ecopoint];
        if (!ecopointConfig) return [];

        return ecopointConfig.categories.map(catId => {
            const category = Object.values(BOX_CATEGORIES).find(cat => cat.id === catId);
            return category ? {
                ...category,
                boxCount: this.getBoxesInCategory(ecopoint, catId).length
            } : null;
        }).filter(Boolean);
    }

    // Obtém caixas em uma categoria específica
    getBoxesInCategory(ecopoint, categoryId) {
        const category = Object.values(BOX_CATEGORIES).find(cat => cat.id === categoryId);
        if (!category) return [];

        return this.allBoxes.filter(box =>
            box.ecoponto === ecopoint && category.types.includes(box.nome)
        );
    }

    // Obtém estatísticas de uso do cache
    getCacheStats() {
        return this.cache.getStats();
    }

    // Limpa cache de filtros
    clearFilterCache() {
        this.cache.clearCache();
    }

    // Obtém sugestões de filtros baseadas no uso
    getFilterSuggestions(ecopoint) {
        const categories = this.getAvailableCategories(ecopoint);
        const suggestions = [];

        categories.forEach(category => {
            if (category.boxCount > 0) {
                suggestions.push({
                    type: 'category',
                    id: category.id,
                    name: category.name,
                    icon: category.icon,
                    count: category.boxCount,
                    description: `${category.boxCount} caixas disponíveis`
                });
            }
        });

        return suggestions;
    }
}

// Instância global do sistema de filtros
const boxFilterSystem = new BoxFilterSystem();

// Funções de conveniência para uso global
if (typeof window !== 'undefined') {
    window.BoxFilterSystem = BoxFilterSystem;
    window.boxFilterSystem = boxFilterSystem;
    window.BOX_CATEGORIES = BOX_CATEGORIES;
    window.ECOPOINT_FILTERS = ECOPOINT_FILTERS;
}