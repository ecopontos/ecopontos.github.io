export interface FieldSchema {
    key: string;
    label: string;
    type: "string" | "number" | "boolean" | "select" | "textarea";
    required: boolean;
    options?: string[];
}

const EXCLUDED_KEYS = new Set(["nome", "ativo", "id"]);

/**
 * Detects a field schema from the conteudo of existing DataRegistry items.
 * Analyses all items of a given type and infers field types from their values.
 */
export function detectSchemaFromItems(items: { conteudo: unknown }[]): FieldSchema[] {
    const fieldStats = new Map<
        string,
        { count: number; types: Map<string, number>; values: Set<string>; maxLen: number }
    >();

    for (const item of items) {
        const content = item.conteudo;
        if (!content || typeof content !== "object") continue;

        for (const [key, val] of Object.entries(content)) {
            if (EXCLUDED_KEYS.has(key)) continue;

            if (!fieldStats.has(key)) {
                fieldStats.set(key, { count: 0, types: new Map(), values: new Set(), maxLen: 0 });
            }
            const stat = fieldStats.get(key)!;
            stat.count++;

            const vtype = typeof val;
            stat.types.set(vtype, (stat.types.get(vtype) || 0) + 1);

            if (val != null) {
                const s = String(val);
                if (s.length < 60) stat.values.add(s);
                if (s.length > stat.maxLen) stat.maxLen = s.length;
            }
        }
    }

    const totalItems = items.length;
    const schema: FieldSchema[] = [];

    for (const [key, stat] of fieldStats) {
        const dominantType = [...stat.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "string";
        const required = stat.count >= totalItems * 0.8;

        let fieldType: FieldSchema["type"];
        if (dominantType === "boolean") {
            fieldType = "boolean";
        } else if (dominantType === "number") {
            fieldType = "number";
        } else if (stat.values.size > 0 && stat.values.size <= 15 && stat.count >= 3) {
            fieldType = "select";
        } else if (stat.maxLen > 100) {
            fieldType = "textarea";
        } else {
            fieldType = "string";
        }

        schema.push({
            key,
            label: formatLabel(key),
            type: fieldType,
            required,
            options: fieldType === "select" ? [...stat.values].sort() : undefined,
        });
    }

    // Sort: required first, then alphabetically
    schema.sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1;
        return a.key.localeCompare(b.key);
    });

    return schema;
}

function formatLabel(key: string): string {
    return key
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Flattens conteudo objects into a consistent set of columns for export / table display.
 */
export function flattenRegistryItems(items: { chave: string; conteudo: Record<string, unknown>; versao: string | number }[]) {
    const allKeys = new Set<string>();
    for (const item of items) {
        if (item.conteudo && typeof item.conteudo === "object") {
            Object.keys(item.conteudo).forEach((k) => allKeys.add(k));
        }
    }
    const columns = [...allKeys].sort();

    const serializeCellValue = (value: unknown) => {
        if (value === undefined || value === null) return "";
        if (typeof value === "object") return JSON.stringify(value);
        return value;
    };

    const rows = items.map((item) => {
        const row: Record<string, unknown> = { chave: item.chave };
        for (const col of columns) {
            const val = item.conteudo?.[col];
            row[col] = serializeCellValue(val);
        }
        row["versao"] = serializeCellValue(item.versao);
        return row;
    });

    return { columns: ["chave", ...columns, "versao"], rows };
}

/**
 * Computes similarity between two strings for auto-mapping CSV columns → schema fields.
 */
export function similarityScore(a: string, b: string): number {
    const la = a.toLowerCase().replace(/[_\- ]/g, "");
    const lb = b.toLowerCase().replace(/[_\- ]/g, "");
    if (la === lb) return 1;
    if (la.includes(lb) || lb.includes(la)) return 0.8;
    // Simple character overlap
    const setA = new Set(la);
    const setB = new Set(lb);
    const intersection = [...setA].filter((c) => setB.has(c)).length;
    const union = new Set([...setA, ...setB]).size;
    return intersection / union;
}
