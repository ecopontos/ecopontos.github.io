export type ModuleStatus = 'draft' | 'published' | 'archived';

export interface ModuleConfig {
  forms?: Array<{
    form_id: string;
    required: boolean;
    default: boolean;
    order: number;
  }>;
  data_catalogs?: Array<{
    catalog_id: string;
    required: boolean;
  }>;
  views?: Array<{
    view_id: string;
    context: 'dashboard' | 'mapa' | 'relatorio' | 'modal';
    order: number;
  }>;
  decisions?: Array<{
    decision_id: string;
  }>;
}

export interface ModulePermissionConfig {
  profile: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_delete: boolean;
}

export interface ModuleRegistry {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  entity_type: string;
  icon: string | null;
  color: string | null;
  prefix: string;
  ordem: number;
  status: ModuleStatus;
  version: number;
  config: ModuleConfig;
  suite_config: Record<string, unknown> | null;
  criado_em: string;
  atualizado_em: string;
  publicado_em: string | null;
}

export interface ModuleRuntimeDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  entity_type: string;
  icon: string | null;
  color: string | null;
  prefix: string;
  ordem: number;
  status: ModuleStatus;
  version: number;
  permissions: {
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_approve: boolean;
    can_delete: boolean;
  };
  forms: Array<{
    form_id: string;
    required: boolean;
    default: boolean;
    order: number;
    schema: Record<string, unknown> | null;
  }>;
  data_catalogs: Array<{
    catalog_id: string;
    required: boolean;
    items: Array<Record<string, unknown>>;
  }>;
  views: Array<{
    view_id: string;
    context: 'dashboard' | 'mapa' | 'relatorio' | 'modal';
    order: number;
    definition: Record<string, unknown> | null;
  }>;
  decisions: Array<{
    decision_id: string;
    definition: Record<string, unknown> | null;
  }>;
}
