import type { UserRole } from "@/src/interface/hooks/catalog/auth";
import type { VisibilityRule } from "@/types";

export type WidgetType =
  | "kpi_card"
  | "bar_chart"
  | "pie_chart"
  | "line_chart"
  | "area_chart"
  | "table"
  | "recent_activity";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: {
    useCaseGroup: string;
    method: string;
    params?: Record<string, unknown>;
  };
  refreshInterval?: number; // segundos
  options?: Record<string, unknown>;
  visibility?: VisibilityRule[];
  requiredRoles?: UserRole[];
}

const widgetRegistry = new Map<string, WidgetConfig>();

export function registerWidget(config: WidgetConfig) {
  if (widgetRegistry.has(config.id)) {
    console.warn(`Widget "${config.id}" já registrado — sobrescrevendo.`);
  }
  widgetRegistry.set(config.id, config);
}

export function getAvailableWidgets(userRole: UserRole): WidgetConfig[] {
  return Array.from(widgetRegistry.values()).filter((w) => {
    if (w.requiredRoles && !w.requiredRoles.includes(userRole)) return false;
    return true;
  });
}

export function getWidgetById(id: string): WidgetConfig | undefined {
  return widgetRegistry.get(id);
}

