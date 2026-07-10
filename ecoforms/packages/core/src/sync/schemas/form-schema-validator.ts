/**
 * Validador do contrato JSON compartilhado de formulários EcoForms.
 * Usado por mobile (ai-form-builder) e desktop (FormBuilder/VisualEditor)
 * para garantir compatibilidade entre os dois lados.
 *
 * Schema canônico: packages/core/src/sync/schemas/form-schema.json
 */

export type FormFieldType =
    | "text" | "textarea" | "number" | "email" | "tel" | "url" | "password"
    | "date" | "time" | "datetime"
    | "select" | "radio" | "checkbox" | "chips"
    | "file" | "camera" | "photo" | "signature" | "location"
    | "hidden" | "group" | "repeatable-group"
    | "presence" | "checklist" | "vistoria_checklist"
    | "occupation-selector" | "selector-modal" | "cards-radio" | "caixas-avancado"
    | "composite_gallery_collector";

export interface FormFieldContract {
    id: string;
    label: string;
    type: FormFieldType | string;
    required?: boolean;
    options?: Array<string | { label: string; value: string }>;
    placeholder?: string;
    helpText?: string;
    description?: string;
    defaultValue?: unknown;
    dataSource?: string;
    multiple?: boolean;
    dependency?: {
        fieldId: string;
        filterProperty?: string;
    };
    columnSpan?: number;
    columnBreak?: boolean;
    visibility?: Array<{
        fieldId: string;
        operator: string;
        value?: unknown;
        values?: unknown[];
        negate?: boolean;
        logic?: "AND" | "OR";
    }>;
    [extra: string]: unknown; // extensível para propriedades específicas de plataforma
}

export interface FormSchemaContract {
    id: string;
    titulo: string;
    descricao?: string;
    campos: FormFieldContract[];
}

const VALID_FIELD_TYPES = new Set<string>([
    "text", "textarea", "number", "email", "tel", "url", "password",
    "date", "time", "datetime",
    "select", "radio", "checkbox", "chips",
    "file", "camera", "photo", "signature", "location",
    "hidden", "group", "repeatable-group",
    "presence", "checklist", "vistoria_checklist",
    "occupation-selector", "selector-modal", "cards-radio", "caixas-avancado",
    "composite_gallery_collector",
]);

export interface ValidationError {
    path: string;
    message: string;
}

/**
 * Valida se um objeto segue o contrato mínimo de formulário EcoForms.
 * Retorna array de erros (vazio = válido).
 * Tolerante com propriedades extras (forward-compatible).
 */
export function validateFormSchema(data: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== "object") {
        errors.push({ path: "$", message: "Form data must be an object" });
        return errors;
    }

    const form = data as Record<string, unknown>;

    if (typeof form.id !== "string" || !form.id) {
        errors.push({ path: "$.id", message: "Form 'id' is required and must be a non-empty string" });
    }
    if (typeof form.titulo !== "string" || !form.titulo) {
        errors.push({ path: "$.titulo", message: "Form 'titulo' is required and must be a non-empty string" });
    }
    if (!Array.isArray(form.campos)) {
        errors.push({ path: "$.campos", message: "Form 'campos' is required and must be an array" });
        return errors;
    }
    if (form.campos.length === 0) {
        errors.push({ path: "$.campos", message: "Form must have at least one campo" });
        return errors;
    }

    for (let i = 0; i < form.campos.length; i++) {
        const field = form.campos[i] as Record<string, unknown>;
        const prefix = `$.campos[${i}]`;

        if (!field || typeof field !== "object") {
            errors.push({ path: prefix, message: "Campo must be an object" });
            continue;
        }

        if (typeof field.id !== "string" || !field.id) {
            errors.push({ path: `${prefix}.id`, message: "Campo 'id' is required and must be a non-empty string" });
        }
        if (typeof field.label !== "string" || !field.label) {
            errors.push({ path: `${prefix}.label`, message: "Campo 'label' is required and must be a non-empty string" });
        }
        if (typeof field.type !== "string" || !field.type) {
            errors.push({ path: `${prefix}.type`, message: "Campo 'type' is required and must be a non-empty string" });
        }

        if (field.type === "select" || field.type === "radio" || field.type === "chips") {
            if (field.options !== undefined && !Array.isArray(field.options)) {
                errors.push({ path: `${prefix}.options`, message: "Campo 'options' must be an array" });
            }
        }

        if (field.dependency !== undefined) {
            const dep = field.dependency as Record<string, unknown>;
            if (!dep || typeof dep !== "object") {
                errors.push({ path: `${prefix}.dependency`, message: "Dependency must be an object" });
            } else if (typeof dep.fieldId !== "string" || !dep.fieldId) {
                errors.push({ path: `${prefix}.dependency.fieldId`, message: "Dependency 'fieldId' is required" });
            }
        }

        if (field.columnSpan !== undefined) {
            const span = Number(field.columnSpan);
            if (!Number.isInteger(span) || span < 1 || span > 4) {
                errors.push({ path: `${prefix}.columnSpan`, message: "columnSpan must be an integer between 1 and 4" });
            }
        }
    }

    return errors;
}

/**
 * Verifica se um tipo de campo é válido no schema canônico.
 * Campos com tipos não canônicos devem ser normalizados antes da validação.
 */
export function isValidFieldType(type: string): boolean {
    return VALID_FIELD_TYPES.has(type);
}

/**
 * Normaliza aliases de tipos para o tipo canônico.
 * Ex.: 'select-field' → 'select', 'camera' → 'photo'
 */
const TYPE_ALIASES: Record<string, string> = {
    "select-field": "select",
    "text-field": "text",
    "camera": "photo",
    "gallery": "photo",
    "photos": "photo",
    "image": "photo",
    "textarea-field": "textarea",
    "number-input": "number",
    "radio-group": "radio",
    "checkbox-group": "checkbox",
};

export function normalizeFieldType(type: string): string {
    return TYPE_ALIASES[type] || type;
}
