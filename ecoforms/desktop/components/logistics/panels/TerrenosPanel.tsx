import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Eye, EyeOff, RefreshCw, Trash2, Filter } from 'lucide-react';
import { TIPO_CORES } from '@/lib/map-styles';
import type { TerrenoGeo } from '@/src/interface/hooks/catalog/logistica';
import TerrenoImport from '../TerrenoImport';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TerrenosPanelProps {
    terrenos: TerrenoGeo[];
    terrenosVisible: boolean;
    onToggleVisible: () => void;
    loadingTerrenos: boolean;
    refetchTerrenos: () => Promise<void> | void;
    onDeleteTerreno: (t: TerrenoGeo) => void;
}

const TIPOS = ['todos', 'residencial', 'comercial', 'industrial', 'publico', 'rural', 'outro'] as const;

/** Painel "Terrenos": importação, contador, visibilidade e lista. */
export function TerrenosPanel({
    terrenos, terrenosVisible, onToggleVisible,
    loadingTerrenos, refetchTerrenos, onDeleteTerreno,
}: TerrenosPanelProps) {
    const [filtroTipo, setFiltroTipo] = useState<string>('todos');
    const [deleteTarget, setDeleteTarget] = useState<TerrenoGeo | null>(null);

    const terrenosFiltrados = useMemo(() => {
        if (filtroTipo === 'todos') return terrenos;
        return terrenos.filter(t => t.tipo === filtroTipo);
    }, [terrenos, filtroTipo]);

    const tiposPresentes = useMemo(() => {
        const tipos = new Set(terrenos.map(t => t.tipo));
        return TIPOS.filter(t => t === 'todos' || tipos.has(t));
    }, [terrenos]);

    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Terrenos</span>
                    {terrenos.length > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0">{terrenos.length}</Badge>}
                </div>
                <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-6 w-6" title={terrenosVisible ? 'Ocultar' : 'Mostrar'} onClick={onToggleVisible}>
                        {terrenosVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={refetchTerrenos} disabled={loadingTerrenos}>
                        <RefreshCw className={`h-3 w-3 ${loadingTerrenos ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <TerrenoImport onImported={refetchTerrenos} />

            {terrenos.length > 0 && (
                <div className="flex items-center gap-1">
                    <Filter className="h-3 w-3 text-muted-foreground" />
                    <select
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}
                        className="text-xs bg-transparent border rounded px-1 py-0.5 text-muted-foreground"
                    >
                        {tiposPresentes.map(t => (
                            <option key={t} value={t}>{t === 'todos' ? 'Todos' : t}</option>
                        ))}
                    </select>
                    {filtroTipo !== 'todos' && (
                        <span className="text-[10px] text-muted-foreground">
                            {terrenosFiltrados.length}/{terrenos.length}
                        </span>
                    )}
                </div>
            )}

            <div className="space-y-1 max-h-36 overflow-y-auto">
                {terrenosFiltrados.slice(0, 20).map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-1 text-xs py-0.5">
                        <div className="flex items-center gap-1 min-w-0">
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: TIPO_CORES[t.tipo] ?? TIPO_CORES.outro }} />
                            <Link href={`/logistica/terreno/${t.id}`} className="truncate hover:underline" title="Ver detalhes / pontos operacionais">
                                {t.nome}
                            </Link>
                        </div>
                        <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(t)}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
                {terrenosFiltrados.length > 20 && <p className="text-xs text-muted-foreground">... e mais {terrenosFiltrados.length - 20}</p>}
                {terrenosFiltrados.length === 0 && !loadingTerrenos && (
                    <p className="text-xs text-muted-foreground py-1">
                        {filtroTipo !== 'todos' ? 'Nenhum terreno deste tipo.' : 'Nenhum terreno cadastrado.'}
                    </p>
                )}
            </div>

            <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover terreno</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remover o terreno &quot;{deleteTarget?.nome}&quot;? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (deleteTarget) onDeleteTerreno(deleteTarget); setDeleteTarget(null); }}
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}
