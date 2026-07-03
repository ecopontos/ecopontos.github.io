"use client";
/**
 * Mini-mapa para a página de detalhe do terreno (Fase 4 — georreferenciamento).
 * Renderiza a poligonal, o centroide e um marker draggable para posicionar o
 * ponto operacional. Primeiro uso de `maplibregl.Marker({ draggable: true })` no app.
 *
 * Modelo: ItinerarioMap.tsx (createBaseMap + addSource/addLayer idiom).
 */
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createBaseMap } from "@/lib/map-base";
import { computeCentroid } from "@/src/interface/hooks/queries/useMapData";
import type { PontoOperacional } from "@/types/clientes";

interface PontoOperacionalMapProps {
    /** GeoJSON Geometry da poligonal do terreno (Polygon/MultiPolygon). */
    geometria: GeoJSON.Geometry;
    pontos: PontoOperacional[];
    /** Coordenada inicial quando o operador está criando um ponto novo ([lng, lat]). */
    rascunho: [number, number] | null;
    /** Callback quando o marker draggable é solto. */
    onRascunhoChange: (lngLat: [number, number]) => void;
}

export function PontoOperacionalMap({
    geometria,
    pontos,
    rascunho,
    onRascunhoChange,
}: PontoOperacionalMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const draftMarkerRef = useRef<maplibregl.Marker | null>(null);
    const savedMarkersRef = useRef<maplibregl.Marker[]>([]);
    const onRascunhoRef = useRef(onRascunhoChange);
    onRascunhoRef.current = onRascunhoChange;

    // Init do mapa (uma vez) + render da poligonal/centroide + fitBounds.
    useEffect(() => {
        if (!containerRef.current) return;
        const centroide = computeCentroid(geometria) ?? [-48.5, -27.6];
        const map = createBaseMap(containerRef.current, { center: centroide, zoom: 15 });
        mapRef.current = map;

        map.on("load", () => {
            const polyGeoJSON: GeoJSON.Feature = { type: "Feature", geometry: geometria, properties: {} };
            map.addSource("terreno-poly", { type: "geojson", data: polyGeoJSON });
            map.addLayer({
                id: "terreno-poly-fill",
                type: "fill",
                source: "terreno-poly",
                paint: { "fill-color": "#3b82f6", "fill-opacity": 0.12 },
            });
            map.addLayer({
                id: "terreno-poly-outline",
                type: "line",
                source: "terreno-poly",
                paint: { "line-color": "#3b82f6", "line-width": 1.5, "line-opacity": 0.7 },
            });

            // Centroide como referência visual (círculo amarelo).
            const [clng, clat] = centroide;
            const centroidGeoJSON: GeoJSON.FeatureCollection = {
                type: "FeatureCollection",
                features: [{ type: "Feature", geometry: { type: "Point", coordinates: [clng, clat] }, properties: {} }],
            };
            map.addSource("terreno-centroid", { type: "geojson", data: centroidGeoJSON });
            map.addLayer({
                id: "terreno-centroid-circle",
                type: "circle",
                source: "terreno-centroid",
                paint: { "circle-radius": 5, "circle-color": "#eab308", "circle-stroke-width": 1, "circle-stroke-color": "#ffffff" },
            });

            // fitBounds na poligonal.
            const bounds = new maplibregl.LngLatBounds();
            try {
                const rings = geometria.type === "Polygon" ? [geometria.coordinates[0]]
                    : geometria.type === "MultiPolygon" ? geometria.coordinates.map((p) => p[0])
                    : [];
                for (const ring of rings) for (const [lng, lat] of ring) bounds.extend([lng, lat]);
                if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 600 });
            } catch {
                // geometria inesperada — mantém o centro/zoom inicial.
            }

            criarMarkerRascunho(map);
            renderizarPontosSalvos(map);
        });

        return () => {
            for (const m of savedMarkersRef.current) m.remove();
            savedMarkersRef.current = [];
            draftMarkerRef.current?.remove();
            draftMarkerRef.current = null;
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geometria]);

    // Marker draggable do rascunho (criação/edição). Recria quando a coordenada externa muda.
    function criarMarkerRascunho(map: maplibregl.Map) {
        draftMarkerRef.current?.remove();
        const start: [number, number] = rascunho ?? computeCentroid(geometria) ?? [-48.5, -27.6];
        const m = new maplibregl.Marker({ draggable: true, color: "#f97316" })
            .setLngLat(start)
            .addTo(map);
        m.on("dragend", () => {
            const ll = m.getLngLat();
            onRascunhoRef.current([ll.lng, ll.lat]);
        });
        draftMarkerRef.current = m;
    }

    // Recria marker rascunho quando a coordenada externa muda (ex.: botão "usar centroide").
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        if (!rascunho) return;
        // Atualiza posição sem recriar para não atrapalhar o drag.
        draftMarkerRef.current?.setLngLat(rascunho);
    }, [rascunho]);

    // Marcadores dos pontos já salvos (não draggable).
    function renderizarPontosSalvos(map: maplibregl.Map) {
        for (const m of savedMarkersRef.current) m.remove();
        savedMarkersRef.current = [];
        for (const p of pontos) {
            const cor = p.principal === 1 ? "#16a34a" : "#64748b";
            const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
                `<div style="font-size:12px">${p.tipo ?? "ponto"}${p.principal === 1 ? " (principal)" : ""}<br/>${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}</div>`,
            );
            const m = new maplibregl.Marker({ color: cor })
                .setLngLat([p.longitude, p.latitude])
                .setPopup(popup)
                .addTo(map);
            savedMarkersRef.current.push(m);
        }
    }

    // Re-render dos pontos salvos quando a lista muda.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        renderizarPontosSalvos(map);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pontos]);

    return <div ref={containerRef} className="w-full h-96 rounded-md overflow-hidden border" />;
}
