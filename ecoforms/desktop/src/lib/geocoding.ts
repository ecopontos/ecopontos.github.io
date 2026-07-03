/**
 * Geocoding via Nominatim (OpenStreetMap) — gratuito, sem API key.
 *
 * Fase 2 — georreferenciamento de clientes:
 *  - Retorna até 5 candidatos em vez de aceitar silenciosamente o primeiro.
 *  - Cache local por hash da query normalizada (ver geocodeCache.ts).
 *  - Rate-limit client-side respeitando a política de 1 req/s do Nominatim
 *    (ver rateLimit.ts / geocodeCandidates.ts).
 *  - Inferência de confidence (alta/média/baixa) e validação cidade/UF.
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

/** Confiança gravada em `clientes.geocode_confidence` (Fase 2). */
export type GeoConfidence = "alta" | "media" | "baixa";

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
    /** Confiança da correspondência (Fase 2) — alta/média/baixa. */
    confidence?: GeoConfidence;
    /** Cidade retornada pelo Nominatim (quando `addressdetails=1`) — para validação municipal. */
    cidade?: string | null;
    /** UF retornada pelo Nominatim (quando `addressdetails=1`) — para validação estadual. */
    estado?: string | null;
}

/** Subconjunto do JSON de resposta do Nominatim usado para inferir precisão/confidence. */
interface NominatimHit {
    class?: string;
    type?: string;
    /** Presente quando `addressdetails=1`. */
    address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        postcode?: string;
    };
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
 * Infere confidence (alta/média/baixa) combinando precisão + completude do endereço
 * consultado. Alta exige endereço com número e precisão address_exact/street;
 * bairro/cidade/CEP sem número caem em média/baixa.
 *
 * @param hit       Resposta do Nominatim (class/type).
 * @param hasNumber Se a query original continha número (quando aplicável).
 */
export function inferGeocodeConfidence(hit: NominatimHit, hasNumber?: boolean): GeoConfidence {
    const precision = inferGeocodePrecision(hit);
    if (precision === "address_exact" || precision === "street") return hasNumber ? "alta" : "media";
    if (precision === "street_interpolated") return "media";
    if (precision === "postcode" || precision === "neighborhood") return "media";
    // city / manual / gps / polygon_centroid / operational_point
    return "baixa";
}

/** Normaliza a query do endereço para baixar/acento-case-spaces antes de hashear p/ cache. */
export function normalizeQuery(q: string): string {
    return q
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ") // mantém só alfanuméricos e espaços
        .replace(/\s+/g, " ")
        .trim();
}

function extractCidadeUf(hit: NominatimHit): { cidade: string | null; estado: string | null } {
    const a = hit.address ?? {};
    const cidade = a.city ?? a.town ?? a.village ?? a.municipality ?? null;
    // `state` costuma vir como "São Paulo" — normalizamos para sigla quando possível.
    const estadoRaw = a.state ?? null;
    const estado = estadoRaw ? normalizeEstado(estadoRaw) : null;
    return { cidade, estado };
}

/** Converte "São Paulo" -> "SP" usando tabela de UF; devolve o input uppercase se não bater. */
export function normalizeEstado(estado: string | null | undefined): string | null {
    if (!estado) return null;
    const sigla = estado.trim().toUpperCase();
    if (SIGLAS_UF.has(sigla)) return sigla;
    // Normaliza (remove acentos, lowercase) para bater na tabela sem-acentos.
    const norm = estado
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    const map: Record<string, string> = ESTADO_PARA_SIGLA;
    return map[norm] ?? sigla;
}

const SIGLAS_UF = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const ESTADO_PARA_SIGLA: Record<string, string> = {
    "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM",
    "bahia": "BA", "ceara": "CE", "distrito federal": "DF",
    "espirito santo": "ES", "goias": "GO", "maranhao": "MA",
    "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG",
    "para": "PA", "paraiba": "PB", "parana": "PR", "pernambuco": "PE",
    "piaui": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN",
    "rio grande do sul": "RS", "rondonia": "RO", "roraima": "RR",
    "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE", "tocantins": "TO",
};

export interface GeocodeValidationContext {
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
}

export interface GeocodeValidation {
    cidadeOk: boolean | null; // null quando não há referência p/ comparar
    ufOk: boolean | null;
    warnings: string[];
}

/**
 * Compara o resultado do provedor contra a cidade/UF informadas no cadastro.
 * `cidadeOk/ufOk` são `null` quando não há referência para comparar (sem ложespositivo).
 */
