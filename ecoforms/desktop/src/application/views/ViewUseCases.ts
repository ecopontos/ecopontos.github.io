import type { ViewRegistryRepository } from '@/src/domain/view/ViewRegistryRepository';
import type { ViewRegistry } from '@/src/domain/view/ViewRegistry';
import { ViewRegistry as ViewRegistryEntity } from '../../domain/view/ViewRegistry';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';
import { MODULO_TIPO_ENTIDADE_PUBLICADO } from '../../infrastructure/persistence/sqlite/queries/modules';
import { uuidv7 } from 'ecoforms-core';

export interface ModuleDashboardWidget {
    id: string;
    type: string;
    title: string;
    source: 'module_visual';
    visualType: string;
    config: Record<string, unknown>;
    position: { x: number; y: number; w: number; h: number };
}

export interface ModuleDashboardVisualDto {
    id: string;
    visual_type: string;
    name: string;
    config: Record<string, unknown>;
    is_default: boolean;
    user_id: string | null;
    views: [];
    data: unknown[];
}

const EDIT_PROFILES = new Set(['admin', 'gerente']);

export function canEditModuleDashboard(perfil: string | null | undefined): boolean {
    return EDIT_PROFILES.has(String(perfil ?? '').toLowerCase());
}

function assertCanEdit(perfil: string): void {
    if (!canEditModuleDashboard(perfil)) {
        throw new Error('Perfil sem permissão para editar dashboards do módulo');
    }
}

function normalizeWidget(input: Partial<ModuleDashboardWidget>): ModuleDashboardWidget {
    const visualType = input.visualType ?? input.type ?? 'table';
    return {
        id: input.id ?? uuidv7(),
        type: input.type ?? visualType,
        title: input.title ?? 'Novo widget',
        source: 'module_visual',
        visualType,
        config: input.config ?? { columns: [], filters: [] },
        position: input.position ?? { x: 0, y: 0, w: 12, h: 1 },
    };
}

function safeIdent(value: unknown): string {
    const ident = String(value ?? '');
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(ident)) {
        throw new Error(`Identificador inválido: ${ident}`);
    }
    return ident;
}

function mapVisualType(type: string): string {
    if (type === 'kpi_card') return 'summary';
    if (['table', 'chart', 'kanban', 'timeline', 'summary'].includes(type)) return type;
    return 'table';
}

export class GetViewUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(id: string): Promise<ViewRegistry | null> {
        return this.repo.findById(id);
    }
}

export class GetActiveViewsUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(): Promise<ViewRegistry[]> {
        return this.repo.findActive();
    }
}

export class GetViewsByModuleUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(moduleType: string): Promise<ViewRegistry[]> {
        return this.repo.findByModuleType(moduleType);
    }
}

export class GetViewsByPerfilUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(perfil: string): Promise<ViewRegistry[]> {
        return this.repo.findByPerfil(perfil);
    }
}

export class CreateModuleDashboardUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(params: { moduleType: string; title: string; perfil: string; widgets?: Partial<ModuleDashboardWidget>[] }): Promise<ViewRegistry> {
        assertCanEdit(params.perfil);
        const dashboard = ViewRegistryEntity.fromProps({
            id: uuidv7(),
            titulo: params.title.trim() || 'Dashboard do módulo',
            perfis: ['admin', 'gerente', 'operador', 'campo'],
            layout: 'grid-2',
            widgets: (params.widgets ?? []).map(normalizeWidget),
            moduleType: params.moduleType,
            userId: null,
            isTemplate: true,
            ativo: true,
            criadoEm: new Date().toISOString(),
        });
        await this.repo.save(dashboard);
        return dashboard;
    }
}

export class UpdateModuleDashboardUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(params: { id: string; perfil: string; title?: string; widgets?: Partial<ModuleDashboardWidget>[] }): Promise<ViewRegistry> {
        assertCanEdit(params.perfil);
        const existing = await this.repo.findById(params.id);
        if (!existing) throw new Error('Dashboard não encontrado');
        const updated = ViewRegistryEntity.fromProps({
            id: existing.id,
            titulo: params.title ?? existing.titulo,
            perfis: existing.perfis,
            layout: existing.layout,
            widgets: params.widgets ? params.widgets.map(normalizeWidget) : existing.widgets,
            moduleType: existing.moduleType,
            userId: existing.userId ?? null,
            isTemplate: existing.isTemplate,
            ativo: existing.ativo,
        });
        await this.repo.save(updated);
        return updated;
    }
}

