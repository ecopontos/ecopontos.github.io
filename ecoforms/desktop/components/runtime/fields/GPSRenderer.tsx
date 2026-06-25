import { useState, useEffect } from "react";
import { FormField } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, MapPin, RefreshCw, ExternalLink, Navigation } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface GPSRendererProps {
    field: FormField;
    value: GPSData | null | undefined;
    onChange: (value: GPSData) => void;
    readOnly?: boolean;
}

export interface GPSData {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: number;
    altitude?: number | null;
    speed?: number | null;
}

export function GPSRenderer({ field, value, onChange, readOnly = false }: GPSRendererProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const gpsData = value ?? null;

    const handleGetLocation = () => {
        if (readOnly) return;
        setLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            setError("Geolocalização não suportada pelo navegador.");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newData: GPSData = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    speed: position.coords.speed,
                    timestamp: position.timestamp,
                };
                onChange(newData);
                setLoading(false);
            },
            (err) => {
                let msg = "Erro desconhecido ao obter localização.";
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        msg = "Permissão de localização negada.";
                        break;
                    case err.POSITION_UNAVAILABLE:
                        msg = "Informações de localização indisponíveis.";
                        break;
                    case err.TIMEOUT:
                        msg = "Tempo limite esgotado ao buscar localização.";
                        break;
                }
                setError(msg);
                setLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    const getAccuracyColor = (acc: number) => {
        if (acc <= 10) return "text-green-600 bg-green-50 border-green-200";
        if (acc <= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
        return "text-red-600 bg-red-50 border-red-200";
    };

    const formatCoord = (n: number) => n.toFixed(6);

    return (
        <div className="w-full space-y-3">
            {/* Action Button */}
            <div className="flex items-center gap-3">
                <Button
                    type="button"
                    variant={gpsData ? "outline" : "default"}
                    onClick={handleGetLocation}
                    disabled={loading || readOnly}
                    className={cn("w-full md:w-auto relative", (loading || readOnly) && "opacity-80")}
                >
                    {loading ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        gpsData ? <RefreshCw className="mr-2 h-4 w-4" /> : <MapPin className="mr-2 h-4 w-4" />
                    )}
                    {loading ? "Obtendo satélites..." : (gpsData ? "Atualizar Localização" : "Capturar Localização")}
                </Button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}

            {/* Data Display */}
            {gpsData && !loading && (
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2">
                    {/* Header with quick stats */}
                    <div className="bg-gray-50/50 p-3 flex items-center justify-between border-b">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("px-2 py-0.5 border", getAccuracyColor(gpsData.accuracy))}>
                                Prec: ±{Math.round(gpsData.accuracy)}m
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {new Date(gpsData.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${gpsData.lat},${gpsData.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs flex items-center gap-1 text-blue-600 hover:underline"
                        >
                            Ver no Mapa <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    {/* Coordinates Grid */}
                    <div className="p-4 grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1">Latitude</span>
                            <div className="font-mono text-lg text-gray-800 tracking-tight">{formatCoord(gpsData.lat)}</div>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1">Longitude</span>
                            <div className="font-mono text-lg text-gray-800 tracking-tight">{formatCoord(gpsData.lng)}</div>
                        </div>
                        {(gpsData.altitude || gpsData.speed) && (
                            <>
                                {gpsData.altitude && (
                                    <div className="col-span-1">
                                        <span className="text-xs text-muted-foreground block mb-1">Altitude</span>
                                        <div className="text-sm">{Math.round(gpsData.altitude)}m</div>
                                    </div>
                                )}
                                {gpsData.speed && (
                                    <div className="col-span-1">
                                        <span className="text-xs text-muted-foreground block mb-1">Velocidade</span>
                                        <div className="text-sm">{Math.round(gpsData.speed * 3.6)} km/h</div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
