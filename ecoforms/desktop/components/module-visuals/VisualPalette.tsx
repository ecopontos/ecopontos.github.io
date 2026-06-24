"use client";

import { useDraggable } from "@dnd-kit/core";
import { Table2, BarChart3, Kanban, Clock, Gauge } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const VISUAL_TYPES = [
  { type: 'table', label: 'Tabela', icon: Table2, description: 'Grid com colunas configuráveis, ordenação, filtros, export' },
  { type: 'chart', label: 'Gráfico', icon: BarChart3, description: 'Recharts: pizza, barra, linha, área' },
  { type: 'kanban', label: 'Kanban', icon: Kanban, description: '3 colunas (leitura), link para Kanban completo' },
  { type: 'timeline', label: 'Timeline', icon: Clock, description: 'Linha do tempo horizontal' },
  { type: 'summary', label: 'Resumo', icon: Gauge, description: 'Cards de KPI: contadores, indicadores' },
];

interface VisualPaletteProps {
  existingTypes: string[];
  onAdd: (type: string) => void;
}

export function VisualPalette({ existingTypes, onAdd }: VisualPaletteProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Visuais</h3>
      <p className="text-xs text-muted-foreground">Arraste para adicionar ao módulo</p>
      <div className="space-y-2">
        {VISUAL_TYPES.map(vt => {
          const Icon = vt.icon;
          const isAdded = existingTypes.includes(vt.type);
          return (
            <DraggableVisualCard
              key={vt.type}
              visualType={vt.type}
              label={vt.label}
              icon={Icon}
              description={vt.description}
              isAdded={isAdded}
              onAdd={onAdd}
            />
          );
        })}
      </div>
    </div>
  );
}

function DraggableVisualCard({
  visualType, label, icon: Icon, description, isAdded, onAdd,
}: {
  visualType: string;
  label: string;
  icon: React.ElementType;
  description: string;
  isAdded: boolean;
  onAdd: (type: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${visualType}`,
    data: { type: visualType, source: 'palette' },
    disabled: isAdded,
  });

  const style = {
    opacity: isDragging ? 0.5 : 1,
    cursor: isAdded ? 'default' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => !isAdded && onAdd(visualType)}
    >
      <Card className={`transition-colors ${isAdded ? 'opacity-50 border-dashed' : 'hover:bg-accent'}`}>
        <CardContent className="p-3 flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          </div>
          {isAdded && <span className="text-xs text-muted-foreground ml-auto shrink-0">adicionado</span>}
        </CardContent>
      </Card>
    </div>
  );
}
