import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    geocodeAddress,
    geocodeCandidates,
    geocodeCandidatesFromCep,
    geocodeFromCep,
    inferGeocodeConfidence,
    inferGeocodePrecision,
    normalizeEstado,
    validateCandidate,
    type GeoResult,
} from "../geocoding";
import { geocodeCache } from "../geocodeCache";
import { nominatimLimiter } from "../rateLimit";

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

describe("inferGeocodeConfidence", () => {
    it("address_exact + número na query = alta", () => {
        expect(inferGeocodeConfidence({ class: "building", type: "yes" }, true)).toBe("alta");
    });
    it("street + número na query = alta", () => {
        expect(inferGeocodeConfidence({ class: "highway", type: "residential" }, true)).toBe("alta");
    });
    it("street sem número = media", () => {
        expect(inferGeocodeConfidence({ class: "highway", type: "residential" }, false)).toBe("media");
    });
    it("postcode = media", () => {
        expect(inferGeocodeConfidence({ class: "place", type: "postcode" }, false)).toBe("media");
    });
    it("city = baixa", () => {
        expect(inferGeocodeConfidence({ class: "place", type: "city" }, false)).toBe("baixa");
    });
});

describe("normalizeEstado", () => {
    it("mantém sigla válida", () => {
        expect(normalizeEstado("SP")).toBe("SP");
    });
    it("converte nome para sigla", () => {
        expect(normalizeEstado("São Paulo")).toBe("SP");
        expect(normalizeEstado("rio de janeiro")).toBe("RJ");
    });
    it("uppercase de entrada desconhecida", () => {
        expect(normalizeEstado("xyz")).toBe("XYZ");
    });
    it("null permanence", () => {
        expect(normalizeEstado(null)).toBeNull();
    });
});

describe("validateCandidate", () => {
    it("marca UF divergente", () => {
        const c: GeoResult = { latitude: 0, longitude: 0, estado: "RJ" };
        const v = validateCandidate(c, { estado: "SP" });
        expect(v.ufOk).toBe(false);
        expect(v.warnings.join()).toContain("UF divergente");
    });
    it("marca cidade divergente", () => {
        const c: GeoResult = { latitude: 0, longitude: 0, cidade: "Rio de Janeiro" };
        const v = validateCandidate(c, { cidade: "São Paulo" });
        expect(v.cidadeOk).toBe(false);
    });
    it("null quando não há referência para comparar", () => {
        const c: GeoResult = { latitude: 0, longitude: 0 };
        const v = validateCandidate(c, {});
        expect(v.cidadeOk).toBeNull();
        expect(v.ufOk).toBeNull();
        expect(v.warnings).toHaveLength(0);
    });
});

describe("geocodeAddress", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    beforeEach(() => {
        geocodeCache.clear();
        nominatimLimiter.reset();
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

        expect(result).not.toBeNull();
        expect(result!.latitude).toBe(-23.55052);
        expect(result!.longitude).toBe(-46.633308);
        expect(result!.provider).toBe("nominatim");
        expect(result!.precision).toBe("address_exact");
        expect(result!.confidence).toBe("alta"); // número na query
    });

    it("retorna null quando Nominatim não encontra resultado", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
        vi.stubGlobal("fetch", fetchMock);

        const result = await geocodeAddress("Endereço inexistente");
        expect(result).toBeNull();
    });
});

