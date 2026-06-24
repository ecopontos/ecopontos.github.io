"use client";

import { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { ClienteGeo, ItinerarioStop, TerrenoGeo } from "@/src/interface/hooks/queries/useMapData";

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};

interface Props {
  clientesGeo: ClienteGeo[];
  itinerario: ItinerarioStop[];
  terrenosGeo: TerrenoGeo[];
  selectedClienteId: string | null;
  onClienteClick?: (id: string) => void;
}

const ORDERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

export default function ItinerarioMap({ clientesGeo, itinerario, terrenosGeo, selectedClienteId, onClienteClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupsRef = useRef<maplibregl.Popup[]>([]);

  const itIdsRef = useRef(new Set<string>());
  const itIds = new Set(itinerario.map((s) => s.cliente_id));
  itIdsRef.current = itIds;

  const clientesGeoRef = useRef(clientesGeo);
  clientesGeoRef.current = clientesGeo;
  const itinerarioRef = useRef(itinerario);
  itinerarioRef.current = itinerario;
  const terrenosGeoRef = useRef(terrenosGeo);
  terrenosGeoRef.current = terrenosGeo;
  const selectedRef = useRef(selectedClienteId);
  selectedRef.current = selectedClienteId;

  const onCloseMap = useCallback(() => {
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];
  }, []);

  const renderLayers = useCallback((map: maplibregl.Map) => {
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    const cli = clientesGeoRef.current;
    const iti = itinerarioRef.current;
    const itIdsNow = itIdsRef.current;

    // --- all clients: in-itinerary (bright) vs available (faded) ---
    const allClientsGeo: FeatureCollection = {
      type: "FeatureCollection",
      features: cli.map((c) => ({
        type: "Feature" as const,
        geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
        properties: {
          id: c.id,
          nome: c.nome,
          tipo: c.tipo,
          endereco: c.endereco,
          in_route: itIdsNow.has(c.id) ? 1 : 0,
        },
      })),
    };
    if (map.getSource("all-clients")) {
      (map.getSource("all-clients") as maplibregl.GeoJSONSource).setData(allClientsGeo);
    } else {
      map.addSource("all-clients", { type: "geojson", data: allClientsGeo });

      // outer glow for in-route clients
      map.addLayer({
        id: "clients-in-route-glow",
        type: "circle",
        source: "all-clients",
        filter: ["==", ["get", "in_route"], 1],
        paint: {
          "circle-radius": 12,
          "circle-color": "#ef4444",
          "circle-opacity": 0.18,
        },
      });

      // main circle: bright for in-route, faded for available
      map.addLayer({
        id: "clients-circle",
        type: "circle",
        source: "all-clients",
        paint: {
          "circle-radius": [
            "case", ["==", ["get", "in_route"], 1], 7, 5,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "in_route"], 1], "#ef4444",
            ["match", ["get", "tipo"], "PF", "#22c55e", "PJ", "#3b82f6", "#6b7280"],
          ],
          "circle-stroke-width": [
            "case", ["==", ["get", "in_route"], 1], 2.5, 1,
          ],
          "circle-stroke-color": [
            "case", ["==", ["get", "in_route"], 1], "#ffffff", "#ffffff",
          ],
          "circle-opacity": [
            "case", ["==", ["get", "in_route"], 1], 1, 0.35,
          ],
        },
      });

      map.on("click", "clients-circle", (e) => {
        popupsRef.current.forEach((p) => p.remove());
        popupsRef.current = [];
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const p = f.properties as Record<string, string | number>;
        const coords = f.geometry.coordinates as [number, number];
        const inRoute = p.in_route === 1;
        const badge = inRoute
          ? `<span style="background:#ef4444;color:#fff;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:600">NO ROTEIRO</span>`
          : "";
        const popup = new maplibregl.Popup({ maxWidth: "240px" })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family:sans-serif;font-size:13px;line-height:1.5"><strong style="font-size:14px">${p.nome}</strong> ${badge}<br/><span style="color:#888;font-size:11px">${p.tipo}${p.endereco ? ` · ${p.endereco}` : ""}</span></div>`,
          )
          .addTo(map);
        popupsRef.current.push(popup);
        if (onClienteClick) onClienteClick(p.id as string);
      });
      map.on("mouseenter", "clients-circle", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clients-circle", () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // --- route line connecting itinerary stops ---
    const routePoints = iti.filter((s) => s.latitude != null && s.longitude != null);
    if (routePoints.length >= 2) {
      const segments: FeatureCollection["features"] = [];
      for (let i = 0; i < routePoints.length - 1; i++) {
        segments.push({
          type: "Feature" as const,
          geometry: {
            type: "LineString",
            coordinates: [
              [routePoints[i].longitude!, routePoints[i].latitude!],
              [routePoints[i + 1].longitude!, routePoints[i + 1].latitude!],
            ],
          },
          properties: { segment: i + 1 },
        });
      }
      const routeGeo: FeatureCollection = { type: "FeatureCollection", features: segments };
      if (map.getSource("route")) {
        (map.getSource("route") as maplibregl.GeoJSONSource).setData(routeGeo);
      } else {
        map.addSource("route", { type: "geojson", data: routeGeo });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#ef4444",
            "line-width": 3,
            "line-opacity": 0.6,
          },
        });
        map.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#ffffff",
            "line-width": 5,
            "line-opacity": 0.3,
          },
          layout: { "line-cap": "round" },
        });
        // move casing behind line
        map.moveLayer("route-casing", "route-line");
      }
    } else if (map.getSource("route")) {
      (map.getSource("route") as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [],
      });
    }

    // --- order labels for itinerary stops ---
    const stopsGeo: FeatureCollection = {
      type: "FeatureCollection",
      features: routePoints.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point", coordinates: [s.longitude!, s.latitude!] },
        properties: {
          id: s.cliente_id,
          nome: s.nome,
          ordem: s.ordem,
          terreno_nome: s.terreno_nome,
          codigo_cadastral: s.codigo_cadastral,
        },
      })),
    };
    if (map.getSource("stops-labels")) {
      (map.getSource("stops-labels") as maplibregl.GeoJSONSource).setData(stopsGeo);
    } else {
      map.addSource("stops-labels", { type: "geojson", data: stopsGeo });
      // white halo behind order number
      map.addLayer({
        id: "stops-ordem-halo",
        type: "symbol",
        source: "stops-labels",
        layout: {
          "text-field": ["to-string", ["get", "ordem"]],
          "text-size": 12,
          "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
          "text-anchor": "top",
          "text-offset": [0, 1],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#fff", "text-halo-width": 2, "text-halo-color": "#ef4444" },
      });
      map.addLayer({
        id: "stops-ordem-text",
        type: "symbol",
        source: "stops-labels",
        layout: {
          "text-field": ["to-string", ["get", "ordem"]],
          "text-size": 12,
          "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
          "text-anchor": "top",
          "text-offset": [0, 1],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ef4444" },
      });
    }

    // --- terreno polygons for in-route clients ---
    const terrenoIndex = new Map<string, TerrenoGeo>();
    for (const t of terrenosGeoRef.current) terrenoIndex.set(t.id, t);

    const terrenoFeatures: FeatureCollection["features"] = [];
    for (const stop of iti) {
      if (!stop.terreno_id) continue;
      const t = terrenoIndex.get(stop.terreno_id);
      if (!t) continue;
      let geom;
      try { geom = JSON.parse(t.geojson); } catch { continue; }
      terrenoFeatures.push({
        type: "Feature" as const,
        geometry: geom,
        properties: {
          terreno_id: t.id,
          cliente_id: stop.cliente_id,
          nome: t.nome,
          codigo_cadastral: t.codigo_cadastral,
        },
      });
    }
    const terrenosRouteGeo: FeatureCollection = { type: "FeatureCollection", features: terrenoFeatures };

    if (map.getSource("terrenos-route")) {
      (map.getSource("terrenos-route") as maplibregl.GeoJSONSource).setData(terrenosRouteGeo);
    } else {
      map.addSource("terrenos-route", { type: "geojson", data: terrenosRouteGeo });
      map.addLayer({
        id: "terrenos-route-fill",
        type: "fill",
        source: "terrenos-route",
        paint: { "fill-color": "#ef4444", "fill-opacity": 0.12 },
      }, "clients-in-route-glow");
      map.addLayer({
        id: "terrenos-route-outline",
        type: "line",
        source: "terrenos-route",
        paint: { "line-color": "#ef4444", "line-width": 1.5, "line-opacity": 0.6 },
      }, "clients-in-route-glow");
    }

    // --- fit bounds ---
    const allCoords: [number, number][] = [
      ...cli.map((c) => [c.longitude, c.latitude] as [number, number]),
    ];
    if (allCoords.length > 0) {
      const bounds = new maplibregl.LngLatBounds(allCoords[0], allCoords[0]);
      for (const c of allCoords.slice(1)) bounds.extend(c);
      if (iti.length > 0) {
        map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 600 });
      } else {
        map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 0 });
      }
    }
  }, [onClienteClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      attributionControl: false,
      zoom: 12,
      center: [-48.5, -27.6],
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      mapRef.current = map;
      renderLayers(map);
    });

    return () => {
      onCloseMap();
      map.remove();
      mapRef.current = null;
    };
  }, [renderLayers, onCloseMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    renderLayers(map);
  }, [clientesGeo, itinerario, terrenosGeo, renderLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("clients-circle")) {
      map.setFilter(
        "clients-circle",
        selectedClienteId ? ["any", ["==", ["get", "id"], selectedClienteId], ["!", ["has", "id"]]] : null,
      );
    }
    if (map.getLayer("clients-in-route-glow")) {
      map.setFilter(
        "clients-in-route-glow",
        selectedClienteId
          ? ["any", ["==", ["get", "id"], selectedClienteId], ["==", ["get", "in_route"], 1]]
          : ["==", ["get", "in_route"], 1],
      );
    }
    if (map.getLayer("terrenos-route-fill")) {
      map.setPaintProperty(
        "terrenos-route-fill",
        "fill-opacity",
        selectedClienteId
          ? ["case", ["==", ["get", "cliente_id"], selectedClienteId], 0.35, 0.08]
          : 0.12,
      );
      map.setPaintProperty(
        "terrenos-route-outline",
        "line-opacity",
        selectedClienteId
          ? ["case", ["==", ["get", "cliente_id"], selectedClienteId], 1.0, 0.35]
          : 0.6,
      );
    }
  }, [selectedClienteId]);

  return <div ref={containerRef} className="w-full h-full rounded-md overflow-hidden" />;
}