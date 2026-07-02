import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress, geocodeFromCep, inferGeocodePrecision } from "../geocoding";

describe("inferGeocodePrecision", () => {
    it("classifica prédio/casa como endereço exato", () => {
        expect(inferGeocodePrecision({ class: "building", type: "yes" })).toBe("address_exact");
        expect(inferGeocodePrecision({ class: "place", type: "house" })).toBe("address_exact");
    });

    it("classifica via/logradouro como rua", () => {
        expect(inferGeocodePrecision({ class: "highway", type: "residential" })).toBe("street");
    });

    it("classifica bairro/subdivisão como neighborhood", () => {
        expect(inferGeocodePrecision({ class: "place", type: "suburb" })).toBe("neighborhood");
        expect(inferGeocodePrecision({ class: "place", type: "neighbourhood" })).toBe("neighborhood");
    });

    it("classifica CEP como postcode", () => {
        expect(inferGeocodePrecision({ class: "place", type: "postcode" })).toBe("postcode");
    });

    it("classifica cidade/município como city", () => {
        expect(inferGeocodePrecision({ class: "place", type: "city" })).toBe("city");
        expect(inferGeocodePrecision({ class: "boundary", type: "administrative" })).toBe("city");
    });

    it("usa fallback genérico quando class/type não são reconhecidos", () => {
        expect(inferGeocodePrecision({ class: "shop", type: "supermarket" })).toBe("street");
    });

    it("lida com hit sem class/type", () => {
        expect(inferGeocodePrecision({})).toBe("street");
    });
});

describe("geocodeAddress", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("retorna provider nominatim e precision inferida a partir do class/type do hit", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                {
                    lat: "-23.55052",
                    lon: "-46.633308",
                    display_name: "Rua Augusta, 1200, São Paulo, SP, Brasil",
                    class: "building",
                    type: "yes",
                },
            ],
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await geocodeAddress("Rua Augusta, 1200, São Paulo, SP");

        expect(result).toEqual({
            latitude: -23.55052,
            longitude: -46.633308,
            display_name: "Rua Augusta, 1200, São Paulo, SP, Brasil",
            provider: "nominatim",
            precision: "address_exact",
        });
    });

    it("retorna null quando Nominatim não encontra resultado", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
        vi.stubGlobal("fetch", fetchMock);

        const result = await geocodeAddress("Endereço inexistente");
        expect(result).toBeNull();
    });
});

describe("geocodeFromCep", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("retorna source_query com a string montada antes de enviar ao Nominatim", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                {
                    lat: "-23.55052",
                    lon: "-46.633308",
                    display_name: "Rua Augusta, São Paulo, SP, Brasil",
                    class: "highway",
                    type: "residential",
                },
            ],
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await geocodeFromCep("01305-000", "Rua Augusta", "1200", "Consolação", "São Paulo", "SP");

        expect(result?.source_query).toBe("Rua Augusta, 1200, Consolação, São Paulo, SP, Brasil");
        expect(result?.provider).toBe("nominatim");
        expect(result?.precision).toBe("street");
    });

    it("omite partes vazias/nulas da source_query", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { lat: "-23.5", lon: "-46.6", display_name: "São Paulo, SP, Brasil", class: "place", type: "city" },
            ],
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await geocodeFromCep("", "", null, null, "São Paulo", "SP");
        expect(result?.source_query).toBe("São Paulo, SP, Brasil");
    });
});
