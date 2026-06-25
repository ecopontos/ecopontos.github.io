/**
 * Form Normalization Service
 * 
 * Serviço para normalizar dados de formulários JSON de diferentes tipos
 * para uma apresentação uniforme na caixa de entrada e relatórios.
 * 
 * Usa o form_field_registry do Supabase para mapear campos dinamicamente.
 */

class FormNormalizationService {
    constructor(supabaseClient) {
        this.client = supabaseClient;
        this.fieldRegistry = new Map(); // Cache local do registry
        this.registryLoadPromises = new Map(); // Promessas de carregamento
    }

    /**
     * Carrega schema do formulário do registry (via Storage)
     * @param {string} formId - ID do formulário (ex: 'ecopontoForm')
     * @returns {Promise<Array>} Array de campos do formulário
     */
    async loadFormSchema(formId) {
        // Retornar cache se disponível
        if (this.fieldRegistry.has(formId)) {
            return this.fieldRegistry.get(formId);
        }

        // Evitar múltiplas requisições simultâneas
        if (this.registryLoadPromises.has(formId)) {
            return await this.registryLoadPromises.get(formId);
        }

        // Criar promessa de carregamento
        const loadPromise = (async () => {
            try {
                // Buscar do Storage em vez de tabela direta
                const { data: fileData, error: storageError } = await this.client
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

                this.fieldRegistry.set(formId, fields);
                return fields;
            } catch (error) {
                console.error(`Erro ao carregar schema do formulário ${formId}:`, error);
                return [];
            } finally {
                this.registryLoadPromises.delete(formId);
            }
        })();

        this.registryLoadPromises.set(formId, loadPromise);
        return await loadPromise;
    }

    /**
     * Extrai campos importantes de um registro JSONB
     * @param {Object} formData - Dados do formulário (JSONB)
     * @param {Array} schema - Schema do registry
     * @returns {Object} Campos extraídos com labels e valores formatados
     */
    extractMainFields(formData, schema) {
        const extracted = {};

        for (const field of schema) {
            // Apenas campos principais (display_priority < 50)
            if (field.display_priority < 50) {
                const value = this.getNestedValue(formData, field.field_path);
                extracted[field.field_name] = {
                    label: field.field_label,
                    value: this.formatValue(value, field.format_rule, field.field_type),
                    type: field.field_type,
                    priority: field.display_priority
                };
            }
        }

        return extracted;
    }

    /**
     * Obtém valor aninhado usando path (e.g., 'atendimento.endereco.bairro')
     * @param {Object} obj - Objeto a percorrer
     * @param {string} path - Path separado por pontos
     * @returns {any} Valor encontrado ou null
     */
    getNestedValue(obj, path) {
        if (!obj || !path) return null;
        
        return path.split('.').reduce((current, key) => {
            if (current === null || current === undefined) return null;
            return current[key];
        }, obj);
    }

    /**
     * Formata valor de acordo com regra
     * @param {any} value - Valor a formatar
     * @param {string} formatRule - Regra de formatação
     * @param {string} fieldType - Tipo do campo
     * @returns {string} Valor formatado
     */
    formatValue(value, formatRule, fieldType) {
        if (value === null || value === undefined) return '';

        // Formatação por tipo de campo
        if (fieldType === 'array' && Array.isArray(value)) {
            return `${value.length} ${value.length === 1 ? 'item' : 'itens'}`;
        }

        // Formatação por regra específica
        switch (formatRule) {
            case 'uppercase':
                return String(value).toUpperCase();
            
            case 'cpf':
                return this.formatCPF(value);
            
            case 'currency':
                return new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }).format(value);
            
            case 'date':
                return new Date(value).toLocaleDateString('pt-BR');
            
            case 'datetime':
                return new Date(value).toLocaleString('pt-BR');
            
            case 'time':
                return new Date(value).toLocaleTimeString('pt-BR');
            
