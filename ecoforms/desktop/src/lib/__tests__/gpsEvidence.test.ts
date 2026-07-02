import { describe, expect, it } from 'vitest';
import { compareGpsEvidence } from '../gpsEvidence';

const QUADRADO_1KM = JSON.stringify({
    type: 'Polygon',
    coordinates: [[
        [-46.66, -23.56], [-46.65, -23.56], [-46.65, -23.55], [-46.66, -23.55], [-46.66, -23.56],
    ]],
});

describe('compareGpsEvidence', () => {
    it('marca divergente=false e dentroPoligono=true quando o ponto cai dentro da poligonal', () => {
        const result = compareGpsEvidence(
            [-46.655, -23.555],
            { geojson: QUADRADO_1KM, centroid_lat: -23.555, centroid_lng: -46.655 },
            null,
        );
        expect(result.dentroPoligono).toBe(true);
        expect(result.divergente).toBe(false);
    });

    it('marca divergente=true e dentroPoligono=false quando o ponto cai fora da poligonal', () => {
        const result = compareGpsEvidence(
            [-46.5, -23.5],
            { geojson: QUADRADO_1KM, centroid_lat: -23.555, centroid_lng: -46.655 },
            null,
        );
        expect(result.dentroPoligono).toBe(false);
        expect(result.divergente).toBe(true);
    });

    it('não marca divergente quando não há terreno para comparar (dentroPoligono null)', () => {
        const result = compareGpsEvidence([-46.5, -23.5], null, null);
        expect(result.dentroPoligono).toBeNull();
        expect(result.divergente).toBe(false);
    });

    it('não lança em geojson malformado; dentroPoligono fica null', () => {
        const result = compareGpsEvidence([-46.5, -23.5], { geojson: 'not-json', centroid_lat: null, centroid_lng: null }, null);
        expect(result.dentroPoligono).toBeNull();
        expect(result.divergente).toBe(false);
    });

    it('usa ponto operacional como referência de distância quando disponível', () => {
        const result = compareGpsEvidence(
            [-46.655, -23.555],
            { geojson: QUADRADO_1KM, centroid_lat: -23.5595, centroid_lng: -46.6595 },
            { latitude: -23.555, longitude: -46.655 },
        );
        expect(result.referenciaOrigem).toBe('ponto_operacional');
        expect(result.distanciaReferenciaM).toBe(0);
    });

    it('cai para o centroide do terreno como referência quando não há ponto operacional', () => {
        const result = compareGpsEvidence(
            [-46.655, -23.555],
            { geojson: QUADRADO_1KM, centroid_lat: -23.555, centroid_lng: -46.655 },
            null,
        );
        expect(result.referenciaOrigem).toBe('centroide');
        expect(result.distanciaReferenciaM).toBe(0);
    });

    it('não tem referência de distância quando não há ponto operacional nem centroide', () => {
        const result = compareGpsEvidence([-46.5, -23.5], { geojson: QUADRADO_1KM, centroid_lat: null, centroid_lng: null }, null);
        expect(result.referenciaOrigem).toBeNull();
        expect(result.distanciaReferenciaM).toBeNull();
    });
});
