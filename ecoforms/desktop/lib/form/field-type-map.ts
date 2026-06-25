/**
 * Field type normalization — maps raw field type strings (from builder/mobile/web)
 * to the canonical runtime type used by FormFieldRenderer.
 */
export function normalizeFieldType(rawType: unknown): string {
    const type = String(rawType || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_");

    switch (type) {
        case "checklist":
            return "vistoria_checklist";
        case "geolocation":
            return "gps";
        case "camera":
            return "photo";
        case "select_field":
            return "select";
        default:
            return type;
    }
}