export class DeleteModuleDashboardUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(id: string, perfil: string): Promise<void> {
        assertCanEdit(perfil);
        const existing = await this.repo.findById(id);
        if (!existing) return;
        await this.repo.save(ViewRegistryEntity.fromProps({
            id: existing.id,
            titulo: existing.titulo,
            perfis: existing.perfis,
            layout: existing.layout,
            widgets: existing.widgets,
            moduleType: existing.moduleType,
            userId: existing.userId ?? null,
            isTemplate: existing.isTemplate,
            ativo: false,
        }));
    }
}

export class UpdateModuleDashboardWidgetsUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(params: { id: string; perfil: string; widgets: Partial<ModuleDashboardWidget>[] }): Promise<ViewRegistry> {
        return new UpdateModuleDashboardUseCase(this.repo).execute({
            id: params.id,
            perfil: params.perfil,
            widgets: params.widgets,
        });
    }
}

export class GetModuleDashboardDataUseCase {
    constructor(private readonly db: SqlitePort, private readonly repo: ViewRegistryRepository) {}

    async execute(params: { slug: string; dashboardId: string; userId: string; userProfile: string }): Promise<ModuleDashboardVisualDto[]> {
        const modRows = await this.db.query<Record<string, unknown>>(
            MODULO_TIPO_ENTIDADE_PUBLICADO.sql,
            [params.slug],
        );
        const entityType = modRows[0]?.tipo_entidade as string | undefined;
        if (!entityType) return [];

        const dashboard = await this.repo.findById(params.dashboardId);
        if (!dashboard || dashboard.moduleType !== entityType) return [];

        const widgets = (dashboard.widgets as Partial<ModuleDashboardWidget>[]).map(normalizeWidget);
        const visuals: ModuleDashboardVisualDto[] = [];
        for (const widget of widgets) {
            if (widget.source !== 'module_visual') continue;
            const data = await this.fetchData(entityType, widget.config);
            visuals.push({
                id: widget.id,
                visual_type: mapVisualType(widget.visualType),
                name: widget.title,
                config: widget.config,
                is_default: true,
                user_id: null,
                views: [],
                data,
            });
        }
        return visuals;
    }

    private async fetchData(entityType: string, config: Record<string, unknown>): Promise<unknown[]> {
        const filters = Array.isArray(config.filters) ? config.filters as Array<Record<string, unknown>> : [];
        const conditions: string[] = [];
        const params: unknown[] = [entityType];

        for (const filter of filters) {
            const field = safeIdent(filter.field);
            const op = String(filter.op ?? '=').toUpperCase();
            if (!['=', '!=', '<>', '>', '>=', '<', '<=', 'LIKE'].includes(op)) {
                throw new Error(`Operador inválido: ${op}`);
            }
            conditions.push(`json_extract(conteudo, '$.${field}') ${op} ?`);
            params.push(filter.value ?? null);
        }

        let sql: string;
        if (config.aggregation && config.category_field) {
            const category = safeIdent(config.category_field);
            const aggregation = String(config.aggregation).toUpperCase();
            if (!['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(aggregation)) {
                throw new Error(`Agregação inválida: ${aggregation}`);
            }
            const valueExpr = aggregation === 'COUNT'
                ? '*'
                : `json_extract(conteudo, '$.${safeIdent(config.value_field ?? 'id')}')`;
            sql = `SELECT json_extract(conteudo, '$.${category}') as ${category}, ${aggregation}(${valueExpr}) as valor
                   FROM registro_dados
                   WHERE tipo = ? ${conditions.length ? `AND ${conditions.join(' AND ')}` : ''}
                   GROUP BY json_extract(conteudo, '$.${category}')`;
        } else {
            sql = `SELECT conteudo FROM registro_dados
                   WHERE tipo = ? ${conditions.length ? `AND ${conditions.join(' AND ')}` : ''}
                   ORDER BY criado_em DESC
                   LIMIT 100`;
        }

        const rows = await this.db.all(sql, params) as Array<Record<string, unknown>>;
        if (config.aggregation && config.category_field) return rows;
        return rows.map((row) => {
            if (typeof row.conteudo !== 'string') return row;
            try {
                return JSON.parse(row.conteudo);
            } catch {
                return row;
            }
        });
    }
}
