import { describe, expect, it } from "vitest";
import { deriveCoordOrigem, deriveMotivoSemLocalizacao } from "@/lib/itinerary";

describe("deriveCoordOrigem", () => {
    it("retorna null quando a parada não tem latitude/longitude resolvida", () => {
        expect(
            deriveCoordOrigem({
                latitude: null,
                longitude: null,
                roteiro_terreno_id: null,
                terreno_centroid_lat: null,
                terreno_centroid_lng: null,
            }),
        ).toBeNull();
    });

    it("retorna cliente_latlng quando não há centroide de terreno disponível (veio de clientes.latitude/longitude)", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                roteiro_terreno_id: null,
                terreno_centroid_lat: null,
                terreno_centroid_lng: null,
            }),
        ).toBe("cliente_latlng");
    });

    it("retorna terreno_centroid quando o centroide veio do terreno cadastrado no cliente (sem override do roteiro)", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                roteiro_terreno_id: null,
                terreno_centroid_lat: -23.55,
                terreno_centroid_lng: -46.63,
            }),
        ).toBe("terreno_centroid");
    });

    it("retorna roteiro_terreno_override quando roteiro_clientes.terreno_id sobrescreveu o terreno do cliente", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                roteiro_terreno_id: "terreno-override-1",
                terreno_centroid_lat: -23.55,
                terreno_centroid_lng: -46.63,
            }),
        ).toBe("roteiro_terreno_override");
    });
});

describe("deriveMotivoSemLocalizacao", () => {
    it("retorna null quando a parada já tem localização resolvida", () => {
        expect(
            deriveMotivoSemLocalizacao({
                latitude: -23.55,
                longitude: -46.63,
                terreno_id: null,
                terreno_centroid_lat: null,
            }),
        ).toBeNull();
    });

    it("retorna cliente_sem_terreno_vinculado quando não há terreno_id nem lat/lng resolvidos", () => {
        expect(
            deriveMotivoSemLocalizacao({
                latitude: null,
                longitude: null,
                terreno_id: null,
                terreno_centroid_lat: null,
            }),
        ).toBe("cliente_sem_terreno_vinculado");
    });

    it("retorna terreno_sem_centroide quando há terreno vinculado mas ele não tem centroide calculado", () => {
        expect(
            deriveMotivoSemLocalizacao({
                latitude: null,
                longitude: null,
                terreno_id: "terreno-1",
                terreno_centroid_lat: null,
            }),
        ).toBe("terreno_sem_centroide");
    });

    it("retorna cliente_sem_lat_lng como fallback defensivo (estado inconsistente: terreno com centroide mas ainda sem posição)", () => {
        expect(
            deriveMotivoSemLocalizacao({
                latitude: null,
                longitude: null,
                terreno_id: "terreno-1",
                terreno_centroid_lat: -23.55,
            }),
        ).toBe("cliente_sem_lat_lng");
    });
});
