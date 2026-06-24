/**
 * ADR-009 Adapter: PermissionActionRegistry integrado ao desktop
 *
 * Registra todas as permissões legadas (usePermissions.ts) no
 * PermissionActionRegistry unificado, permitindo migração gradual.
 */

import {
  globalPermissionRegistry,
  type UserRole,
  type ActionContext,
  type UniversalAction,
} from 'ecoforms-core/permissions';

// ── Registro de permissões legadas ──

// Clientes
const clientActions = [
  { action: 'VISUALIZAR' as UniversalAction, entity: 'client', requiredRoles: ['admin', 'gerente', 'coordenador'] as UserRole[] },
  { action: 'CRIAR' as UniversalAction, entity: 'client', requiredRoles: ['admin', 'gerente'] as UserRole[] },
  { action: 'EDITAR' as UniversalAction, entity: 'client', requiredRoles: ['admin', 'gerente'] as UserRole[], scope: 'all' as const },
  { action: 'EXCLUIR' as UniversalAction, entity: 'client', requiredRoles: ['admin'] as UserRole[] },
  { action: 'EXPORTAR' as UniversalAction, entity: 'client', requiredRoles: ['admin', 'gerente'] as UserRole[] },
];

// CRM
const crmActions = [
  { action: 'VISUALIZAR' as UniversalAction, entity: 'crm', requiredRoles: ['admin', 'gerente', 'coordenador', 'encarregado'] as UserRole[] },
  { action: 'EDITAR' as UniversalAction, entity: 'crm', requiredRoles: ['admin', 'gerente', 'coordenador'] as UserRole[], scope: 'all' as const },
];

// Usuários
const userActions = [
  { action: 'VISUALIZAR' as UniversalAction, entity: 'user', requiredRoles: ['admin', 'gerente'] as UserRole[] },
  { action: 'CRIAR' as UniversalAction, entity: 'user', requiredRoles: ['admin', 'gerente'] as UserRole[], enabledWhen: (ctx: ActionContext) => {
    // Hierarquia: admin cria qualquer um; gerente só cria subordinados
    if (ctx.userRole === 'admin') return true;
    if (ctx.userRole === 'gerente') {
      const targetRole = (ctx.data?.targetRole as string)?.toLowerCase();
      return targetRole !== 'admin' && targetRole !== 'gerente';
    }
    return false;
  }},
  { action: 'EDITAR' as UniversalAction, entity: 'user', requiredRoles: ['admin', 'gerente'] as UserRole[], enabledWhen: (ctx: ActionContext) => {
    // Admin edita todos; gerente edita subordinados; usuário edita a si mesmo
    if (ctx.userRole === 'admin') return true;
    if (ctx.userRole === 'gerente') {
      const targetRole = (ctx.data?.targetRole as string)?.toLowerCase();
      return targetRole !== 'admin' && targetRole !== 'gerente';
    }
    return ctx.ownerId === ctx.userId;
  }},
  { action: 'EXCLUIR' as UniversalAction, entity: 'user', requiredRoles: ['admin'] as UserRole[] },
];

// Formulários
const formActions = [
  { action: 'CRIAR' as UniversalAction, entity: 'form', requiredRoles: ['admin', 'gerente'] as UserRole[] },
  { action: 'EDITAR' as UniversalAction, entity: 'form', requiredRoles: ['admin', 'gerente'] as UserRole[] },
  { action: 'EXCLUIR' as UniversalAction, entity: 'form', requiredRoles: ['admin'] as UserRole[] },
  { action: 'VISUALIZAR' as UniversalAction, entity: 'form', requiredRoles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] as UserRole[] },
];