export function validateCandidate(candidate: GeoResult, ctx: GeocodeValidationContext): GeocodeValidation {
    const warnings: string[] = [];
    let cidadeOk: boolean | null = null;
    let ufOk: boolean | null = null;

    if (ctx.estado && candidate.estado) {
        const esperado = normalizeEstado(ctx.estado);
        ufOk = esperado === candidate.estado;
        if (!ufOk) warnings.push(`UF divergente: cadastro=${esperado}, provedor=${candidate.estado}`);
    }
    if (ctx.cidade && candidate.cidade) {
        cidadeOk = normalizeQuery(ctx.cidade) === normalizeQuery(candidate.cidade);
        if (!cidadeOk) warnings.push(`Cidade divergente: cadastro=${ctx.cidade}, provedor=${candidate.cidade}`);
    }
    return { cidadeOk, ufOk, warnings };
}

/**
 * Busca até `limit` candidatos a partir de um endereço completo.
 * Passa pelo cache + rate-limit (geocodeCandidates.ts). Em caso de erro de rede
 * ou resposta inválida, devolve array vazio (chamador decide o que mostrar).
 *
 * Ex: geocodeCandidates("Rua Augusta, 1200, São Paulo, SP")
 */
export async function geocodeCandidates(endereco: string, limit = 5): Promise<GeoResult[]> {
    // Import tardio para evitar ciclo: o orquestrador importa de volta geocodeAddress
    // via cache miss path. Mantém geocoding.ts puro (sem dependência de cache no tipo).
    const { geocodeWithCache } = await import("./geocodeCandidates");
    const hits = await geocodeWithCache(endereco, limit);
    if (!hits.length) return [];
    return hits.map((hit) => mapHit(hit, endereco));
}

/** Mapeia um hit bruto do Nominatim para GeoResult com proveniência + confidence. */
function mapHit(hit: NominatimHit & { lat: string; lon: string; display_name?: string }, sourceQuery: string): GeoResult {
    const { cidade, estado } = extractCidadeUf(hit);
    // Detecta número na query (heurística barata p/ subir confidence).
    const hasNumber = /\b\d+\b/.test(sourceQuery);
    return {
        latitude: parseFloat(hit.lat),
        longitude: parseFloat(hit.lon),
        display_name: hit.display_name,
        provider: "nominatim",
        precision: inferGeocodePrecision(hit),
        confidence: inferGeocodeConfidence(hit, hasNumber),
        cidade,
        estado,
    };
}

/**
 * Busca coordenadas a partir de um endereço completo (compat retroativa).
 * Devolve o primeiro candidato ou `null`. Prefira `geocodeCandidates` em novos usos.
 *
 * Ex: geocodeAddress("Rua Augusta, 1200, São Paulo, SP")
 */
export async function geocodeAddress(endereco: string): Promise<GeoResult | null> {
    const candidates = await geocodeCandidates(endereco, 1);
    return candidates[0] ?? null;
}

/**
 * Busca candidatos a partir de CEP + número + cidade + estado.
 * Monta o endereço para o Nominatim e devolve `{ candidates, source_query }`,
 * para que o chamador possa abrir o seletor de candidatos com a query registrada.
 */
export async function geocodeCandidatesFromCep(
    cep: string,
    endereco: string,
    numero: string | null,
    bairro: string | null,
    cidade: string | null,
    estado: string | null,
): Promise<{ candidates: GeoResult[]; source_query: string }> {
    const parts = [endereco, numero, bairro, cidade, estado, "Brasil"].filter(Boolean);
    const sourceQuery = parts.join(", ");
    const candidates = await geocodeCandidates(sourceQuery, 5);
    // Carimba a source_query em cada candidato (geocodeCandidates não a conhece).
    return { candidates: candidates.map((c) => ({ ...c, source_query: sourceQuery })), source_query: sourceQuery };
}

/**
 * Compat retroativa: devolve o primeiro candidato como GeoResult | null.
 * Mantido para não quebrar imports antigos; novos fluxos devem usar `geocodeCandidatesFromCep`.
 */
export async function geocodeFromCep(
    cep: string,
    endereco: string,
    numero: string | null,
    bairro: string | null,
    cidade: string | null,
    estado: string | null,
): Promise<GeoResult | null> {
    const { candidates } = await geocodeCandidatesFromCep(cep, endereco, numero, bairro, cidade, estado);
    return candidates[0] ?? null;
}
