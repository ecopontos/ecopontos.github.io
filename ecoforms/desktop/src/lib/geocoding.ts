/**
 * Geocoding via Nominatim (OpenStreetMap) — gratuito, sem API key.
 * Respeita rate-limit de 1 req/s conforme política do Nominatim.
 */

export interface GeoResult {
    latitude: number;
    longitude: number;
    display_name?: string;
}

/**
 * Busca coordenadas a partir de um endereço completo.
 * Ex: geocodeAddress("Rua Augusta, 1200, São Paulo, SP")
 */
export async function geocodeAddress(endereco: string): Promise<GeoResult | null> {
    const q = encodeURIComponent(endereco);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=br`;
    const res = await fetch(url, {
        headers: { "Accept-Language": "pt-BR" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0];
    return {
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        display_name: hit.display_name,
    };
}

/**
 * Busca coordenadas a partir de CEP + número + cidade + estado.
 * Monta o endereço para o Nominatim.
 */
export async function geocodeFromCep(
    cep: string,
    endereco: string,
    numero: string | null,
    bairro: string | null,
    cidade: string | null,
    estado: string | null,
): Promise<GeoResult | null> {
    const parts = [
        endereco,
        numero,
        bairro,
        cidade,
        estado,
        "Brasil",
    ].filter(Boolean);
    return geocodeAddress(parts.join(", "));
}
