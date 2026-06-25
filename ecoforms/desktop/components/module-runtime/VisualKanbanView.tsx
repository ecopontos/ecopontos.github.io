"use client";

import { Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface VisualKanbanViewProps {
  data: unknown[];
}

const COLUMNS = [
  { id: 'a_fazer', label: 'A Fazer', color: 'bg-slate-100 border-slate-200' },
  { id: 'em_progesso', label: 'Em Progesso', color: 'bg-blue-50 border-blue-200' },
  { id: 'concluido', label: 'Concluído', color: 'bg-green-50 border-green-200' },
];

export function VisualKanbanView({ data }: VisualKanbanViewProps) {
  const items = data as Record<string, unknown>[];

  const grouped = COLUMNS.map(col => ({
    ...col,
    items: items.filter(i => String(i.status ?? '').toLowerCase() === col.id),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
          <Eye className="h-3 w-3 mr-1" />
          Modo Visualização
        </Badge>
        <p className="text-xs text-muted-foreground">
          Clique em um card para abrir no Kanban completo
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {grouped.map(col => (
          <div key={col.id} className="flex-1 min-w-[250px]">
            <div className={`rounded-lg border-2 ${col.color} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">{col.label}</h4>
                <Badge variant="outline" className="text-xs">{col.items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {col.items.map((item, i) => (
                  <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">
                        {String(item.title ?? item.name ?? item.id ?? '')}
                      </p>
                      {(item.description as string) && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {String(item.description)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {col.items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum item
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
