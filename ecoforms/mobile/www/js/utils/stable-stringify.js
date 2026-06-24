/**
 * Stable Stringify Utility
 * 
 * Garante que o JSON gerado seja determinístico (chaves ordenadas),
 * essencial para validação de checksum consistente entre Mobile e Desktop.
 */

/**
 * Stringify com chaves ordenadas recursivamente
 * @param {any} data - Dados a serem serializados
 * @returns {string} JSON string com chaves ordenadas
 */
function stableStringify(data) {
    // 1. Array: processar itens recursivamente
    if (Array.isArray(data)) {
        const items = data.map(item => stableStringify(item));
        return `[${items.join(',')}]`;
    }

    // 2. Objeto: ordenar chaves e processar valores
    if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data).sort();
        const parts = keys.map(key => {
            const value = data[key];
            // Ignorar undefined/functions como JSON.stringify padrão faz
            if (value === undefined || typeof value === 'function') {
                return null;
            }
            return `"${key}":${stableStringify(value)}`;
        }).filter(Boolean); // Remove campos ignorados

        return `{${parts.join(',')}}`;
    }

    // 3. Primitivos: usar JSON.stringify padrão para garantir escaping correto
    return JSON.stringify(data);
}

// Export for module systems or attach to window for global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { stableStringify };
} else if (typeof window !== 'undefined') {
    window.stableStringify = stableStringify;
}