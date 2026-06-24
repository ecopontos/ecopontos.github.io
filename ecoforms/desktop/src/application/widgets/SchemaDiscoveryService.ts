/**
 * SchemaDiscoveryService — descobre o campo ID de um datasource a partir
 * dos itens do DataRegistry, evitando mapas hardcoded (KNOWN map) no
 * FieldPropertiesPanel. Cache lazy-populated pelos componentes que já
 * carregam dados (ex.: DataSourceSchemaPreview).
 */
export class SchemaDiscoveryService {
    private static _idFieldCache = new Map<string, string>();

    /** Retorna o nome do campo identificador inferido para um datasource. */
    static discoverFilterProperty(datasource: string): string | null {
        if (SchemaDiscoveryService._idFieldCache.has(datasource)) {
            return SchemaDiscoveryService._idFieldCache.get(datasource)!;
        }

        // Tentar heurística nos dados já carregados
        const items = SchemaDiscoveryService._itemsCache.get(datasource);
        if (items && items.length > 0) {
            const idField = inferIdField(datasource, items);
            SchemaDiscoveryService._idFieldCache.set(datasource, idField);
            return idField;
        }

        return null; // cache miss — caller usa fallback heurístico
    }

    /** Cache de itens populado pelo DataSourceSchemaPreview ou similar. */
    private static _itemsCache = new Map<string, unknown[]>();

    static feedItems(datasource: string, items: unknown[]): void {
        SchemaDiscoveryService._itemsCache.set(datasource, items);
    }

    static invalidate(datasource?: string): void {
        if (datasource) {
            SchemaDiscoveryService._idFieldCache.delete(datasource);
            SchemaDiscoveryService._itemsCache.delete(datasource);
        } else {
            SchemaDiscoveryService._idFieldCache.clear();
            SchemaDiscoveryService._itemsCache.clear();
        }
    }
}

/** Heurística para inferir o campo ID de uma coleção de itens. */
function inferIdField(datasource: string, items: unknown[]): string {
    if (items.length === 0) return "";

    const first = items[0];
    if (!first || typeof first !== "object") return "";

    const keys = Object.keys(first as Record<string, unknown>);
    if (keys.length === 0) return "";

    // Procurar chave que termina com _id
    const idKey = keys.find(k => k.endsWith("_id"));
    if (idKey) return idKey;

    // Procurar chave literal "id"
    if (keys.includes("id")) return "id";

    // Fallback: singularizar o nome do datasource
    let entity = datasource.replace(/_ativos$|_crm$|_todos$|_atuais$/, "");
    entity = entity.replace(/res$/, "r").replace(/es$/, "e").replace(/s$/, "");
    return entity ? `${entity}_id` : "";
}
