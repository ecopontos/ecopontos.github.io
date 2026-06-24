"use client";

import { useState } from 'react';
import type { ModuleVisualView } from '@/src/domain/visual/ModuleVisualView';
import { VisualTableView } from './VisualTableView';
import { VisualChartView } from './VisualChartView';
import { VisualKanbanView } from './VisualKanbanView';
import { VisualTimelineView } from './VisualTimelineView';
import { VisualSummaryView } from './VisualSummaryView';
import { ViewSelector } from './ViewSelector';
import { ViewSyncAlert } from './ViewSyncAlert';

export interface VisualData {
  id: string;
  visual_type: string;
  name: string;
  config: Record<string, unknown>;
  is_default: boolean;
  user_id: string | null;
  views: ModuleVisualView[];
  data?: unknown[];
}

interface VisualRendererProps {
  visual: VisualData;
  userId?: string;
  onViewChange?: (viewId: string) => void;
}

export function VisualRenderer({ visual, userId, onViewChange }: VisualRendererProps) {
  const [dismissedOutdated, setDismissedOutdated] = useState<string | null>(null);
  const [currentViewId, setCurrentViewId] = useState<string | undefined>(
    visual.views.find(v => v.is_default)?.id ?? visual.views[0]?.id
  );

  const currentView = visual.views.find(v => v.id === currentViewId);
  const outdated = currentView?.sync_status === 'outdated' && dismissedOutdated !== currentView.id && userId;

  const handleViewChange = (viewId: string) => {
    setCurrentViewId(viewId);
    onViewChange?.(viewId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{visual.name}</h3>
        <ViewSelector
          views={visual.views}
          onSelect={handleViewChange}
          currentViewId={currentViewId}
        />
      </div>

      {outdated && currentView?.parent_view_id && (
        <ViewSyncAlert
          globalViewId={currentView.parent_view_id}
          personalViewId={currentView.id}
          userId={userId!}
          onDismiss={() => setDismissedOutdated(currentView.id)}
        />
      )}

      {renderByType(visual)}
    </div>
  );
}

function renderByType(visual: VisualData) {
  switch (visual.visual_type) {
    case 'table':
      return <VisualTableView data={visual.data ?? []} config={visual.config} />;

    case 'chart':
      return <VisualChartView data={visual.data ?? []} config={visual.config} />;

    case 'kanban':
      return <VisualKanbanView data={visual.data ?? []} />;

    case 'timeline':
      return <VisualTimelineView data={visual.data ?? []} />;

    case 'summary':
      return <VisualSummaryView data={visual.data ?? []} config={visual.config} />;

    default:
      return (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Tipo de visual não suportado: {visual.visual_type}
        </div>
      );
  }
}
