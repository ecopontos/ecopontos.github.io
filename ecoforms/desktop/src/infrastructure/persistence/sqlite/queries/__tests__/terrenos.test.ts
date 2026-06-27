import { describe, expect, it } from 'vitest';
import {
    TERRENOS_IN_VIEWPORT_CENTROID,
    TERRENOS_IN_VIEWPORT_RTREE,
    TERRENOS_RTREE_UPSERT,
} from '../terrenos';

describe('terrenos spatial queries', () => {
    it('uses rowid-backed R-Tree intersection for viewport loading', () => {
        expect(TERRENOS_IN_VIEWPORT_RTREE.sql).toContain('INNER JOIN terrenos_rtree r ON r.id = t.rowid');
        expect(TERRENOS_IN_VIEWPORT_RTREE.sql).toContain('r.max_lng >= ? AND r.min_lng <= ?');
        expect(TERRENOS_IN_VIEWPORT_RTREE.sql).toContain('r.max_lat >= ? AND r.min_lat <= ?');
        expect(TERRENOS_IN_VIEWPORT_RTREE.params).toEqual(['min_lng', 'max_lng', 'min_lat', 'max_lat']);
    });

    it('keeps centroid fallback parameter order aligned with bbox input', () => {
        expect(TERRENOS_IN_VIEWPORT_CENTROID.sql).toContain('centroid_lng >= ? AND centroid_lng <= ?');
        expect(TERRENOS_IN_VIEWPORT_CENTROID.sql).toContain('centroid_lat >= ? AND centroid_lat <= ?');
        expect(TERRENOS_IN_VIEWPORT_CENTROID.params).toEqual(['min_lng', 'max_lng', 'min_lat', 'max_lat']);
    });

    it('rebuilds the R-Tree row from the terreno rowid and bbox params', () => {
        expect(TERRENOS_RTREE_UPSERT.sql).toContain('SELECT rowid, ?, ?, ?, ? FROM terrenos WHERE id = ?');
        expect(TERRENOS_RTREE_UPSERT.params).toEqual(['min_lng', 'max_lng', 'min_lat', 'max_lat', 'terreno_id']);
    });
});
