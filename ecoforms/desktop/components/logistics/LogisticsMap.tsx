"use client";

import { useCallback, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '@/contexts/AuthContext';
import { useMapInstance } from './hooks/useMapInstance';
import { useGeoDataLayers } from './hooks/useGeoDataLayers';
import { useExecucaoLayers } from './hooks/useExecucaoLayers';
import { useLayerActions } from './hooks/useLayerActions';
import { MapControls } from './panels/MapControls';
import { MapLegend } from './panels/MapLegend';
import { PontosColetaPanel } from './panels/PontosColetaPanel';
import { ExecucaoPanel } from './panels/ExecucaoPanel';
import { ItinerarioPanel } from './panels/ItinerarioPanel';
import { TerrenosPanel } from './panels/TerrenosPanel';
import { CamadasGenericasPanel } from './panels/CamadasGenericasPanel';

export default function LogisticsMap() {
    const { user } = useAuth();
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    const geoData = useGeoDataLayers(mapRef);
    const execLayers = useExecucaoLayers(mapRef, geoData.selectedRoteiroId);

    const onStyleLoad = useCallback((map: maplibregl.Map) => {
        geoData.renderDataLayers(map);
        execLayers.renderAllExecLayers(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { isSatellite, setIsSatellite } = useMapInstance(mapContainer, mapRef, onStyleLoad);

    const layerActions = useLayerActions({
        mapRef,
        userId: user?.id,
        refetchLayers: geoData.refetchLayers,
        refetchTerrenos: geoData.refetchTerrenos,
        clientesRef: geoData.clientesRef,
        clientesVisRef: geoData.clientesVisRef,
        itinerarioRef: geoData.itinerarioRef,
        itinerarioVisRef: geoData.itinerarioVisRef,
    });

    const tiposPresentes = [...new Set(geoData.terrenos.map(t => t.tipo))];

    return (
        <div className="flex gap-4 h-[calc(100vh-300px)] min-h-[560px]">
            {/* ── Mapa ── */}
            <div className="relative flex-1 rounded-lg overflow-hidden border bg-muted">
                <div ref={mapContainer} className="w-full h-full" />

                <MapControls
                    isSatellite={isSatellite}
                    onToggleSatellite={() => setIsSatellite(v => !v)}
                    onFitAll={layerActions.handleFitAll}
                />

                <MapLegend
                    clientesVisible={geoData.clientesVisible}
                    selectedRoteiroId={geoData.selectedRoteiroId}
                    itinerarioVisible={geoData.itinerarioVisible}
                    selectedExecucaoId={execLayers.selectedExecucaoId}
                    execucaoLayerVisible={execLayers.execucaoLayerVisible}
                    intercorrenciasLayerVisible={execLayers.intercorrenciasLayerVisible}
                    checklistLayerVisible={execLayers.checklistLayerVisible}
                    terrenosVisible={geoData.terrenosVisible}
                    tiposPresentes={tiposPresentes}
                    loadingClientes={geoData.loadingClientes}
                    clientesCount={geoData.clientes.length}
                    terrenosCount={geoData.terrenos.length}
                />
            </div>

            {/* ── Painel lateral ── */}
            <div className="w-64 flex flex-col gap-4 overflow-y-auto pb-2">

                <PontosColetaPanel
                    clientesCount={geoData.clientes.length}
                    clientesVisible={geoData.clientesVisible}
                    onToggleVisible={() => geoData.setClientesVisible(v => !v)}
                    loadingClientes={geoData.loadingClientes}
                />

                <div className="border-t" />

                <ExecucaoPanel
                    execucoes={execLayers.execucoes}
                    selectedExecucaoId={execLayers.selectedExecucaoId}
                    onSelectExecucao={(id) => {
                        execLayers.setSelectedExecucaoId(id || null);
                        if (id) {
                            execLayers.setExecucaoLayerVisible(true);
                            execLayers.setIntercorrenciasLayerVisible(true);
                            execLayers.setChecklistLayerVisible(true);
                        }
                    }}
                    execucaoLayerVisible={execLayers.execucaoLayerVisible}
                    onToggleExecucaoLayer={() => execLayers.setExecucaoLayerVisible(v => !v)}
                    intercorrenciasLayerVisible={execLayers.intercorrenciasLayerVisible}
                    onToggleIntercorrenciasLayer={() => execLayers.setIntercorrenciasLayerVisible(v => !v)}
                    checklistLayerVisible={execLayers.checklistLayerVisible}
                    onToggleChecklistLayer={() => execLayers.setChecklistLayerVisible(v => !v)}
                />

                <div className="border-t" />

                <ItinerarioPanel
                    roteiros={geoData.roteiros}
                    selectedRoteiroId={geoData.selectedRoteiroId}
                    onSelectRoteiro={(id) => {
                        geoData.setSelectedRoteiroId(id || null);
                        if (id) geoData.setItinerarioVisible(true);
                    }}
                    itinerarioVisible={geoData.itinerarioVisible}
                    onToggleVisible={() => geoData.setItinerarioVisible(v => !v)}
                    itinerario={geoData.itinerario}
                />

                <div className="border-t" />

                <TerrenosPanel
                    terrenos={geoData.terrenos}
                    terrenosVisible={geoData.terrenosVisible}
                    onToggleVisible={() => geoData.setTerrenosVisible(v => !v)}
                    loadingTerrenos={geoData.loadingTerrenos}
                    refetchTerrenos={geoData.refetchTerrenos}
                    onDeleteTerreno={layerActions.handleDeleteTerreno}
                />

                <div className="border-t" />

                <CamadasGenericasPanel
                    geoLayers={geoData.geoLayers}
                    loadingLayers={geoData.loadingLayers}
                    refetchLayers={geoData.refetchLayers}
                    fileInputRef={layerActions.fileInputRef}
                    uploading={layerActions.uploading}
                    onFileUpload={layerActions.handleFileUpload}
                    onToggleLayer={layerActions.handleToggleLayer}
                    onDeleteLayer={layerActions.handleDeleteLayer}
                />

                <p className="text-[10px] text-muted-foreground">
                    Terrenos: importe o cadastro municipal (.geojson).<br />
                    Camadas: qualquer GeoJSON adicional.<br />
                    KML/GPX → converta em <strong>mapshaper.org</strong>.
                </p>
            </div>
        </div>
    );
}
