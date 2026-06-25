"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TYPE_LABELS: Record<string, string> = {
  table: 'Tabela', chart: 'Gráfico', kanban: 'Kanban', timeline: 'Timeline', summary: 'Resumo',
};

export interface VisualItem {
  id: string;
  type: string;
  title: string;
  position: { w: number; h: number };
  permissions: { can_view: string[] };
  viewConfig?: Record<string, unknown>;
}

interface VisualGridCanvasProps {
  visuals: VisualItem[];
  onRemove: (id: string) => void;
  onConfigure: (visual: VisualItem) => void;
  onToggleVisibility?: (id: string) => void;
}

export function VisualGridCanvas({ visuals, onRemove, onConfigure }: VisualGridCanvasProps) {
  if (visuals.length === 0) {
    return (
      <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-12 text-center">
        <p className="text-muted-foreground">Nenhum visual configurado</p>
        <p className="text-xs text-muted-foreground mt-1">
          Arraste visuais da paleta ao lado para começar
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {visuals.map((visual) => (
        <SortableVisualCard
          key={visual.id}
          visual={visual}
          onRemove={onRemove}
          onConfigure={onConfigure}
        />
      ))}
    </div>
  );
}

function SortableVisualCard({
  visual, onRemove, onConfigure,
}: {
  visual: VisualItem;
  onRemove: (id: string) => void;
  onConfigure: (visual: VisualItem) => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: visual.id, data: { visual } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: `span ${visual.position.w}`,
  };

  const colSpan = visual.position.w;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`${isDragging ? 'shadow-lg' : ''} h-full`}>
        <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-medium truncate">{visual.title}</CardTitle>
            <Badge variant="outline" className="text-xs shrink-0">
              {TYPE_LABELS[visual.type] ?? visual.type}
            </Badge>
            <Badge variant="secondary" className="text-xs shrink-0">
              {colSpan}/12
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={() => onConfigure(visual)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Configurar views</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={() => onRemove(visual.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remover visual</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="h-20 bg-muted/30 rounded flex items-center justify-center">
            <p className="text-xs text-muted-foreground">{TYPE_LABELS[visual.type] ?? visual.type} — {colSpan} colunas</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
