import { useState } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Layers, RefreshCw, Trash2, Upload } from 'lucide-react';
import { CATEGORIA_LABELS } from '@/lib/map-styles';
import type { GeoLayer } from '@/src/interface/hooks/catalog/logistica';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CamadasGenericasPanelProps {
    geoLayers: GeoLayer[];
    loadingLayers: boolean;
    refetchLayers: () => Promise<void> | void;
    fileInputRef: RefObject<HTMLInputElement | null>;
    uploading: boolean;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onToggleLayer: (layer: GeoLayer) => void;
    onDeleteLayer: (layer: GeoLayer) => void;
}

/** Painel "Camadas": importação de GeoJSON genérico + lista de camadas. */
export function CamadasGenericasPanel({
    geoLayers, loadingLayers, refetchLayers,
    fileInputRef, uploading, onFileUpload, onToggleLayer, onDeleteLayer,
}: CamadasGenericasPanelProps) {
    const [deleteTarget, setDeleteTarget] = useState<GeoLayer | null>(null);
    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Camadas</span>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={refetchLayers} disabled={loadingLayers}>
                    <RefreshCw className={`h-3 w-3 ${loadingLayers ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Button size="sm" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {uploading ? 'Carregando...' : 'Importar GeoJSON'}
            </Button>
            <input ref={fileInputRef} type="file" accept=".geojson,.json" className="hidden" onChange={onFileUpload} />

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {geoLayers.length === 0 && !loadingLayers && (
                    <p className="text-xs text-muted-foreground py-1">Nenhuma camada importada.</p>
                )}
                {geoLayers.map(layer => (
                    <div key={layer.id} className="border rounded-md p-2 space-y-1 bg-card">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10" style={{ backgroundColor: layer.cor }} />
                                <span className="text-xs font-medium truncate">{layer.nome}</span>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onToggleLayer(layer)}>
                                    {layer.visivel ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(layer)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        {layer.categoria && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {CATEGORIA_LABELS[layer.categoria] ?? layer.categoria}
                            </Badge>
                        )}
                    </div>
                ))}
            </div>

            <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover camada</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remover a camada &quot;{deleteTarget?.nome}&quot;? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (deleteTarget) onDeleteLayer(deleteTarget); setDeleteTarget(null); }}
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}
