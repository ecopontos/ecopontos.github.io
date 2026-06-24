import type { ModuleRepository } from '../../../domain/module/ModuleRepository';
import type { ModuleRegistry, ModuleRuntimeDto, ModulePermissionConfig, ModuleConfig, ModuleStatus } from '../../../domain/module/ModuleRegistry';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

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
    const rows = await this.db.query<ModuleRow>(
      `SELECT * FROM registro_modulos WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? rowToModule(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<ModuleRegistry | null> {
    const rows = await this.db.query<ModuleRow>(
      `SELECT * FROM registro_modulos WHERE slug = ? LIMIT 1`,
      [slug],
    );
    return rows[0] ? rowToModule(rows[0]) : null;
  }

  async findByEntityType(entityType: string): Promise<ModuleRegistry | null> {
    const rows = await this.db.query<ModuleRow>(
      `SELECT * FROM registro_modulos WHERE tipo_entidade = ? LIMIT 1`,
      [entityType],
    );
    return rows[0] ? rowToModule(rows[0]) : null;
  }

  async findAll(status?: ModuleStatus): Promise<ModuleRegistry[]> {
    const sql = status
      ? `SELECT * FROM registro_modulos WHERE status = ? ORDER BY ordem ASC`
      : `SELECT * FROM registro_modulos ORDER BY ordem ASC`;
    const params = status ? [status] : [];
    const rows = await this.db.query<ModuleRow>(sql, params);
    return rows.map(rowToModule);
  }

  async save(module: ModuleRegistry): Promise<void> {
    const exists = await this.db.query<{ id: string }>(
      `SELECT id FROM registro_modulos WHERE id = ? LIMIT 1`,
      [module.id],
    );

    if (exists.length === 0) {
      await this.db.execute(
        `INSERT INTO registro_modulos (id, slug, nome, descricao, tipo_entidade, icon, color, prefix, ordem, status, versao, configuracao, config_suite, criado_em, atualizado_em, publicado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
        [
          module.id, module.slug, module.name, module.description, module.entity_type,
          module.icon, module.color, module.prefix, module.ordem, module.status,
          module.version, JSON.stringify(module.config), module.suite_config ? JSON.stringify(module.suite_config) : null,
          module.publicado_em,
        ],
      );
    } else {
      await this.db.execute(
        `UPDATE registro_modulos SET slug = ?, nome = ?, descricao = ?, tipo_entidade = ?, icon = ?, color = ?, prefix = ?, ordem = ?, status = ?, versao = ?, configuracao = ?, config_suite = ?, atualizado_em = datetime('now'), publicado_em = ? WHERE id = ?`,
        [
          module.slug, module.name, module.description, module.entity_type,
          module.icon, module.color, module.prefix, module.ordem, module.status,
          module.version, JSON.stringify(module.config), module.suite_config ? JSON.stringify(module.suite_config) : null,
          module.publicado_em, module.id,
        ],
      );
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM registro_modulos WHERE id = ?`, [id]);
  }

  async getPermissions(moduleId: string): Promise<ModulePermissionConfig[]> {
    const rows = await this.db.query<PermissionRow>(
      `SELECT profile, can_view, can_create, can_edit, can_approve, can_delete FROM permissoes_modulos WHERE module_id = ?`,
      [moduleId],
    );
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
    await this.db.execute(`DELETE FROM permissoes_modulos WHERE module_id = ?`, [moduleId]);
    for (const p of permissions) {
      await this.db.execute(
        `INSERT INTO permissoes_modulos (module_id, profile, can_view, can_create, can_edit, can_approve, can_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [moduleId, p.profile, p.can_view ? 1 : 0, p.can_create ? 1 : 0, p.can_edit ? 1 : 0, p.can_approve ? 1 : 0, p.can_delete ? 1 : 0],
      );
    }
  }

  async loadRuntimeDto(slug: string, userProfile: string): Promise<ModuleRuntimeDto | null> {
    const mod = await this.findBySlug(slug);
    if (!mod) return null;

    const permissions = await this.getPermissions(mod.id);
    const userPerm = permissions.find(p => p.profile === userProfile) || {
      can_view: false, can_create: false, can_edit: false, can_approve: false, can_delete: false,
    };

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
      }>(
        `SELECT form_id, titulo, conteudo FROM registro_formularios WHERE form_id IN (${placeholders})`,
        formIds,
      );
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
      for (const dc of config.data_catalogs) {
        const items = await this.db.query<Record<string, unknown>>(
          `SELECT * FROM registro_dados WHERE tipo = ? ORDER BY json_extract(conteudo, '$.nome') ASC`,
          [dc.catalog_id],
        );
        data_catalogs.push({
          catalog_id: dc.catalog_id,
          required: dc.required,
          items,
        });
      }
    }

    const views: ModuleRuntimeDto['views'] = (config.views || []).map(v => ({
      view_id: v.view_id,
      context: v.context,
      order: v.order,
      definition: null,
    }));

    const decisions: ModuleRuntimeDto['decisions'] = (config.decisions || []).map(d => ({
      decision_id: d.decision_id,
      definition: null,
    }));

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
      permissions: userPerm,
      forms,
      data_catalogs,
      views,
      decisions,
    };
  }
}
