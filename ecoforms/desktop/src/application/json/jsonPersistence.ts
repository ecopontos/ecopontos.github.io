export type JsonRecord = Record<string, unknown>;

export function isJsonRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parsePersistedJson(value: unknown, maxDepth = 2): unknown | null {
    let current = value;
    for (let depth = 0; depth < maxDepth; depth++) {
        if (typeof current !== 'string') return current ?? null;
        try {
            current = JSON.parse(current);
        } catch {
            return null;
        }
    }
    return current;
}

export function parsePersistedJsonRecord(value: unknown): JsonRecord | null {
    const parsed = parsePersistedJson(value);
    return isJsonRecord(parsed) ? parsed : null;
}

export function getPersistedFormFields(value: unknown): JsonRecord[] {
    const form = parsePersistedJsonRecord(value);
    const campos = form?.campos;
    return Array.isArray(campos) ? campos.filter(isJsonRecord) : [];
}
