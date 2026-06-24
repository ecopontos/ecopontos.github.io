import type { StyleSpecification } from 'maplibre-gl';

export const OSM_STYLE: StyleSpecification = {
    version: 8,
    sources: {
        osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
        },
    },
    layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
};

export const SATELLITE_STYLE: StyleSpecification = {
    version: 8,
    sources: {
        satellite: {
            type: 'raster',
            // Esri usa {z}/{y}/{x} — atenção à ordem y/x
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics',
        },
    },
    layers: [{ id: 'satellite-tiles', type: 'raster', source: 'satellite' }],
};

export const TIPO_CORES: Record<string, string> = {
    residencial: '#22c55e',
    comercial:   '#3b82f6',
    industrial:  '#f59e0b',
    publico:     '#8b5cf6',
    rural:       '#84cc16',
    outro:       '#6b7280',
};

export const TIPO_LABELS: Record<string, string> = {
    residencial: 'Residencial',
    comercial:   'Comercial',
    industrial:  'Industrial',
    publico:     'Público',
    rural:       'Rural',
    outro:       'Outro',
};

export const CATEGORIA_LABELS: Record<string, string> = {
    terreno: 'Terreno', pontos_gps: 'Pontos GPS', infraestrutura: 'Infraestrutura', outro: 'Outro',
};
