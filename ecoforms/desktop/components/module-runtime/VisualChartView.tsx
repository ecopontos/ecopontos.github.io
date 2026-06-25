"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface VisualChartViewProps {
  data: unknown[];
  config: Record<string, unknown>;
}

export function VisualChartView({ data, config }: VisualChartViewProps) {
  const chartType = (config.chart_type as string) ?? 'bar';
  const categoryField = (config.category_field as string) ?? 'name';
  const valueField = (config.value_field as string) ?? 'valor';

  if (data.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Nenhum dado para exibir no gráfico
      </div>
    );
  }

  const chartData = data as Record<string, unknown>[];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline">{chartType}</Badge>
          <span className="text-xs text-muted-foreground">{categoryField} × {valueField}</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(chartType, chartData, categoryField, valueField)}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function renderChart(
  type: string,
  data: Record<string, unknown>[],
  categoryField: string,
  valueField: string,
) {
  switch (type) {
    case 'pie':
    case 'donut':
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey={valueField}
            nameKey={categoryField}
            cx="50%"
            cy="50%"
            innerRadius={type === 'donut' ? 50 : 0}
            outerRadius={90}
            label={({ name, percent }: { name?: string; percent?: number }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      );

    case 'line':
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={categoryField} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={valueField} stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={categoryField} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey={valueField} fill="#3b82f6" fillOpacity={0.2} stroke="#3b82f6" />
        </AreaChart>
      );

    case 'bar':
    default:
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={categoryField} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey={valueField} fill="#3b82f6" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      );
  }
}
