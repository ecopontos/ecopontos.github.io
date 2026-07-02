import { describe, expect, it } from 'vitest';
import {
    TERRENOS_IN_VIEWPORT_CENTROID,
    TERRENOS_IN_VIEWPORT_RTREE,
    TERRENOS_RTREE_UPSERT,
    CLIENTES_GEO,
    CLIENTES_GEO_IN_VIEWPORT,
    ROTEIRO_CLIENTES_ITINERARIO,
    PONTO_OP_INSERT,
    PONTO_OP_SET_PRINCIPAL,
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

describe('precedência de ponto operacional (Fase 4)', () => {
    it('CLIENTES_GEO prefere ponto operacional antes de centroide e cliente lat/lng', () => {
        expect(CLIENTES_GEO.sql).toContain('COALESCE(po.latitude, t.centroid_lat, c.latitude)');
        expect(CLIENTES_GEO.sql).toContain('COALESCE(po.longitude, t.centroid_lng, c.longitude)');
        expect(CLIENTES_GEO.sql).toContain('imovel_pontos_operacionais po');
    });

    it('CLIENTES_GEO_IN_VIEWPORT usa o mesmo COALESCE também no filtro de bbox', () => {
        expect(CLIENTES_GEO_IN_VIEWPORT.sql).toContain('COALESCE(po.latitude, t.centroid_lat, c.latitude)');
        expect(CLIENTES_GEO_IN_VIEWPORT.sql).toContain('COALESCE(po.longitude, t.centroid_lng, c.longitude) >= ?');
        expect(CLIENTES_GEO_IN_VIEWPORT.sql).toContain('COALESCE(po.longitude, t.centroid_lng, c.longitude) <= ?');
        expect(CLIENTES_GEO_IN_VIEWPORT.sql).toContain('COALESCE(po.latitude, t.centroid_lat, c.latitude)  >= ?');
        expect(CLIENTES_GEO_IN_VIEWPORT.sql).toContain('COALESCE(po.latitude, t.centroid_lat, c.latitude)  <= ?');
    });

    it('ROTEIRO_CLIENTES_ITINERARIO faz JOIN determinístico por ponto principal e expõe colunas crus', () => {
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('COALESCE(po.latitude, t.centroid_lat, c.latitude)');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('NOT EXISTS');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('po2.principal > po.principal');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('AS ponto_operacional_lat');
        expect(ROTEIRO_CLIENTES_ITINERARIO.sql).toContain('AS ponto_operacional_lng');
    });

    it('PONTO_OP_INSERT grava principal como inteiro', () => {
        expect(PONTO_OP_INSERT.params).toContain('principal');
        expect(PONTO_OP_INSERT.sql).toContain('imovel_pontos_operacionais');
    });

    it('PONTO_OP_SET_PRINCIPAL promove apenas um ponto a principal', () => {
        expect(PONTO_OP_SET_PRINCIPAL.sql).toContain('SET principal = 1');
        expect(PONTO_OP_SET_PRINCIPAL.params).toEqual(['id']);
    });
});
