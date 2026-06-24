"use client";

import { Plus, Star, Copy, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface ViewItem {
  id: string;
  name: string;
  is_default: boolean;
  user_id: string | null;
  sync_status: string;
}

interface ViewListEditorProps {
  views: ViewItem[];
  visualType: string;
  onAdd: () => void;
  onEdit: (viewId: string) => void;
  onDelete: (viewId: string) => void;
  onSetDefault: (viewId: string) => void;
  onCopyToPersonal?: (viewId: string) => void;
}

export function ViewListEditor({
  views, visualType, onAdd, onEdit, onDelete, onSetDefault, onCopyToPersonal,
}: ViewListEditorProps) {
  const globalViews = views.filter(v => v.user_id === null);
  const personalViews = views.filter(v => v.user_id !== null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Views salvas ({views.length})</h4>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="h-3 w-3 mr-1" /> Nova View
        </Button>
      </div>

      {views.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhuma view salva para este visual
        </p>
      )}

      {globalViews.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Globais</p>
          {globalViews.map(v => (
            <ViewRow
              key={v.id}
              view={v}
              onEdit={onEdit}
              onDelete={onDelete}
              onSetDefault={onSetDefault}
              onCopyToPersonal={onCopyToPersonal}
            />
          ))}
        </div>
      )}

      {personalViews.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pessoais</p>
          {personalViews.map(v => (
            <ViewRow
              key={v.id}
              view={v}
              onEdit={onEdit}
              onDelete={onDelete}
              onSetDefault={onSetDefault}
              showCopy={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewRow({
  view, onEdit, onDelete, onSetDefault, onCopyToPersonal, showCopy = true,
}: {
  view: ViewItem;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onCopyToPersonal?: (id: string) => void;
  showCopy?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-accent group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate">{view.name}</span>
          {view.is_default && (
            <Badge variant="default" className="text-xs h-5">Padrão</Badge>
          )}
          {view.sync_status === 'outdated' && (
            <Badge variant="outline" className="text-xs h-5 text-amber-600 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-3 w-3 mr-1" /> Desatualizada
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!view.is_default && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => onSetDefault(view.id)}>
                  <Star className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Definir como padrão</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {showCopy && onCopyToPersonal && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => onCopyToPersonal(view.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar para pessoal</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => onEdit(view.id)}>
                <span className="text-xs">Editar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar configuração</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => onDelete(view.id)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir view</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
