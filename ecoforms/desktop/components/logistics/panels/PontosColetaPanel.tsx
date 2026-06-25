import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Users } from 'lucide-react';

interface PontosColetaPanelProps {
    clientesCount: number;
    clientesVisible: boolean;
    onToggleVisible: () => void;
    loadingClientes: boolean;
}

/** Painel "Pontos de Coleta": contador e toggle de visibilidade. */
export function PontosColetaPanel({ clientesCount, clientesVisible, onToggleVisible, loadingClientes }: PontosColetaPanelProps) {
    return (
        <section className="space-y-1">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Pontos de Coleta</span>
                    {clientesCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{clientesCount}</Badge>
                    )}
                </div>
                <Button
                    size="icon" variant="ghost" className="h-6 w-6"
                    title={clientesVisible ? 'Ocultar pontos' : 'Mostrar pontos'}
                    onClick={onToggleVisible}
                >
                    {clientesVisible
                        ? <Eye className="h-3.5 w-3.5" />
                        : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </Button>
            </div>
            {loadingClientes && <p className="text-xs text-muted-foreground">Carregando...</p>}
        </section>
    );
}
