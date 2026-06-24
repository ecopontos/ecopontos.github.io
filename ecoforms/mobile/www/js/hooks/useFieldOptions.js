/**
 * Hook para normalizar e gerenciar opções de campos
 * @typedef {import('../types/form').FormField} FormField
 * @typedef {import('../types/form').FieldOption} FieldOption
 */

/**
 * Normaliza opções para formato padrão
 * @param {any[]} rawOptions - Opções brutas
 * @param {FormField} field - Configuração do campo
 * @returns {FieldOption[]}
 */
function normalizeOptions(rawOptions, field) {
    const valueField = field.valueField || field.optionValue || 'value';
    const labelField = field.labelField || field.optionLabel || 'label';

    return rawOptions.map(opt => {
        // String simples
        if (typeof opt === 'string') {
            return { value: opt, label: opt };
        }

        // Número ou primitivo
        if (typeof opt !== 'object' || opt === null) {
            return { value: String(opt), label: String(opt) };
        }

        // Objeto - extrair campos configurados ou fallback
        const value = opt[valueField] || opt.id || opt.value || opt.codigo || opt.nome;
        const label = opt[labelField] || opt.nome || opt.label || opt.name || opt.value;

        return {
            value,
            label,
            icon: opt.icon || opt.emoji || undefined,
            description: opt.descricao || opt.description || undefined
        };
    }).filter(opt => opt.value !== undefined && opt.label !== undefined);
}

/**
 * Hook para carregar e normalizar opções de um campo
 * @param {FormField} field - Configuração do campo
 * @returns {{options: FieldOption[], loading: boolean, error: string | null, refresh: () => Promise<void>}}
 */
export function useFieldOptions(field) {
    const state = Alpine.reactive({
        options: [],
        loading: false,
        error: null
    });

    /**
     * Carrega opções do campo
     */
    const loadOptions = async () => {
        state.loading = true;
        state.error = null;

        try {
            let rawOptions = [];

            // 1. Opções inline (field.options)
            if (field.options && field.options.length) {
                rawOptions = [...field.options];
            }

            // 2. Dados pré-carregados (field.rawData)
            if (field.rawData && field.rawData.length) {
                rawOptions = [...rawOptions, ...field.rawData];
            }

            // 3. Data source (carregar do SmartCache)
            if (field.dataSource || field.source) {
                const dataSource = field.dataSource || field.source;

                try {
                    const data = await window.smartCache.loadDataSource(dataSource);
                    if (Array.isArray(data)) {
                        rawOptions = [...rawOptions, ...data];
                    }
                } catch (err) {
                    console.warn(`Failed to load dataSource '${dataSource}':`, err);
                    // Continuar com opções inline se houver
                }
            }

            // 4. Normalizar todas as opções
            state.options = normalizeOptions(rawOptions, field);

            // 5. Ordenar por padrão
            if (field.sort !== false) {
                state.options.sort((a, b) =>
                    String(a.label).localeCompare(String(b.label), 'pt-BR', { sensitivity: 'base' })
                );
            }

        } catch (err) {
            console.error('Error loading field options:', err);
            state.error = err.message || 'Erro ao carregar opções';
            state.options = [];
        } finally {
            state.loading = false;
        }
    };

    // Carregar imediatamente
    loadOptions();

    return {
        get options() { return state.options; },
        get loading() { return state.loading; },
        get error() { return state.error; },
        refresh: loadOptions
    };
}

/**
 * Hook simplificado que retorna opções já normalizadas
 * Útil quando as opções já estão no campo
 * @param {FormField} field
 * @returns {FieldOption[]}
 */
export function getFieldOptions(field) {
    if (field.options && field.options.length) {
        return normalizeOptions(field.options, field);
    }

    if (field.rawData && field.rawData.length) {
        return normalizeOptions(field.rawData, field);
    }

    return [];
}
