import { describe, expect, it } from "vitest";
import { deriveCoordOrigem, deriveMotivoSemLocalizacao } from "@/lib/itinerary";

describe("deriveCoordOrigem", () => {
    it("retorna null quando a parada não tem latitude/longitude resolvida", () => {
        expect(
            deriveCoordOrigem({
                latitude: null,
                longitude: null,
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
                terreno_centroid_lat: null,
                terreno_centroid_lng: null,
            }),
        ).toBe("cliente_latlng");
    });

    it("retorna terreno_centroid quando o centroide veio do terreno cadastrado no cliente", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                terreno_centroid_lat: -23.55,
                terreno_centroid_lng: -46.63,
            }),
        ).toBe("terreno_centroid");
    });

    it("retorna ponto_operacional quando há ponto operacional, mesmo com centroide também presente (precedência)", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                ponto_operacional_lat: -23.55,
                ponto_operacional_lng: -46.63,
                terreno_centroid_lat: -23.54,
                terreno_centroid_lng: -46.62,
            }),
        ).toBe("ponto_operacional");
    });

    it("retorna parada_ponto_operacional quando há override explícito de ponto na parada (precedência máxima)", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                parada_ponto_operacional_lat: -23.55,
                parada_ponto_operacional_lng: -46.63,
                ponto_operacional_lat: -23.54,
                ponto_operacional_lng: -46.62,
                terreno_centroid_lat: -23.53,
                terreno_centroid_lng: -46.61,
            }),
        ).toBe("parada_ponto_operacional");
    });

    it("retorna parada_ponto_operacional quando o imovel_id da parada resolve para o ponto operacional principal desse imóvel", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                parada_imovel_ponto_operacional_lat: -23.55,
                parada_imovel_ponto_operacional_lng: -46.63,
                ponto_operacional_lat: -23.54,
                ponto_operacional_lng: -46.62,
                terreno_centroid_lat: -23.53,
                terreno_centroid_lng: -46.61,
            }),
        ).toBe("parada_ponto_operacional");
    });

    it("retorna parada_imovel_centroid quando o imovel_id da parada não tem ponto principal, cai no centroide desse imóvel", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                parada_imovel_centroid_lat: -23.55,
                parada_imovel_centroid_lng: -46.63,
                ponto_operacional_lat: -23.54,
                ponto_operacional_lng: -46.62,
                terreno_centroid_lat: -23.53,
                terreno_centroid_lng: -46.61,
            }),
        ).toBe("parada_imovel_centroid");
    });

    it("cai para ponto_operacional (vínculo automático) quando não há override de parada", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                ponto_operacional_lat: -23.55,
                ponto_operacional_lng: -46.63,
                terreno_centroid_lat: -23.54,
                terreno_centroid_lng: -46.62,
            }),
        ).toBe("ponto_operacional");
    });

    it("retorna parada_ponto_operacional (não parada_imovel_centroid) quando o imóvel da parada tem tanto ponto principal quanto centroide (precedência)", () => {
        expect(
            deriveCoordOrigem({
                latitude: -23.55,
                longitude: -46.63,
                parada_imovel_ponto_operacional_lat: -23.55,
                parada_imovel_ponto_operacional_lng: -46.63,
                parada_imovel_centroid_lat: -23.54,
                parada_imovel_centroid_lng: -46.62,
                ponto_operacional_lat: -23.53,
                ponto_operacional_lng: -46.61,
                terreno_centroid_lat: -23.52,
                terreno_centroid_lng: -46.60,
            }),
        ).toBe("parada_ponto_operacional");
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
