"use client";
/* eslint-disable react-hooks/refs */
import { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import type { AgendamentoMapPoint } from "@/src/interface/hooks/catalog/service";
import { createBaseMap } from "@/lib/map-base";

const STATUS_COLORS: Record<string, string> = {
    pendente: "#f59e0b",
    confirmado: "#22c55e",
    realizado: "#3b82f6",
};

interface Props {
    points: AgendamentoMapPoint[];
    selectedId: string | null;
    onPointClick?: (id: string) => void;
}

function formatEndereco(p: AgendamentoMapPoint): string {
    const parts = [p.endereco, p.numero, p.bairro, p.cidade].filter(Boolean);
    return parts.join(", ") || "—";
}

export default function RoteiroMap({ points, selectedId, onPointClick }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const popupsRef = useRef<maplibregl.Popup[]>([]);

    const pointsRef = useRef(points);
    pointsRef.current = points;
    const selectedRef = useRef(selectedId);
    selectedRef.current = selectedId;

    const renderLayers = useCallback((map: maplibregl.Map) => {
        popupsRef.current.forEach((p) => p.remove());
        popupsRef.current = [];

        const pts = pointsRef.current;

        const geojson: FeatureCollection = {
            type: "FeatureCollection",
            features: pts.map((p) => ({
                type: "Feature" as const,
                geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
                properties: {
                    id: p.id,
                    nome: p.clienteNome,
                    status: p.status,
                    endereco: formatEndereco(p),
                    bairro: p.bairro ?? "",
                },
            })),
        };

        if (map.getSource("booking-points")) {
            (map.getSource("booking-points") as maplibregl.GeoJSONSource).setData(geojson);
        } else {
            map.addSource("booking-points", { type: "geojson", data: geojson });

            map.addLayer({
                id: "booking-glow",
                type: "circle",
                source: "booking-points",
                paint: {
                    "circle-radius": 12,
                    "circle-color": ["match", ["get", "status"], "confirmado", "#22c55e", "realizado", "#3b82f6", "#f59e0b"],
                    "circle-opacity": 0.15,
                },
            });

            map.addLayer({
                id: "booking-circle",
                type: "circle",
                source: "booking-points",
                paint: {
                    "circle-radius": 7,
                    "circle-color": ["match", ["get", "status"], "confirmado", "#22c55e", "realizado", "#3b82f6", "#f59e0b"],
                    "circle-stroke-width": 2,
                    "circle-stroke-color": "#ffffff",
                },
            });

            map.on("click", "booking-circle", (e) => {
                popupsRef.current.forEach((p) => p.remove());
                popupsRef.current = [];
                const f = e.features?.[0];
                if (!f || f.geometry.type !== "Point") return;
                const props = f.properties as Record<string, string>;
                const coords = f.geometry.coordinates as [number, number];
                const statusLabel: Record<string, string> = { pendente: "Pendente", confirmado: "Confirmado", realizado: "Realizado" };
                const badge = statusLabel[props.status] ?? props.status;
                const popup = new maplibregl.Popup({ maxWidth: "260px" })
                    .setLngLat(coords)
                    .setHTML(
                        `<div style="font-family:sans-serif;font-size:13px;line-height:1.5">
                            <strong style="font-size:14px">${props.nome}</strong>
                            <span style="background:#22c55e1a;color:#16a34a;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:600;margin-left:4px">${badge}</span>
                            <br/><span style="color:#888;font-size:11px">${props.endereco}</span>
                        </div>`,
                    )
                    .addTo(map);
                popupsRef.current.push(popup);
                if (onPointClick) onPointClick(props.id as string);
            });
            map.on("mouseenter", "booking-circle", () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", "booking-circle", () => { map.getCanvas().style.cursor = ""; });
        }

        if (pts.length >= 2) {
            const routeGeo: FeatureCollection = {
                type: "FeatureCollection",
                features: (() => {
                    const segments: FeatureCollection["features"] = [];
                    for (let i = 0; i < pts.length - 1; i++) {
                        segments.push({
                            type: "Feature" as const,
                            geometry: {
                                type: "LineString",
                                coordinates: [
                                    [pts[i].longitude, pts[i].latitude],
                                    [pts[i + 1].longitude, pts[i + 1].latitude],
                                ],
                            },
                            properties: { segment: i + 1 },
                        });
                    }
                    return segments;
                })(),
            };

            if (map.getSource("route")) {
                (map.getSource("route") as maplibregl.GeoJSONSource).setData(routeGeo);
            } else {
                map.addSource("route", { type: "geojson", data: routeGeo });
                map.addLayer({
                    id: "route-casing",
                    type: "line",
                    source: "route",
                    paint: { "line-color": "#ffffff", "line-width": 5, "line-opacity": 0.3 },
                    layout: { "line-cap": "round" },
                });
                map.addLayer({
                    id: "route-line",
                    type: "line",
                    source: "route",
                    paint: { "line-color": "#3b82f6", "line-width": 3, "line-opacity": 0.6 },
                });
                map.moveLayer("route-casing", "route-line");
            }
        } else if (map.getSource("route")) {
            (map.getSource("route") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: [] });
        }

        const allCoords = pts.map((p) => [p.longitude, p.latitude] as [number, number]);
        if (allCoords.length > 0) {
            const bounds = new maplibregl.LngLatBounds(allCoords[0], allCoords[0]);
            for (const c of allCoords.slice(1)) bounds.extend(c);
            map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: pts.length > 1 ? 600 : 0 });
        }
    }, [onPointClick]);

    useEffect(() => {
        if (!containerRef.current) return;
        const map = createBaseMap(containerRef.current);

        map.on("load", () => {
            mapRef.current = map;
            renderLayers(map);
        });

        return () => {
            popupsRef.current.forEach((p) => p.remove());
            popupsRef.current = [];
            map.remove();
            mapRef.current = null;
        };
    }, [renderLayers]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        renderLayers(map);
    }, [points, renderLayers]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const layerId = "booking-circle";
        if (!map.getLayer(layerId)) return;
        map.setFilter(
            layerId,
            selectedId ? ["any", ["==", ["get", "id"], selectedId], ["has", "id"]] : null,
        );
    }, [selectedId]);

    return <div ref={containerRef} className="w-full h-full rounded-md overflow-hidden" />;
}