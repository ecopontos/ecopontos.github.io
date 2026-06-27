import type { ModuleRepository } from '../../../domain/module/ModuleRepository';
import type { ModuleRegistry, ModuleRuntimeDto, ModulePermissionConfig, ModuleConfig, ModuleStatus } from '../../../domain/module/ModuleRegistry';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import {
  DECISOES_MODULO_POR_IDS,
  FORMULARIOS_MODULO_POR_IDS,
  ITENS_CATALOGOS_MODULO_POR_TIPOS,
  MODULO_POR_ID,
  MODULO_POR_TIPO_ENTIDADE,
  MODULO_REGISTRY_POR_SLUG,
  MODULOS_POR_STATUS,
  MODULOS_TODOS,
  PERMISSOES_MODULO,
  VISUALIZACOES_MODULO_POR_IDS,
} from './queries/modules';

interface ModuleRow {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  tipo_entidade: string;
  icon: string | null;
  color: string | null;
  prefix: string;
  ordem: number;
  status: ModuleStatus;
  versao: number;
  config_version: number | null;
  configuracao: string;
  config_suite: string | null;
  criado_em: string;
  atualizado_em: string;
  publicado_em: string | null;
}
interface PermissionRow {
  profile: string;
  can_view: number;
  can_create: number;
  can_edit: number;
  can_approve: number;
  can_delete: number;
}

interface DataRegistryRow extends Record<string, unknown> {
  id: string;
  tipo: string;
  chave: string;
  conteudo: string | null;
  versao: number | null;
  criado_em: string;
  atualizado_em: string;
}

interface ViewRegistryRow {
  id: string;
  titulo: string;
  perfis: string;
  layout: string;
  widgets: string;
  module_type: string | null;
  user_id: string | null;
  is_template: number;
  ativo: number;
  criado_em: string | null;
  atualizado_em: string | null;
}

interface DecisionRegistryRow {
  id: string;
  target_type: string;
  action: string;
  perfis: string;
  enabled_when: string;
  steps: string;
  params: string;
  consequence_type: string;
  consequence_pattern: string | null;
  consequence_config: string;
  ativo: number;
  criado_em: string | null;
  atualizado_em: string | null;
}

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function rowToModule(row: ModuleRow): ModuleRegistry {
  return {
    id: row.id,
    slug: row.slug,
    name: row.nome,
    description: row.descricao,
    entity_type: row.tipo_entidade,
    icon: row.icon,
    color: row.color,
    prefix: row.prefix,
    ordem: row.ordem,
    status: row.status,
    version: row.versao,
    config_version: row.config_version ?? 1,
    config: safeJsonParse<ModuleConfig>(row.configuracao, {}),
    suite_config: row.config_suite ? safeJsonParse<Record<string, unknown> | null>(row.config_suite, null) : null,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    publicado_em: row.publicado_em,
  };
}

export class SqliteModuleRepository implements ModuleRepository {
  constructor(private readonly db: SqlitePort) {}

