/**
 * Comparação de evidência GPS de campo (Fase 5, parte Desktop — georreferenciamento).
 * Reaproveita as primitivas de geometry.ts (Fase 3): não depende de dado vindo do mobile
 * para ser testável — a interligação mobile→desktop é trabalho futuro (fora deste PR).
 */
import { pointInPolygon, haversineMeters, type LngLat } from "./geometry";

export interface TerrenoParaComparacao {
    geojson?: string | null;
    centroid_lat?: number | null;
    centroid_lng?: number | null;
}

export interface PontoOperacionalParaComparacao {
    latitude: number;
    longitude: number;
}

export interface GpsEvidenceComparison {
    /** `null` quando não há poligonal do imóvel para comparar. */
    dentroPoligono: boolean | null;
    /** Distância até a referência (ponto operacional > centroide), em metros. */
    distanciaReferenciaM: number | null;
    /** Origem da referência usada para calcular a distância. */
    referenciaOrigem: "ponto_operacional" | "centroide" | null;
    /** `true` quando o ponto observado cai fora da poligonal do imóvel. */
    divergente: boolean;
}

/**
 * Compara um ponto GPS observado contra a poligonal e o ponto operacional (ou centroide,
 * como fallback) de um imóvel. Não lança em geojson malformado ou terreno ausente — retorna
 * `dentroPoligono: null` nesses casos, sem marcar divergência (nada para comparar).
 */
export function compareGpsEvidence(
    point: LngLat,
    terreno: TerrenoParaComparacao | null,
    pontoOperacional?: PontoOperacionalParaComparacao | null,
): GpsEvidenceComparison {
    let dentroPoligono: boolean | null = null;
    if (terreno?.geojson) {
        try {
            dentroPoligono = pointInPolygon(point, JSON.parse(terreno.geojson));
        } catch {
            dentroPoligono = null;
        }
    }

    let distanciaReferenciaM: number | null = null;
    let referenciaOrigem: GpsEvidenceComparison["referenciaOrigem"] = null;
    if (pontoOperacional) {
        distanciaReferenciaM = Math.round(haversineMeters(point, [pontoOperacional.longitude, pontoOperacional.latitude]));
        referenciaOrigem = "ponto_operacional";
    } else if (terreno?.centroid_lat != null && terreno?.centroid_lng != null) {
        distanciaReferenciaM = Math.round(haversineMeters(point, [terreno.centroid_lng, terreno.centroid_lat]));
        referenciaOrigem = "centroide";
    }

    return {
        dentroPoligono,
        distanciaReferenciaM,
        referenciaOrigem,
        divergente: dentroPoligono === false,
    };
}
