import { describe, expect, it } from "vitest";
import { formatGeocodeProvenance } from "../geocodeProvenance";

describe("formatGeocodeProvenance", () => {
    it("retorna null quando não há coordenada", () => {
        expect(formatGeocodeProvenance({ latitude: null, longitude: null })).toBeNull();
    });

    it("descreve coordenada geocodificada via Nominatim com data e precisão", () => {
        const text = formatGeocodeProvenance({
            latitude: -23.55052,
            longitude: -46.633308,
            geocode_provider: "nominatim",
            geocode_precision: "street",
            geocode_at: "2026-07-02T14:30:00.000Z",
        });
        expect(text).toBe("Geocodificado via Nominatim (rua) em 02/07/2026");
    });

    it("descreve coordenada digitada manualmente", () => {
        const text = formatGeocodeProvenance({
            latitude: -23.55052,
            longitude: -46.633308,
            geocode_provider: "manual",
            geocode_precision: "manual",
            geocode_at: "2026-07-02T14:30:00.000Z",
        });
        expect(text).toBe("Coordenada manual em 02/07/2026");
    });

    it("descreve coordenada manual sem data registrada", () => {
        const text = formatGeocodeProvenance({
            latitude: -23.55052,
            longitude: -46.633308,
            geocode_provider: "manual",
            geocode_precision: "manual",
            geocode_at: null,
        });
        expect(text).toBe("Coordenada manual");
    });

    it("indica origem desconhecida para coordenadas legadas sem metadados de proveniência", () => {
        const text = formatGeocodeProvenance({
            latitude: -23.55052,
            longitude: -46.633308,
            geocode_provider: null,
            geocode_precision: null,
            geocode_at: null,
        });
        expect(text).toBe("Origem da coordenada não registrada");
    });

    it("descreve coordenada de GPS de campo", () => {
        const text = formatGeocodeProvenance({
            latitude: -23.55052,
            longitude: -46.633308,
            geocode_provider: "gps",
            geocode_precision: "gps",
            geocode_at: "2026-07-02T14:30:00.000Z",
        });
        expect(text).toBe("Coordenada via GPS em 02/07/2026");
    });
});