  async findById(id: string): Promise<ModuleRegistry | null> {
    const rows = await this.db.query<ModuleRow>(MODULO_POR_ID.sql, [id]);
    return rows[0] ? rowToModule(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<ModuleRegistry | null> {
    const rows = await this.db.query<ModuleRow>(MODULO_REGISTRY_POR_SLUG.sql, [slug]);
    return rows[0] ? rowToModule(rows[0]) : null;
  }

  async findByEntityType(entityType: string): Promise<ModuleRegistry | null> {
    const rows = await this.db.query<ModuleRow>(MODULO_POR_TIPO_ENTIDADE.sql, [entityType]);
    return rows[0] ? rowToModule(rows[0]) : null;
  }

  async findAll(status?: ModuleStatus): Promise<ModuleRegistry[]> {
    const query = status ? MODULOS_POR_STATUS : MODULOS_TODOS;
    const params = status ? [status] : [];
    const rows = await this.db.query<ModuleRow>(query.sql, params);
    return rows.map(rowToModule);
  }

  async save(module: ModuleRegistry): Promise<void> {
    // UPSERT atômico — elimina a race TOCTOU do SELECT-then-INSERT/UPDATE.
    // criado_em: respeita o valor do domínio no INSERT (fallback datetime('now'))
    // e preserva o existente no ON CONFLICT (nunca sobrescreve a data de criação).
    await this.db.execute(
      `INSERT INTO registro_modulos
         (id, slug, nome, descricao, tipo_entidade, icon, color, prefix, ordem, status, versao, config_version, configuracao, config_suite, criado_em, atualizado_em, publicado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'), ?)
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         nome = excluded.nome,
         descricao = excluded.descricao,
         tipo_entidade = excluded.tipo_entidade,
         icon = excluded.icon,
         color = excluded.color,
         prefix = excluded.prefix,
         ordem = excluded.ordem,
         status = excluded.status,
         versao = excluded.versao,
         config_version = excluded.config_version,
         configuracao = excluded.configuracao,
         config_suite = excluded.config_suite,
         criado_em = registro_modulos.criado_em,
         atualizado_em = datetime('now'),
         publicado_em = excluded.publicado_em`,
      [
        module.id, module.slug, module.name, module.description, module.entity_type,
        module.icon, module.color, module.prefix, module.ordem, module.status,
        module.version, module.config_version ?? 1, JSON.stringify(module.config),
        module.suite_config ? JSON.stringify(module.suite_config) : null,
        module.criado_em,
        module.publicado_em,
      ],
    );
  }
  async delete(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM registro_modulos WHERE id = ?`, [id]);
  }

  async getPermissions(moduleId: string): Promise<ModulePermissionConfig[]> {
    const rows = await this.db.query<PermissionRow>(PERMISSOES_MODULO.sql, [moduleId]);
    return rows.map(r => ({
      profile: r.profile,
      can_view: r.can_view === 1,
      can_create: r.can_create === 1,
      can_edit: r.can_edit === 1,
      can_approve: r.can_approve === 1,
      can_delete: r.can_delete === 1,
    }));
  }

  async setPermissions(moduleId: string, permissions: ModulePermissionConfig[]): Promise<void> {
    // Transação — DELETE + INSERTs atômicos: falha no meio não zera as permissões.
    await this.db.transaction(async () => {
      await this.db.execute(`DELETE FROM permissoes_modulos WHERE module_id = ?`, [moduleId]);
      for (const p of permissions) {
        await this.db.execute(
          `INSERT INTO permissoes_modulos (module_id, profile, can_view, can_create, can_edit, can_approve, can_delete)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [moduleId, p.profile, p.can_view ? 1 : 0, p.can_create ? 1 : 0, p.can_edit ? 1 : 0, p.can_approve ? 1 : 0, p.can_delete ? 1 : 0],
        );
      }
    });
  }

  async loadRuntimeDto(slug: string, userProfile: string): Promise<ModuleRuntimeDto | null> {
    const mod = await this.findBySlug(slug);
    if (!mod) return null;

    const permissions = await this.getPermissions(mod.id);
    const userPerm = permissions.find(p => p.profile === userProfile) || {
      can_view: false, can_create: false, can_edit: false, can_approve: false, can_delete: false,
    };
    const isAdmin = userProfile === 'admin';
    if (!isAdmin && !userPerm.can_view) {
      return null;
    }

    const effectivePerm = isAdmin
      ? {
        can_view: true,
        can_create: true,
        can_edit: true,
        can_approve: true,
        can_delete: true,
      }
      : userPerm;

    const config = mod.config;

    // Load forms
    const forms: ModuleRuntimeDto['forms'] = [];
    if (config.forms && config.forms.length > 0) {
      const formIds = config.forms.map(f => f.form_id);
      const placeholders = formIds.map(() => '?').join(',');
      const formRows = await this.db.query<{
        form_id: string;
        titulo: string;
        conteudo: string;
      }>(FORMULARIOS_MODULO_POR_IDS(placeholders).sql, formIds);
      const formMap = new Map(formRows.map(f => [f.form_id, f]));
      for (const f of config.forms) {
        const formData = formMap.get(f.form_id);
        forms.push({
          form_id: f.form_id,
          required: f.required,
          default: f.default,
          order: f.order,
          schema: formData ? safeJsonParse<Record<string, unknown> | null>(formData.conteudo, null) : null,
        });
      }
    }

    // Load data catalogs
    const data_catalogs: ModuleRuntimeDto['data_catalogs'] = [];
    if (config.data_catalogs && config.data_catalogs.length > 0) {
      const catalogIds = [...new Set(config.data_catalogs.map(dc => dc.catalog_id))];
      const placeholders = catalogIds.map(() => '?').join(',');
      const catalogRows = await this.db.query<DataRegistryRow>(
        ITENS_CATALOGOS_MODULO_POR_TIPOS(placeholders).sql,
        catalogIds,
      );
      const itemsByType = new Map<string, Array<Record<string, unknown>>>();
      for (const row of catalogRows) {
        const rows = itemsByType.get(row.tipo) ?? [];
        rows.push(row);
        itemsByType.set(row.tipo, rows);
      }
      for (const dc of config.data_catalogs) {
        data_catalogs.push({
          catalog_id: dc.catalog_id,
          required: dc.required,
          items: itemsByType.get(dc.catalog_id) ?? [],
        });
      }
    }

    const views: ModuleRuntimeDto['views'] = [];
    if (config.views && config.views.length > 0) {
      const viewIds = config.views.map(v => v.view_id);
      const placeholders = viewIds.map(() => '?').join(',');
      const viewRows = await this.db.query<ViewRegistryRow>(
        VISUALIZACOES_MODULO_POR_IDS(placeholders).sql,
        viewIds,
      );
      const viewMap = new Map(viewRows.map(row => [row.id, {
        id: row.id,
        titulo: row.titulo,
        perfis: safeJsonParse<string[]>(row.perfis, []),
        layout: row.layout,
        widgets: safeJsonParse<unknown[]>(row.widgets, []),
        module_type: row.module_type,
        user_id: row.user_id,
        is_template: row.is_template === 1,
        ativo: row.ativo === 1,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
      }]));

      for (const v of config.views) {
        views.push({
          view_id: v.view_id,
          context: v.context,
          order: v.order,
          definition: viewMap.get(v.view_id) ?? null,
        });
      }
    }

    const decisions: ModuleRuntimeDto['decisions'] = [];
    if (config.decisions && config.decisions.length > 0) {
      const decisionIds = config.decisions.map(d => d.decision_id);
      const placeholders = decisionIds.map(() => '?').join(',');
      const decisionRows = await this.db.query<DecisionRegistryRow>(
        DECISOES_MODULO_POR_IDS(placeholders).sql,
        decisionIds,
      );
      const decisionMap = new Map(decisionRows.map(row => [row.id, {
        id: row.id,
        target_type: row.target_type,
        action: row.action,
        perfis: safeJsonParse<string[]>(row.perfis, []),
        enabled_when: safeJsonParse<unknown[]>(row.enabled_when, []),
        steps: safeJsonParse<unknown[]>(row.steps, []),
        params: safeJsonParse<Record<string, unknown>>(row.params, {}),
        consequence_type: row.consequence_type,
        consequence_pattern: row.consequence_pattern,
        consequence_config: safeJsonParse<Record<string, unknown>>(row.consequence_config, {}),
        ativo: row.ativo === 1,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
      }]));

      for (const d of config.decisions) {
        decisions.push({
          decision_id: d.decision_id,
          definition: decisionMap.get(d.decision_id) ?? null,
        });
      }
    }

    return {
      id: mod.id,
      slug: mod.slug,
      name: mod.name,
      description: mod.description,
      entity_type: mod.entity_type,
      icon: mod.icon,
      color: mod.color,
      prefix: mod.prefix,
      ordem: mod.ordem,
      status: mod.status,
      version: mod.version,
      permissions: effectivePerm,
      forms,
      data_catalogs,
      views,
      decisions,
    };
  }
}
