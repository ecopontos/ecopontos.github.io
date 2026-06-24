"use client";

import { Card, CardContent } from '@/components/ui/card';

interface VisualSummaryViewProps {
  data: unknown[];
  config: Record<string, unknown>;
}

export function VisualSummaryView({ data, config }: VisualSummaryViewProps) {
  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Nenhum indicador disponível
      </div>
    );
  }

  const kpiConfig = (config.kpi_config as Array<{
    label: string; query?: string; format?: string; color?: string;
  }>) ?? [];

  if (kpiConfig.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiConfig.map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: kpi.color ?? 'inherit' }}>
                {renderValue(data, kpi)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const rows = data as Record<string, unknown>[];
  const keys: string[] = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {keys.slice(0, 8).map(key => (
        <Card key={key}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {formatValue(rows[0]?.[key])}
            </p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{key}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function renderValue(data: unknown[], kpi: { label: string; query?: string; format?: string; color?: string }) {
  if (kpi.query && typeof kpi.query === 'string' && kpi.query.startsWith('json:')) {
    try {
      const path = kpi.query.slice(5);
      const first: Record<string, unknown> = data.length > 0 ? data[0] as Record<string, unknown> : {};
      const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], first);
      return formatValue(value, kpi.format);
    } catch {
      return '—';
    }
  }
  return String(data.length ?? '—');
}

function formatValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  switch (format) {
    case 'currency': return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    case 'percentage': return `${num.toFixed(1)}%`;
    case 'date': return new Date(num).toLocaleDateString('pt-BR');
    default: return num.toLocaleString('pt-BR');
  }
}
