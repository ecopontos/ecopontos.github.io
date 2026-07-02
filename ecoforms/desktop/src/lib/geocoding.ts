/**
 * Geocoding via Nominatim (OpenStreetMap) — gratuito, sem API key.
 * Respeita rate-limit de 1 req/s conforme política do Nominatim.
 */

/** Origem da coordenada gravada em `clientes.geocode_provider`. */
export type GeoProvider =
    | "nominatim"
    | "gps"
    | "manual"
    | "importacao"
    | "terreno_centroid"
    | "ponto_operacional";

/** Nível de precisão gravado em `clientes.geocode_precision`. */
export type GeoPrecision =
    | "address_exact"
    | "street_interpolated"
    | "street"
    | "neighborhood"
    | "postcode"
    | "city"
    | "manual"
    | "gps"
    | "polygon_centroid"
    | "operational_point";

export interface GeoResult {
    latitude: number;
    longitude: number;
    display_name?: string;
    /** Provedor que gerou a coordenada (sempre "nominatim" quando vem deste módulo). */
    provider?: GeoProvider;
    /** Query textual enviada ao Nominatim — presente quando a chamada partiu de `geocodeFromCep`. */
    source_query?: string;
    /** Precisão heurística inferida a partir do `class`/`type` retornados pelo Nominatim. */
    precision?: GeoPrecision;
}

/** Subconjunto do JSON de resposta do Nominatim usado para inferir precisão. */
interface NominatimHit {
    class?: string;
    type?: string;
}

/**
 * Infere um nível de precisão a partir dos campos `class`/`type` que o Nominatim
 * já retorna por padrão (sem parâmetros extras como `addressdetails=1`).
 * Heurística conservadora: quando a combinação não é reconhecida, cai no nível
 * genérico "street" em vez de arriscar um nível mais específico do que o dado sustenta.
 */
export function inferGeocodePrecision(hit: NominatimHit): GeoPrecision {
    const cls = hit.class;
    const type = hit.type;

    if (cls === "building" || type === "house" || type === "address") return "address_exact";
    if (type === "postcode") return "postcode";
    if (cls === "place" && ["suburb", "neighbourhood", "quarter", "residential", "city_block"].includes(type ?? "")) {
        return "neighborhood";
    }
    if (
        (cls === "place" && ["city", "town", "village", "municipality", "county", "state"].includes(type ?? "")) ||
        (cls === "boundary" && type === "administrative")
    ) {
        return "city";
    }
    if (cls === "highway") return "street";
    return "street";
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
        provider: "nominatim",
        precision: inferGeocodePrecision(hit),
    };
}

/**
 * Busca coordenadas a partir de CEP + número + cidade + estado.
 * Monta o endereço para o Nominatim e devolve a `source_query` usada,
 * para que o chamador possa persistir de onde veio o resultado.
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
    const sourceQuery = parts.join(", ");
    const result = await geocodeAddress(sourceQuery);
    if (!result) return null;
    return { ...result, source_query: sourceQuery };
}
