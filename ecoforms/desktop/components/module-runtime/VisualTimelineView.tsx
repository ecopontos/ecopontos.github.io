"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Clock, Circle } from 'lucide-react';

interface VisualTimelineViewProps {
  data: unknown[];
}

export function VisualTimelineView({ data }: VisualTimelineViewProps) {
  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Nenhum evento na timeline
      </div>
    );
  }

  const items = data as Record<string, unknown>[];

  return (
    <div className="relative pl-8 space-y-6">
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
      {items.map((item, i) => (
        <div key={i} className="relative">
          <div className="absolute -left-5 mt-1.5">
            <Circle className="h-3 w-3 fill-primary text-primary" />
          </div>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
                {String(item.criado_em ?? item.date ?? item.data ?? '')}
              </div>
              <p className="text-sm font-medium">
                {String(item.title ?? item.name ?? item.event ?? item.descricao ?? '')}
              </p>
              {!!(item.description ?? item.detalhes) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {String(item.description ?? item.detalhes ?? '')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
