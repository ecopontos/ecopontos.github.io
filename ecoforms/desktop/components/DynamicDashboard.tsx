"use client";

import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { KpiCard } from "@/components/widgets/KpiCard";
import { SimpleBarChart } from "@/components/widgets/SimpleBarChart";
import { RecentActivityList } from "@/components/widgets/RecentActivityList";
import type { WidgetConfig } from "@/src/application/widgets/WidgetRegistry";
import { useContainer } from "@/src/interface/hooks/catalog/utils";

interface DynamicDashboardProps {
  widgets: WidgetConfig[];
  editMode?: boolean;
  onRemove?: (instanceId: string) => void;
}

export function DynamicDashboard({ widgets, editMode, onRemove }: DynamicDashboardProps) {
  if (!widgets || widgets.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {widgets.map((widget) => (
        <div key={widget.id} className="relative group">
          {editMode && (widget as WidgetConfig & { instanceId?: string }).instanceId && (
            <button
              onClick={() => onRemove?.((widget as WidgetConfig & { instanceId?: string }).instanceId!)}
              className="absolute top-2 right-2 z-10 rounded-full bg-destructive text-destructive-foreground w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              title="Remover widget"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <WidgetRenderer widget={widget} />
        </div>
      ))}
    </div>
  );
}

function WidgetRenderer({ widget }: { widget: WidgetConfig }) {
  const container = useContainer();
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const group = (container as unknown as Record<string, unknown>)[widget.dataSource.useCaseGroup];
      if (!group || typeof group !== "object") {
        throw new Error(`Use case group "${widget.dataSource.useCaseGroup}" não encontrado`);
      }
      const uc = (group as Record<string, unknown>)[widget.dataSource.method];
      const execType = uc ? typeof (uc as Record<string, unknown>).execute : 'undefined';
      if (!uc || typeof uc !== "object" || execType !== "function") {
        const keys = Object.keys(group as Record<string, unknown>).join(', ');
        throw new Error(`Método "${widget.dataSource.method}" não encontrado em ${widget.dataSource.useCaseGroup} (typeof=${typeof uc}, execType=${execType}, keys=[${keys}])`);
      }
      const result = await (uc as Record<string, (...args: unknown[]) => unknown>).execute(
        widget.dataSource.params || {}
      );
      setData(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (widget.refreshInterval && widget.refreshInterval > 0) {
      const interval = setInterval(fetchData, widget.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [widget.id]);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center border rounded-lg bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-40 flex items-center justify-center border rounded-lg bg-card text-destructive text-sm">
        Erro: {error}
      </div>
    );
  }

  switch (widget.type) {
    case "kpi_card":
      return <KpiCardWidget widget={widget} data={data} />;
    case "bar_chart":
      return <BarChartWidget widget={widget} data={data} />;
    case "recent_activity":
      return <RecentActivityWidget widget={widget} data={data} />;
    case "table":
      return <TableWidget widget={widget} data={data} />;
    default:
      return (
        <div className="h-40 flex items-center justify-center border rounded-lg bg-card text-muted-foreground text-sm">
          Widget tipo &quot;{widget.type}&quot; não implementado
        </div>
      );
  }
}

function KpiCardWidget({ widget, data }: { widget: WidgetConfig; data: unknown }) {
  const opts = widget.options || {};
  const value = extractValue(data, opts.valuePath as string) ?? "—";
  const subtitle = extractValue(data, opts.subtitlePath as string) as string | undefined;

  return (
    <KpiCard
      title={widget.title}
      value={String(value)}
      subtitle={subtitle}
      trend={opts.trend as "up" | "down" | "neutral"}
      trendValue={opts.trendValue as string}
    />
  );
}

function BarChartWidget({ widget, data }: { widget: WidgetConfig; data: unknown }) {
  const opts = widget.options || {};
  const items = Array.isArray(data) ? data : [];
  const labelKey = (opts.labelKey as string) || "label";
  const valueKey = (opts.valueKey as string) || "value";

  const chartData = items.map((item: Record<string, unknown>) => ({
    label: String(item[labelKey] ?? "—"),
    value: Number(item[valueKey] ?? 0),
    color: (item.color as string) || undefined,
  }));

  return <SimpleBarChart title={widget.title} data={chartData} />;
}

function RecentActivityWidget({ widget, data }: { widget: WidgetConfig; data: unknown }) {
  const items = Array.isArray(data) ? data : [];
  return <RecentActivityList title={widget.title} items={items} />;
}

function TableWidget({ widget, data }: { widget: WidgetConfig; data: unknown }) {
  const items = Array.isArray(data) ? data : [];
  const columns = (widget.options?.columns as string[]) || Object.keys(items[0] || {});

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b text-sm font-medium">{widget.title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum dado
                </td>
              </tr>
            ) : (
              items.slice(0, 5).map((row: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-t">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 truncate max-w-[200px]">
                      {String(row[col] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function extractValue(data: unknown, path?: string): unknown {
  if (!path || !data) return data;
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object" && acc !== null) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}
