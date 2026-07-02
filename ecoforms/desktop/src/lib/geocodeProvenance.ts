/**
 * Formata a proveniência de uma coordenada de cliente (Fase 1 — georreferenciamento)
 * em um texto legível para exibição na tela de detalhe.
 */

interface GeocodeProvenanceInput {
    latitude?: number | null;
    longitude?: number | null;
    geocode_provider?: string | null;
    geocode_precision?: string | null;
    geocode_at?: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
    nominatim: "Geocodificado via Nominatim",
    gps: "Coordenada via GPS",
    manual: "Coordenada manual",
    importacao: "Coordenada importada",
    terreno_centroid: "Centroide do terreno",
    ponto_operacional: "Ponto operacional",
};

const PRECISION_LABELS: Record<string, string> = {
    address_exact: "endereço exato",
    street_interpolated: "rua interpolada",
    street: "rua",
    neighborhood: "bairro",
    postcode: "CEP",
    city: "cidade",
    polygon_centroid: "centroide do polígono",
    operational_point: "ponto operacional",
    // "manual" e "gps" já ficam implícitos no rótulo do provider — sem sufixo extra.
};

function formatDate(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("pt-BR");
}

/**
 * Retorna um texto legível descrevendo a origem da coordenada (provider + precision + data),
 * ou `null` quando o cliente não tem latitude/longitude.
 */
export function formatGeocodeProvenance(cliente: GeocodeProvenanceInput): string | null {
    if (cliente.latitude == null || cliente.longitude == null) return null;

    const provider = cliente.geocode_provider ?? null;
    if (!provider) return "Origem da coordenada não registrada";

    const providerLabel = PROVIDER_LABELS[provider] ?? "Coordenada com origem desconhecida";
    const precisionLabel = cliente.geocode_precision ? PRECISION_LABELS[cliente.geocode_precision] : undefined;
    const dateLabel = formatDate(cliente.geocode_at);

    let text = providerLabel;
    if (precisionLabel) text += ` (${precisionLabel})`;
    if (dateLabel) text += ` em ${dateLabel}`;
    return text;
}
