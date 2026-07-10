/**
 * Fonte canônica única de RBAC — hierarquia de perfis e matriz de permissões.
 * Gerado a partir daqui: desktop/src-tauri/src/commands/rbac_seed.sql e
 * mobile/www/js/rbac-matrix.generated.js (via packages/core/scripts/generate-rbac.mjs).
 */
import type { UserRole } from './PermissionActionRegistry.js';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 0,
  gerente: 1,
  coordenador: 2,
  encarregado: 3,
  operador: 4,
  campo: 4,
};

export interface RoleMetadata {
  nome: string;
  descricaoPerfil: string;
  descricaoNivel: string;
}

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  admin: { nome: 'Administrador', descricaoPerfil: 'Acesso total', descricaoNivel: 'Acesso total' },
  gerente: { nome: 'Gerente', descricaoPerfil: 'Gestao de usuarios e relatorios', descricaoNivel: 'Gestao' },
  coordenador: { nome: 'Coordenador', descricaoPerfil: 'Coordenacao de equipe', descricaoNivel: 'Coordenacao' },
  encarregado: { nome: 'Encarregado', descricaoPerfil: 'Supervisao de campo', descricaoNivel: 'Supervisao' },
  operador: { nome: 'Operador', descricaoPerfil: 'Execucao de tarefas', descricaoNivel: 'Execucao' },
  campo: { nome: 'Campo', descricaoPerfil: 'Execucao de tarefas', descricaoNivel: 'Execucao' },
};

export interface PermissionEntry {
  roles: UserRole[];
}

export const PERMISSION_MATRIX: Record<string, PermissionEntry> = {
  'users.create': { roles: ['admin', 'gerente'] },
  'users.edit': { roles: ['admin', 'gerente'] },
  'users.delete': { roles: ['admin'] },
  'users.view_all': { roles: ['admin', 'gerente'] },
  'users.change_password': { roles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] },
  'forms.create': { roles: ['admin', 'gerente'] },
  'forms.edit': { roles: ['admin', 'gerente'] },
  'forms.delete': { roles: ['admin'] },
  'forms.assign': { roles: ['admin', 'gerente'] },
  'forms.fill': { roles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] },
  'data.view_all': { roles: ['admin', 'gerente'] },
  'data.view_own': { roles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] },
  'data.edit_all': { roles: ['admin'] },
  'data.edit_own': { roles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] },
  'data.delete': { roles: ['admin'] },
  'data.export': { roles: ['admin', 'gerente'] },
  'data.archive': { roles: ['admin', 'gerente'] },
  'system.config': { roles: ['admin'] },
  'system.logs': { roles: ['admin', 'gerente'] },
  'system.sync': { roles: ['admin', 'gerente'] },
  'system.device_setup': { roles: ['admin', 'gerente'] },
  'reports.view': { roles: ['admin', 'gerente'] },
  'reports.export': { roles: ['admin', 'gerente'] },
  'activities.manage': { roles: ['admin', 'gerente'] },
  'tasks.reassign': { roles: ['admin', 'gerente', 'encarregado'] },
  'clients.view': { roles: ['admin', 'gerente', 'coordenador'] },
  'clients.create': { roles: ['admin', 'gerente'] },
  'clients.edit': { roles: ['admin', 'gerente'] },
  'clients.delete': { roles: ['admin'] },
  'clients.export': { roles: ['admin', 'gerente'] },
  'crm.view': { roles: ['admin', 'gerente', 'coordenador', 'encarregado'] },
  'crm.edit': { roles: ['admin', 'gerente', 'coordenador'] },
  'ouvidoria.view': { roles: ['admin', 'gerente', 'coordenador', 'encarregado'] },
  'ouvidoria.create': { roles: ['admin', 'gerente', 'coordenador', 'encarregado'] },
  'ouvidoria.respond': { roles: ['admin', 'gerente', 'coordenador'] },
  'ouvidoria.close': { roles: ['admin', 'gerente'] },
};

/**
 * Janela de edição (horas) para data.edit_own por perfil, usada por canEditData().
 * admin/gerente não aparecem aqui pois têm acesso incondicional (sem janela).
 * encarregado não aparece pois hoje não tem acesso via canEditData (comportamento preservado).
 */
export const DATA_EDIT_OWN_TIME_WINDOWS: Partial<Record<UserRole, number>> = {
  coordenador: 48,
  operador: 24,
  campo: 24,
};
