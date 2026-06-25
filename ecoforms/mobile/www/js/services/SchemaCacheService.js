class SchemaCacheService {
    constructor(store) {
        this.store = store;
        this.supabaseClient = null;
    }

    configure(supabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    async loadAndCacheFormSchema(formId) {
        const cached = await this.store.getCachedFormSchema(formId);
        if (cached) return cached;

        if (!this.supabaseClient) return cached || [];

        try {
            const { data: fileData, error: storageError } = await this.supabaseClient
                .storage.from('sync-bucket').download('shared/form_field_registry.json');
            if (storageError) throw storageError;

            const text = await fileData.text();
            const registry = JSON.parse(text);
            const allFields = registry.data || registry.form_field_registry || registry;
            const fields = Array.isArray(allFields)
                ? allFields.filter(f => f.form_id === formId).sort((a, b) => (a.display_priority || 0) - (b.display_priority || 0))
                : [];

            await this.store.cacheFormSchema(formId, fields);
            return fields;
        } catch (error) {
            console.error(`❌ Erro ao carregar form schema ${formId}:`, error);
            return cached || [];
        }
    }
}

if (typeof window !== 'undefined') {
    window.SchemaCacheService = SchemaCacheService;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SchemaCacheService };
}
