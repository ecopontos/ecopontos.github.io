import { describe, expect, it } from 'vitest';
import { bboxContains, bboxIntersects, extractBbox } from '@/lib/geo/bbox';

describe('extractBbox', () => {
    it('extracts a Polygon bbox', () => {
        const geojson = JSON.stringify({
            type: 'Polygon',
            coordinates: [[
                [-48.5, -27.7],
                [-48.1, -27.8],
                [-48.2, -27.3],
                [-48.5, -27.7],
            ]],
        });

        expect(extractBbox(geojson)).toEqual([-48.5, -27.8, -48.1, -27.3]);
    });

    it('extracts a MultiPolygon bbox', () => {
        const geojson = JSON.stringify({
            type: 'MultiPolygon',
            coordinates: [
                [[
                    [-48.5, -27.7],
                    [-48.4, -27.7],
                    [-48.4, -27.6],
                    [-48.5, -27.7],
                ]],
                [[
                    [-47.9, -28.1],
                    [-47.8, -28.1],
                    [-47.8, -28.0],
                    [-47.9, -28.1],
                ]],
            ],
        });

        expect(extractBbox(geojson)).toEqual([-48.5, -28.1, -47.8, -27.6]);
    });

    it('returns null for invalid or unsupported geometry', () => {
        expect(extractBbox('{bad json')).toBeNull();
        expect(extractBbox(JSON.stringify({ type: 'Point', coordinates: [-48, -27] }))).toBeNull();
        expect(extractBbox(JSON.stringify({ type: 'Polygon', coordinates: [] }))).toBeNull();
    });
});

describe('bbox helpers', () => {
    it('checks intersection and containment', () => {
        expect(bboxIntersects([0, 0, 10, 10], [5, 5, 15, 15])).toBe(true);
        expect(bboxIntersects([0, 0, 10, 10], [11, 11, 15, 15])).toBe(false);
        expect(bboxContains([0, 0, 10, 10], [2, 2, 8, 8])).toBe(true);
        expect(bboxContains([0, 0, 10, 10], [-1, 2, 8, 8])).toBe(false);
    });
});
