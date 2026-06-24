"use client";

import type { ModuleVisualView } from '@/src/domain/visual/ModuleVisualView';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle } from 'lucide-react';

interface ViewSelectorProps {
  views: ModuleVisualView[];
  onSelect?: (viewId: string) => void;
  currentViewId?: string;
}

export function ViewSelector({ views, onSelect, currentViewId }: ViewSelectorProps) {
  if (views.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Tabs
        value={currentViewId ?? views[0]?.id ?? ''}
        onValueChange={(val) => onSelect?.(val)}
      >
        <TabsList>
          {views.map(v => (
            <TabsTrigger key={v.id} value={v.id} className="relative gap-1">
              {v.name}
              {v.sync_status === 'outdated' && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {views.some(v => v.sync_status === 'outdated') && (
        <div className="flex items-center gap-1 text-xs text-amber-600">
          <AlertTriangle className="h-3 w-3" />
          View desatualizada
        </div>
      )}
    </div>
  );
}