describe("geocodeCandidates (Fase 2)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    beforeEach(() => {
        geocodeCache.clear();
        nominatimLimiter.reset();
    });

    it("retorna até 5 candidatos", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => Array.from({ length: 5 }).map((_, i) => ({
                lat: `${-23.55 + i * 0.001}`,
                lon: `${-46.63 + i * 0.001}`,
                display_name: `Candidato ${i}`,
                class: "highway",
                type: "residential",
            })),
        });
        vi.stubGlobal("fetch", fetchMock);

        const cands = await geocodeCandidates("Rua Augusta, São Paulo, SP");
        expect(cands).toHaveLength(5);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("devolve array vazio quando Nominatim responde vazio", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
        const cands = await geocodeCandidates("inexistente");
        expect(cands).toEqual([]);
    });

    it("cache hit não dispara nova chamada de rede", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [{ lat: "-23.55", lon: "-46.63", display_name: "X", class: "highway", type: "residential" }],
        });
        vi.stubGlobal("fetch", fetchMock);

        await geocodeCandidates("Rua Augusta, 1200, São Paulo, SP");
        await geocodeCandidates("Rua Augusta, 1200, São Paulo, SP"); // mesma query = cache hit
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("queries com diferença de acento/maiusculização são a mesma chave de cache", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [{ lat: "-23.55", lon: "-46.63", display_name: "X", class: "highway", type: "residential" }],
        });
        vi.stubGlobal("fetch", fetchMock);

        await geocodeCandidates("Rua Augusta, São Paulo, SP");
        await geocodeCandidates("RUA AUGUSTA, sao paulo, sp");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("inclui cidade/estado extraídos do addressdetails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [{
                lat: "-23.55",
                lon: "-46.63",
                display_name: "X",
                class: "highway",
                type: "residential",
                address: { city: "São Paulo", state: "São Paulo" },
            }],
        }));
        const [c] = await geocodeCandidates("Rua Augusta, São Paulo, SP");
        expect(c.cidade).toBe("São Paulo");
        expect(c.estado).toBe("SP");
    });
});

describe("geocodeCandidatesFromCep / geocodeFromCep", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    beforeEach(() => {
        geocodeCache.clear();
        nominatimLimiter.reset();
    });

    it("geocodeCandidatesFromCep carimba source_query em todos os candidatos", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { lat: "-23.55", lon: "-46.63", display_name: "A", class: "highway", type: "residential" },
                { lat: "-23.56", lon: "-46.64", display_name: "B", class: "highway", type: "residential" },
            ],
        }));
        const { candidates, source_query } = await geocodeCandidatesFromCep("01305-000", "Rua Augusta", "1200", "Consolação", "São Paulo", "SP");
        expect(source_query).toBe("Rua Augusta, 1200, Consolação, São Paulo, SP, Brasil");
        expect(candidates).toHaveLength(2);
        expect(candidates.every((c) => c.source_query === source_query)).toBe(true);
    });

    it("geocodeFromCep (compat) retorna o primeiro candidato com source_query", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { lat: "-23.55", lon: "-46.63", display_name: "Rua Augusta, São Paulo, SP, Brasil", class: "highway", type: "residential" },
            ],
        }));
        const result = await geocodeFromCep("01305-000", "Rua Augusta", "1200", "Consolação", "São Paulo", "SP");
        expect(result?.source_query).toBe("Rua Augusta, 1200, Consolação, São Paulo, SP, Brasil");
        expect(result?.provider).toBe("nominatim");
        expect(result?.precision).toBe("street");
    });

    it("omite partes vazias/nulas da source_query", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [{ lat: "-23.5", lon: "-46.6", display_name: "São Paulo, SP, Brasil", class: "place", type: "city" }],
        }));
        const result = await geocodeFromCep("", "", null, null, "São Paulo", "SP");
        expect(result?.source_query).toBe("São Paulo, SP, Brasil");
    });
});

describe("rateLimit (RateLimiter)", () => {
    beforeEach(() => {
        nominatimLimiter.reset();
    });

    it("espaça execuções consecutivas pelo intervalo mínimo", async () => {
        vi.useFakeTimers();
        const startTimes: number[] = [];
        const task = async () => {
            startTimes.push(Date.now());
            return 1;
        };
        const p1 = nominatimLimiter.run(task);
        const p2 = nominatimLimiter.run(task);
        await vi.advanceTimersByTimeAsync(0);
        // primeira roda imediatamente
        expect(startTimes).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1000);
        await Promise.all([p1, p2]);
        expect(startTimes).toHaveLength(2);
        expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(1000);
        vi.useRealTimers();
    });
});
