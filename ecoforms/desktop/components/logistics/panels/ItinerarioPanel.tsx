import { Button } from '@/components/ui/button';
import { ChevronDown, Route, Eye, EyeOff } from 'lucide-react';
import type { Roteiro } from '@/src/domain/logistics/LogisticsRepository';
import type { ItinerarioStop } from '@/src/interface/hooks/queries/useMapData';

interface ItinerarioPanelProps {
    roteiros: Roteiro[];
    selectedRoteiroId: string | null;
    onSelectRoteiro: (id: string) => void;
    itinerarioVisible: boolean;
    onToggleVisible: () => void;
    itinerario: ItinerarioStop[];
}

/** Painel "Itinerário": seleção de roteiro ativo + lista de paradas. */
export function ItinerarioPanel({
    roteiros, selectedRoteiroId, onSelectRoteiro,
    itinerarioVisible, onToggleVisible, itinerario,
}: ItinerarioPanelProps) {
    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Itinerário</span>
                </div>
                {selectedRoteiroId && (
                    <Button
                        size="icon" variant="ghost" className="h-6 w-6"
                        title={itinerarioVisible ? 'Ocultar rota' : 'Mostrar rota'}
                        onClick={onToggleVisible}
                    >
                        {itinerarioVisible
                            ? <Eye className="h-3.5 w-3.5" />
                            : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                )}
            </div>
            <div className="relative">
                <select
                    className="w-full text-xs border rounded-md px-2 py-1.5 pr-7 bg-background appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                    value={selectedRoteiroId ?? ''}
                    onChange={e => onSelectRoteiro(e.target.value)}
                >
                    <option value="">— Selecionar roteiro —</option>
                    {roteiros.filter(r => r.situacao === 'ativo').map(r => (
                        <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>
            {itinerario.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                    {itinerario.map(s => (
                        <div key={s.cliente_id} className="flex items-start gap-1.5 text-xs">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-[10px]">
                                {s.ordem}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate font-medium">{s.nome}</p>
                                {s.terreno_nome && <p className="truncate text-muted-foreground">{s.terreno_nome}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
