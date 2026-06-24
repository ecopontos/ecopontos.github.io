import { z } from 'zod';
import type { VisualType } from '../../domain/visual/ModuleVisualView';

const FilterSchema = z.object({
    field: z.string().min(1),
    op: z.enum(['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL']),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

const ViewConfigSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    filters: z.array(FilterSchema).max(20).optional(),
    columns: z.array(z.string()).optional(),
    group_by: z.string().optional(),
    sort: z.array(z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
    })).max(3).optional(),
    chart_type: z.enum(['pie', 'bar', 'line', 'area', 'donut']).optional(),
    category_field: z.string().optional(),
    value_field: z.string().optional(),
    aggregation: z.enum(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']).optional(),
    status_field: z.string().optional(),
    kpi_config: z.array(z.object({
        label: z.string(),
        query: z.string(),
        format: z.enum(['number', 'currency', 'percentage', 'date']).optional(),
        color: z.string().optional(),
    })).optional(),
    cache_ttl: z.number().min(1000).max(300000).optional(),
});

export function validateViewConfig(config: unknown, visualType: VisualType): Record<string, unknown> {
    const base = ViewConfigSchema.parse(config);

    if (visualType === 'chart' && (!base.chart_type || !base.category_field)) {
        throw new Error('Chart visual requires chart_type and category_field');
    }
    if (visualType === 'kanban' && !base.status_field) {
        throw new Error('Kanban visual requires status_field');
    }
    if (visualType === 'summary' && (!base.kpi_config || base.kpi_config.length === 0)) {
        throw new Error('Summary visual requires at least one KPI config');
    }

    return base as unknown as Record<string, unknown>;
}
