/**
 * Hook-like utility para carregar dados do data_registry
 * Inspirado no useDataRegistry do desktop
 * @param {string} sourceType - Tipo de dados (ex: 'bairros')
 * @param {import('../types/data-registry').DataSourceOptions} [options] - Opções de carregamento
 * @returns {{data: any[], loading: boolean, error: string | null, refresh: () => Promise<void>}}
 */
export function useDataRegistry(sourceType, options = {}) {
    // Criar estado reativo com Alpine
    const state = Alpine.reactive({
        data: [],
        loading: false,
        error: null
    });

    /**
     * Carrega dados da fonte
     */
    const fetchData = async () => {
        if (!sourceType) {
            state.data = [];
            return;
        }

        state.loading = true;
        state.error = null;

        try {
            // Usar SmartCache para aproveitar cache existente
            const data = await window.smartCache.loadDataSource(sourceType, options);
            state.data = Array.isArray(data) ? data : [];

            // Atualizar store centralizado também
            if (window.Alpine?.store) {
                const dataStore = window.Alpine.store('data');
                if (dataStore) {
                    dataStore.setData(sourceType, data, data);
                }
            }
        } catch (err) {
            console.error(`Error fetching data registry (${sourceType}):`, err);
            state.error = err.message || 'Erro ao carregar dados';
            state.data = [];

            // Atualizar store com erro
            if (window.Alpine?.store) {
                const dataStore = window.Alpine.store('data');
                if (dataStore) {
                    dataStore.setError(sourceType, state.error);
                }
            }
        } finally {
            state.loading = false;
        }
    };

    // Carregar imediatamente
    fetchData();

    // Retornar interface similar ao hook do React
    return {
        get data() { return state.data; },
        get loading() { return state.loading; },
        get error() { return state.error; },
        refresh: fetchData
    };
}

/**
 * Hook para obter dados do store (sem fetch)
 * Útil quando os dados já foram carregados
 * @param {string} sourceType
 * @returns {{data: any[], loading: boolean, error: string | null}}
 */
export function useDataStore(sourceType) {
    const dataStore = window.Alpine?.store('data');

    if (!dataStore) {
        console.warn('Data store not available');
        return { data: [], loading: false, error: null };
    }

    return {
        get data() { return dataStore.getData(sourceType); },
        get loading() { return dataStore.isLoading(sourceType); },
        get error() { return dataStore.getError(sourceType); }
    };
}