// Dados / Suite
const dataActions = [
  { action: 'VISUALIZAR' as UniversalAction, entity: 'data', requiredRoles: ['admin', 'gerente'] as UserRole[], scope: 'all' as const },
  { action: 'VISUALIZAR' as UniversalAction, entity: 'data', requiredRoles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] as UserRole[], scope: 'own' as const },
  { action: 'EDITAR' as UniversalAction, entity: 'data', requiredRoles: ['admin'] as UserRole[], scope: 'all' as const },
  { action: 'EDITAR' as UniversalAction, entity: 'data', requiredRoles: ['admin', 'gerente', 'coordenador', 'campo', 'operador', 'encarregado'] as UserRole[], scope: 'own' as const, timeWindow: 24 },
  { action: 'EXCLUIR' as UniversalAction, entity: 'data', requiredRoles: ['admin'] as UserRole[] },
  { action: 'EXPORTAR' as UniversalAction, entity: 'data', requiredRoles: ['admin', 'gerente'] as UserRole[] },
  { action: 'ARQUIVAR' as UniversalAction, entity: 'data', requiredRoles: ['admin', 'gerente'] as UserRole[] },
];

// Relatórios
const reportActions = [
  { action: 'VISUALIZAR' as UniversalAction, entity: 'report', requiredRoles: ['admin', 'gerente'] as UserRole[] },
  { action: 'EXPORTAR' as UniversalAction, entity: 'report', requiredRoles: ['admin', 'gerente'] as UserRole[] },
];

// Atividades
const activityActions = [
  { action: 'GERENCIAR' as UniversalAction, entity: 'activity', requiredRoles: ['admin', 'gerente'] as UserRole[] },
];

// Tarefas
const taskActions = [
  { action: 'GERENCIAR' as UniversalAction, entity: 'task', requiredRoles: ['admin', 'gerente', 'encarregado'] as UserRole[] },
];

// Sistema
const systemActions = [
  { action: 'GERENCIAR' as UniversalAction, entity: 'system', requiredRoles: ['admin'] as UserRole[] },
  { action: 'VISUALIZAR' as UniversalAction, entity: 'system', requiredRoles: ['admin', 'gerente'] as UserRole[], scope: 'all' as const },
];

// Ouvidoria
const ouvidoriaActions = [
  { action: 'VISUALIZAR' as UniversalAction, entity: 'ouvidoria', requiredRoles: ['admin', 'gerente', 'coordenador', 'encarregado'] as UserRole[] },
  { action: 'CRIAR' as UniversalAction, entity: 'ouvidoria', requiredRoles: ['admin', 'gerente', 'coordenador', 'encarregado'] as UserRole[] },
  { action: 'EDITAR' as UniversalAction, entity: 'ouvidoria', requiredRoles: ['admin', 'gerente', 'coordenador'] as UserRole[], scope: 'all' as const },
  { action: 'REJEITAR' as UniversalAction, entity: 'ouvidoria', requiredRoles: ['admin', 'gerente'] as UserRole[] },
];

// Workflow actions (ADR-005) — também registradas no registry para unified lookup
const workflowActions = [
  { action: 'ACEITAR' as UniversalAction, entity: 'suite', requiredRoles: ['admin', 'gerente', 'coordenador'] as UserRole[] },
  { action: 'REJEITAR' as UniversalAction, entity: 'suite', requiredRoles: ['admin', 'gerente'] as UserRole[] },
  { action: 'DEVOLVER' as UniversalAction, entity: 'suite', requiredRoles: ['admin', 'gerente'] as UserRole[] },
  { action: 'REENCAMINHAR' as UniversalAction, entity: 'suite', requiredRoles: ['admin', 'gerente', 'coordenador'] as UserRole[] },
  { action: 'SOLICITAR' as UniversalAction, entity: 'suite', requiredRoles: ['admin', 'gerente', 'coordenador', 'encarregado'] as UserRole[] },
  { action: 'CRIAR_TAREFA' as UniversalAction, entity: 'suite', requiredRoles: ['admin', 'gerente'] as UserRole[] },
];

let _initialized = false;

export function initializePermissionRegistry(): void {
  if (_initialized) return;
  _initialized = true;

  globalPermissionRegistry.registerMany([
    ...clientActions,
    ...crmActions,
    ...userActions,
    ...formActions,
    ...dataActions,
    ...reportActions,
    ...activityActions,
    ...taskActions,
    ...systemActions,
    ...ouvidoriaActions,
    ...workflowActions,
  ]);
}

export { globalPermissionRegistry };
export type { UserRole, ActionContext, UniversalAction };
