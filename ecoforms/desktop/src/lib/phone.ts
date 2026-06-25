/** Strip everything except digits. */
export function digitsOnly(value: string): string {
    return value.replace(/\D/g, "");
}

/**
 * Apply visual mask `(XX) XXXXX-XXXX` or `(XX) XXXX-XXXX`.
 * Accepts any input — strips non-digits first.
 */
export function maskPhone(value: string): string {
    const d = digitsOnly(value);
    if (d.length <= 10) {
        return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2").slice(0, 14);
    }
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15);
}
