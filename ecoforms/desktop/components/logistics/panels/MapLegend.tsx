import { TIPO_CORES, TIPO_LABELS } from '@/lib/map-styles';

interface MapLegendProps {
    clientesVisible: boolean;
    selectedRoteiroId: string | null;
    itinerarioVisible: boolean;
    selectedExecucaoId: string | null;
    execucaoLayerVisible: boolean;
    intercorrenciasLayerVisible: boolean;
    checklistLayerVisible: boolean;
    terrenosVisible: boolean;
    tiposPresentes: string[];
    loadingClientes: boolean;
    clientesCount: number;
    terrenosCount: number;
}

/** Legenda sobreposta ao mapa, com seções condicionais por camada ativa. */
export function MapLegend({
    clientesVisible, selectedRoteiroId, itinerarioVisible,
    selectedExecucaoId, execucaoLayerVisible, intercorrenciasLayerVisible, checklistLayerVisible,
    terrenosVisible, tiposPresentes,
    loadingClientes, clientesCount, terrenosCount,
}: MapLegendProps) {
    return (
        <div className="absolute bottom-8 left-3 z-10 bg-background/90 backdrop-blur-sm border rounded-md p-2.5 text-xs space-y-1.5 max-w-[160px]">
            <p className="font-semibold text-foreground">Legenda</p>

            {clientesVisible && (
                <>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white inline-block flex-shrink-0" />
                        <span>Pessoa Física</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white inline-block flex-shrink-0" />
                        <span>Pessoa Jurídica</span>
                    </div>
                </>
            )}

            {selectedRoteiroId && itinerarioVisible && (
                <div className="flex items-center gap-1.5">
                    <span className="w-6 h-2 rounded-sm bg-orange-500 inline-block flex-shrink-0" />
                    <span>Itinerário</span>
                </div>
            )}

            {selectedExecucaoId && (
                <div className="border-t pt-1 mt-0.5">
                    <p className="text-muted-foreground text-[10px] mb-1">Execução</p>
                    {execucaoLayerVisible && (
                        <>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white inline-block flex-shrink-0" />
                                <span>Coletado</span>
                            </div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white inline-block flex-shrink-0" />
                                <span>Não coletado</span>
                            </div>
                        </>
                    )}
                    {intercorrenciasLayerVisible && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="w-3 h-3 rounded-full bg-amber-500 border-2 border-amber-300 inline-block flex-shrink-0" />
                            <span>Intercorrência</span>
                        </div>
                    )}
                    {checklistLayerVisible && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white inline-block flex-shrink-0" />
                            <span>Checklist</span>
                        </div>
                    )}
                </div>
            )}

            {terrenosVisible && tiposPresentes.length > 0 && (
                <>
                    <div className="border-t pt-1 mt-0.5">
                        <p className="text-muted-foreground text-[10px] mb-1">Terrenos</p>
                        {tiposPresentes.map(tipo => (
                            <div key={tipo} className="flex items-center gap-1.5 mb-0.5">
                                <span
                                    className="w-3 h-3 rounded-sm inline-block flex-shrink-0 border border-black/10"
                                    style={{ backgroundColor: TIPO_CORES[tipo] ?? TIPO_CORES.outro }}
                                />
                                <span>{TIPO_LABELS[tipo] ?? tipo}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <p className="text-muted-foreground pt-0.5 border-t">
                {loadingClientes ? 'Carregando...' : `${clientesCount} ponto(s)`}
                {terrenosCount > 0 && ` · ${terrenosCount} terreno(s)`}
            </p>
        </div>
    );
}
