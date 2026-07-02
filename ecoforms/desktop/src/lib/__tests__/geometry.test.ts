import { describe, expect, it } from "vitest";
import { haversineMeters, pointInPolygon } from "../geometry";

// Quadrado ~1km de lado centrado em SP, em [lng, lat].
const SQUARE: number[][][] = [[
    [-46.64, -23.56],
    [-46.63, -23.56],
    [-46.63, -23.55],
    [-46.64, -23.55],
    [-46.64, -23.56], // fecha o anel
]];

describe("pointInPolygon", () => {
    it("detecta ponto dentro do polígono", () => {
        expect(pointInPolygon([-46.635, -23.555], { type: "Polygon", coordinates: SQUARE })).toBe(true);
    });
    it("detecta ponto fora do polígono", () => {
        expect(pointInPolygon([-46.70, -23.60], { type: "Polygon", coordinates: SQUARE })).toBe(false);
    });
    it("respeita buracos (anéis internos)", () => {
        const hole: number[][][] = [
            SQUARE[0],
            [
                [-46.636, -23.556],
                [-46.634, -23.556],
                [-46.634, -23.554],
                [-46.636, -23.554],
                [-46.636, -23.556],
            ],
        ];
        // ponto dentro do buraco = fora da área válida
        expect(pointInPolygon([-46.635, -23.555], { type: "Polygon", coordinates: hole })).toBe(false);
    });
    it("suporta MultiPolygon", () => {
        const poly2: number[][][] = [[
            [-46.00, -23.00], [-45.99, -23.00], [-45.99, -22.99], [-46.00, -22.99], [-46.00, -23.00],
        ]];
        const mp = { type: "MultiPolygon", coordinates: [SQUARE, poly2] };
        expect(pointInPolygon([-46.635, -23.555], mp)).toBe(true);
        expect(pointInPolygon([-45.995, -22.995], mp)).toBe(true);
        expect(pointInPolygon([-47.00, -24.00], mp)).toBe(false);
    });
    it("retorna false para geometria inválida", () => {
        expect(pointInPolygon([0, 0], null)).toBe(false);
        expect(pointInPolygon([0, 0], { type: "Point" })).toBe(false);
    });
});

describe("haversineMeters", () => {
    it("mesmo ponto = zero", () => {
        expect(haversineMeters([-46.63, -23.55], [-46.63, -23.55])).toBe(0);
    });
    it("distância ~conhecida (aprox 1 grau de lat ≈ 111km)", () => {
        const d = haversineMeters([0, 0], [0, 1]); // 1 grau de latitude
        expect(d).toBeGreaterThan(110_000);
        expect(d).toBeLessThan(112_000);
    });
    it("SP-Rio aprox 360km", () => {
        const d = haversineMeters([-46.633308, -23.55052], [-43.207, -22.911]);
        expect(d).toBeGreaterThan(350_000);
        expect(d).toBeLessThan(380_000);
    });
});
