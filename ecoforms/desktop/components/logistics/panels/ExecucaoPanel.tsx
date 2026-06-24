import { Button } from '@/components/ui/button';
import { ChevronDown, PlayCircle, Eye, EyeOff, AlertTriangle, Camera } from 'lucide-react';
import type { ExecucaoColeta } from '@/src/domain/logistics/LogisticsRepository';

interface ExecucaoPanelProps {
    execucoes: ExecucaoColeta[];
    selectedExecucaoId: string | null;
    onSelectExecucao: (id: string) => void;
    execucaoLayerVisible: boolean;
    onToggleExecucaoLayer: () => void;
    intercorrenciasLayerVisible: boolean;
    onToggleIntercorrenciasLayer: () => void;
    checklistLayerVisible: boolean;
    onToggleChecklistLayer: () => void;
}

/** Painel "Execução" (ADR-039): seleção de execução + toggles de camadas. */
export function ExecucaoPanel({
    execucoes, selectedExecucaoId, onSelectExecucao,
    execucaoLayerVisible, onToggleExecucaoLayer,
    intercorrenciasLayerVisible, onToggleIntercorrenciasLayer,
    checklistLayerVisible, onToggleChecklistLayer,
}: ExecucaoPanelProps) {
    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Execução</span>
            </div>
            <div className="relative">
                <select
                    className="w-full text-xs border rounded-md px-2 py-1.5 pr-7 bg-background appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                    value={selectedExecucaoId ?? ''}
                    onChange={e => onSelectExecucao(e.target.value)}
                >
                    <option value="">— Selecionar execução —</option>
                    {execucoes.map(ex => (
                        <option key={ex.id} value={ex.id}>
                            {ex.dataExecucao
                                ? new Date(ex.dataExecucao).toLocaleDateString('pt-BR')
                                : ex.id.slice(0, 8)}
                            {' '}— {ex.status}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>
            {selectedExecucaoId && (
                <div className="flex items-center gap-1 flex-wrap">
                    <Button
                        size="sm" variant={execucaoLayerVisible ? 'secondary' : 'ghost'}
                        className="h-6 text-[10px] px-2 gap-1"
                        onClick={onToggleExecucaoLayer}
                        title="Coletas realizadas"
                    >
                        {execucaoLayerVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        Coletas
                    </Button>
                    <Button
                        size="sm" variant={intercorrenciasLayerVisible ? 'secondary' : 'ghost'}
                        className="h-6 text-[10px] px-2 gap-1"
                        onClick={onToggleIntercorrenciasLayer}
                        title="Intercorrências"
                    >
                        {intercorrenciasLayerVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        <AlertTriangle className="h-3 w-3" />
                    </Button>
                    <Button
                        size="sm" variant={checklistLayerVisible ? 'secondary' : 'ghost'}
                        className="h-6 text-[10px] px-2 gap-1"
                        onClick={onToggleChecklistLayer}
                        title="Checklist/Evidências"
                    >
                        {checklistLayerVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        <Camera className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </section>
    );
}