            default:
                return String(value);
        }
    }

    /**
     * Formata CPF
     * @param {string} cpf - CPF sem formatação
     * @returns {string} CPF formatado
     */
    formatCPF(cpf) {
        const cleaned = String(cpf).replace(/\D/g, '');
        if (cleaned.length !== 11) return cpf;
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    /**
     * Cria resumo visual para caixa de entrada
     * @param {Object} record - Registro da view vw_inbox_normalizada
     * @returns {Promise<Object>} Resumo formatado
     */
    async createInboxSummary(record) {
        const schema = await this.loadFormSchema(record.form_type || record.tipo_form);
        const mainFields = this.extractMainFields(record.dados_completos || record.dados, schema);

        return {
            id: record.id,
            title: record.titulo || record.form_type || 'Formulário',
            subtitle: record.localizacao || record.endereco_completo || '',
            user: record.user_name || 'Usuário',
            date: record.data_evento || record.criado_em,
            status: record.status || 'pending',
            completeness: record.completeness || 0,
            mainFields: mainFields,
            formType: record.form_type || record.tipo_form,
            isDraft: record.is_draft || false,
            isComplete: record.is_complete || false,
            isValidated: record.is_validated || false,
            rawData: record.dados_completos || record.dados // Para drill-down
        };
    }

    /**
     * Busca em todos os formulários (local)
     * @param {string} searchTerm - Termo de busca
     * @param {Object} filters - Filtros adicionais
     * @returns {Promise<Array>} Resultados da busca
     */
    async search(searchTerm, filters = {}) {
        try {
            // Buscar do cache local (dataService)
            if (window.dataService && window.dataService.searchForms) {
                return await window.dataService.searchForms(searchTerm, filters);
            }
            
            // Fallback: buscar do IndexedDB diretamente
            console.warn('searchForms não disponível no dataService, retornando []');
            return [];
        } catch (error) {
            console.error('Erro na busca:', error);
            throw error;
        }
    }

    /**
     * Carrega inbox normalizado (local)
     * @param {Object} filters - Filtros de busca
     * @returns {Promise<Array>} Lista de registros normalizados
     */
    async loadInbox(filters = {}) {
        try {
            // Buscar do cache local (dataService)
            if (window.dataService && window.dataService.getFormSubmissions) {
                const records = await window.dataService.getFormSubmissions(filters);
                
                // Enriquecer com campos principais
                const enriched = await Promise.all(
                    (records || []).map(record => this.createInboxSummary(record))
                );

                return enriched;
            }
            
            // Fallback: buscar do IndexedDB
            console.warn('getFormSubmissions não disponível no dataService, retornando []');
            return [];
        } catch (error) {
            console.error('Erro ao carregar inbox:', error);
            throw error;
        }
    }

    /**
     * Carrega resumo simplificado (local)
     * @param {Object} filters - Filtros de busca
     * @returns {Promise<Array>} Lista de resumos
     */
    async loadInboxSummary(filters = {}) {
        try {
            // Buscar do cache local (dataService)
            if (window.dataService && window.dataService.getFormSubmissions) {
                const records = await window.dataService.getFormSubmissions(filters);
                return records || [];
            }
            
            // Fallback
            console.warn('getFormSubmissions não disponível no dataService, retornando []');
            return [];
        } catch (error) {
            console.error('Erro ao carregar resumo:', error);
            throw error;
        }
    }

    /**
     * Obtém estatísticas de formulários (local)
     * @param {Object} options - Opções de filtro
     * @returns {Promise<Array>} Estatísticas por tipo de formulário
     */
    async getStats(options = {}) {
        try {
            // Buscar do cache local (dataService)
            if (window.dataService && window.dataService.getFormStats) {
                return await window.dataService.getFormStats(options);
            }
            
            // Fallback
            console.warn('getFormStats não disponível no dataService, retornando []');
            return [];
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
            throw error;
        }
    }

    /**
     * Obtém valores únicos de um campo (local)
     * @param {string} formType - Tipo do formulário
     * @param {string} fieldPath - Path do campo
     * @param {number} limit - Limite de resultados
     * @returns {Promise<Array>} Lista de valores únicos com contagem
     */
    async getFieldUniqueValues(formType, fieldPath, limit = 100) {
        try {
            // Buscar do cache local (dataService)
            if (window.dataService && window.dataService.getFieldUniqueValues) {
                return await window.dataService.getFieldUniqueValues(formType, fieldPath, limit);
            }
            
            // Fallback
            console.warn('getFieldUniqueValues não disponível no dataService, retornando []');
            return [];
        } catch (error) {
            console.error('Erro ao carregar valores únicos:', error);
            throw error;
        }
    }

    /**
     * Limpa cache do registry
     */
    clearCache() {
        this.fieldRegistry.clear();
        this.registryLoadPromises.clear();
    }

    /**
     * Recarrega schema de um formulário específico
     * @param {string} formId - ID do formulário
     * @returns {Promise<Array>} Schema recarregado
     */
    async reloadSchema(formId) {
        this.fieldRegistry.delete(formId);
        return await this.loadFormSchema(formId);
    }
}

// Instância global
if (typeof window !== 'undefined') {
    window.FormNormalizationService = FormNormalizationService;
    
    // Auto-inicialização se dataService já estiver disponível
    if (window.dataService?.supabaseClient) {
        window.formNormalizationService = new FormNormalizationService(
            window.dataService.supabaseClient
        );
        console.log('✅ FormNormalizationService inicializado');
    } else {
        // Esperar dataService ficar disponível
        document.addEventListener('dataServiceReady', () => {
            if (window.dataService?.supabaseClient) {
                window.formNormalizationService = new FormNormalizationService(
                    window.dataService.supabaseClient
                );
                console.log('✅ FormNormalizationService inicializado (após dataService)');
            }
        });
    }
}

// Export para módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormNormalizationService;
}
