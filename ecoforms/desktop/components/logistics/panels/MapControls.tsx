import { Button } from '@/components/ui/button';
import { Satellite, Map, Maximize2 } from 'lucide-react';

interface MapControlsProps {
    isSatellite: boolean;
    onToggleSatellite: () => void;
    onFitAll: () => void;
}

/** Controles sobrepostos ao mapa: fit-all e troca satélite/OSM. */
export function MapControls({ isSatellite, onToggleSatellite, onFitAll }: MapControlsProps) {
    return (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            <Button
                size="sm" variant="secondary"
                onClick={onFitAll}
                title="Centralizar todos os pontos visíveis"
            >
                <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="secondary" onClick={onToggleSatellite}>
                {isSatellite
                    ? <><Map className="h-3.5 w-3.5 mr-1.5" />Mapa</>
                    : <><Satellite className="h-3.5 w-3.5 mr-1.5" />Satélite</>}
            </Button>
        </div>
    );
}
