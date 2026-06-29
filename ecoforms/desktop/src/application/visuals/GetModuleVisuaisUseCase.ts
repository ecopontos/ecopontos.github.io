import type { SqlitePort } from '../ports/SqlitePort';
import type { ModuleVisualViewRepository } from '../../domain/visual/ModuleVisualViewRepository';
import type { ModuleVisualView } from '../../domain/visual/ModuleVisualView';
import { resolveBind, type ViewContext } from './resolveBind';
import { VisualQueryCache } from './VisualQueryCache';
import { DASHBOARD_WIDGETS, MODULO_POR_SLUG } from '../persistence/sqlite/queries/modules';

export interface JoinDescriptor {
    table: string;
    localKey: string;
    foreignKey: string;
    select: string[];
    alias?: string;
}

export interface ViewConfig {
    filters?: Array<{ field: string; op: string; value: string | number | null }>;
    columns?: string[];
    joins?: JoinDescriptor[];
    group_by?: string;
    sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    chart_type?: string;
    category_field?: string;
    value_field?: string;
    aggregation?: string;
    cache_ttl?: number;
    [key: string]: unknown;
}

export interface VisualDto {
    id: string;
    visual_type: string;
    name: string;
    config: ViewConfig;
    is_default: boolean;
    user_id: string | null;
    views: ModuleVisualView[];
    data?: unknown[];
}

export interface ModuleVisuaisDto {
    module_id: string;
    slug: string;
    entity_type: string;
    visuais: VisualDto[];
}

export class GetModuleVisuaisUseCase {
    constructor(
        private readonly db: SqlitePort,
        private readonly visualRepo: ModuleVisualViewRepository,
        private readonly cache: VisualQueryCache,
    ) {}

    async execute(
        slug: string,
        userId: string,
        userProfile: string,
        userSector?: string,
        dashboardId?: string,
    ): Promise<ModuleVisuaisDto | null> {
        const modRows = await this.db.query<Record<string, unknown>>(
            MODULO_POR_SLUG.sql,
            [slug],
        );
        if (!modRows[0]) return null;

        const entityType = modRows[0].tipo_entidade as string;
        const moduleId = modRows[0].id as string;
        const moduleConfig = typeof modRows[0].configuracao === 'string' ? JSON.parse(modRows[0].configuracao as string) : modRows[0].configuracao;

        const visualConfigs: Array<{ type: string; title: string; position: Record<string, unknown>; permissions: Record<string, string[]> }> =
            moduleConfig.visuais ?? [];

        // Filtro por dashboard_id: seleciona apenas visuais referenciados pelo dashboard
        let filteredConfigs = visualConfigs;
        if (dashboardId) {
            const dashRows = await this.db.query<Record<string, unknown>>(
                DASHBOARD_WIDGETS.sql, [dashboardId],
            );
            if (dashRows[0]) {
                const widgets = typeof dashRows[0].widgets === 'string'
                    ? JSON.parse(dashRows[0].widgets as string)
                    : (dashRows[0].widgets as unknown[] ?? []);
                const refTypes = new Set(
                    (widgets as Array<Record<string, unknown>>)
                        .filter(w => w.source === 'module_visual')
                        .map(w => (w.visual_type as string ?? w.visualId as string ?? ''))
                        .filter(Boolean)
                );
                if (refTypes.size > 0) {
                    filteredConfigs = visualConfigs.filter(vc => refTypes.has(vc.type));
                }
            }
        }

        const ctx: ViewContext = {
            userId,
            userProfile,
            userSector: userSector ?? null,
        };

        const visuais: VisualDto[] = [];

        for (const vc of filteredConfigs) {
            const perms = vc.permissions?.can_view ?? [];
            if (perms.length > 0 && !perms.includes(userProfile)) continue;

            const views = await this.visualRepo.findByModuleIdAndType(moduleId, vc.type);
            const defaultView = views.find(v => v.is_default) ?? views[0];

            let data: unknown[] | undefined;
            if (defaultView) {
                const config = this.parseConfig(defaultView.config);
                data = await this.fetchData(entityType, config, ctx);
            }

            visuais.push({
                id: `visual-${vc.type}`,
                visual_type: vc.type,
                name: vc.title,
                config: { columns: [], filters: [] },
                is_default: true,
                user_id: null,
                views,
                data,
            });
        }

        return {
            module_id: moduleId,
            slug,
            entity_type: entityType,
            visuais,
        };
    }

    private async fetchData(entityType: string, config: ViewConfig, ctx: ViewContext): Promise<unknown[]> {
        const filters = config.filters ?? [];
        const conditions = filters.map(f => `${f.field} ${f.op} ?`);
        const bindValues = filters.map(f => resolveBind(f.value as string, ctx));

        let joinClause = '';
        if (config.joins && config.joins.length > 0) {
            for (const join of config.joins) {
                const alias = join.alias ?? join.table;
                joinClause += ` LEFT JOIN ${join.table} ${alias} ON json_extract(registro_dados.conteudo, '$.${join.localKey}') = ${alias}.${join.foreignKey}`;
            }
        }

        const columns = config.columns?.length
            ? [...config.columns, ...(config.joins?.flatMap(j => j.select.map(s => `${j.alias ?? j.table}.${s}`) ?? []) ?? [])].join(', ')
            : '*';

        let sql: string;
        let params: unknown[];

        if (config.aggregation && config.category_field) {
            sql = `SELECT ${config.category_field}, ${config.aggregation}(${config.value_field ?? '1'}) as valor
                   FROM registro_dados${joinClause} WHERE registro_dados.tipo = ? ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
                   GROUP BY ${config.category_field}`;
            params = [entityType, ...bindValues];
        } else {
            sql = `SELECT ${columns} FROM registro_dados${joinClause} WHERE registro_dados.tipo = ? ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}`;
            params = [entityType, ...bindValues];
        }

        const cached = this.cache.get(sql, params);
        if (cached) return cached;

        const data = await this.db.all(sql, params);
        this.cache.set(sql, params, data, config.cache_ttl);
        return data;
    }

    private parseConfig(configJson: string): ViewConfig {
        try {
            return JSON.parse(configJson) as ViewConfig;
        } catch {
            return {};
        }
    }
}
