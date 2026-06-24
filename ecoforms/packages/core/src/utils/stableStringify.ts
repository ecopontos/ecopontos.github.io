/**
 * Stable Stringify Utility
 *
 * Garante que o JSON gerado seja determinístico (chaves ordenadas),
 * essencial para validação de checksum consistente entre Mobile e Desktop.
 */

export function stableStringify(data: unknown): string {
    if (Array.isArray(data)) {
        const items = data.map(item => stableStringify(item));
        return `[${items.join(',')}]`;
    }

    if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data).sort();
        const parts = keys.map(key => {
            const value = (data as Record<string, unknown>)[key];
            if (value === undefined || typeof value === 'function') {
                return null;
            }
            return `${JSON.stringify(key)}:${stableStringify(value)}`;
        }).filter(Boolean);

        return `{${parts.join(',')}}`;
    }

    return JSON.stringify(data);
}
