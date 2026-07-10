/**
 * ADR-009: PermissionActionRegistry
 * Unificação da Matriz de Permissões com Ações Universais
 */

export type UserRole = 'admin' | 'gerente' | 'coordenador' | 'campo' | 'operador' | 'encarregado';

export type UniversalAction =
  | 'CRIAR'
  | 'VISUALIZAR'
  | 'EDITAR'
  | 'EXCLUIR'
  | 'EXPORTAR'
  | 'ARQUIVAR'
  | 'GERENCIAR'
  | 'ACEITAR'
  | 'REJEITAR'
  | 'DEVOLVER'
  | 'REENCAMINHAR'
  | 'ENCAMINHAR'
  | 'SOLICITAR'
  | 'CRIAR_TAREFA';

export type Scope = 'own' | 'all' | 'subordinates';

export interface ActionContext {
  userId: string;
  userRole: UserRole;
  entity: string;
  entityId?: string;
  ownerId?: string;
  createdAt?: string;
  data?: Record<string, unknown>;
}

export interface PermissionActionConfig {
  action: UniversalAction;
  entity: string;
  requiredRoles: UserRole[];
  enabledWhen?: (ctx: ActionContext) => boolean;
  scope?: Scope;
  timeWindow?: number; // horas
  confirmationRequired?: boolean;
}

export class PermissionActionRegistry {
  private store = new Map<string, PermissionActionConfig[]>();

  private key(entity: string, action: UniversalAction): string {
    return `${entity}::${action}`;
  }

  register(config: PermissionActionConfig): void {
    const k = this.key(config.entity, config.action);
    const existing = this.store.get(k) || [];
    // Sobrescreve configuração existente para mesma entidade+ação
    const filtered = existing.filter(
      (c) =>
        !(
          c.entity === config.entity &&
          c.action === config.action &&
          JSON.stringify(c.requiredRoles) === JSON.stringify(config.requiredRoles)
        )
    );
    this.store.set(k, [...filtered, config]);
  }

  /**
   * Verifica se o usuário pode executar a ação na entidade.
   * Retorna true se houver pelo menos uma configuração que autorize.
   */
  canExecute(
    action: UniversalAction,
    entity: string,
    ctx: ActionContext
  ): boolean {
    const k = this.key(entity, action);
    const configs = this.store.get(k);
    if (!configs || configs.length === 0) return false;

    return configs.some((config) => {
      // 1. Verificar roles
      if (!config.requiredRoles.includes(ctx.userRole)) return false;

      // 2. Verificar escopo
      if (config.scope) {
        if (config.scope === 'own' && ctx.ownerId && ctx.ownerId !== ctx.userId) {
          return false;
        }
        if (config.scope === 'all') {
          // admin/gerente já coberto por roles; para outros, all implica próprio + subordinados
        }
      }

      // 3. Verificar janela de tempo
      if (config.timeWindow && ctx.createdAt) {
        const created = new Date(ctx.createdAt);
        const hoursAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > config.timeWindow) return false;
      }

      // 4. Verificar enabledWhen custom
      if (config.enabledWhen && !config.enabledWhen(ctx)) return false;

      return true;
    });
  }

  /**
   * Lista todas as ações disponíveis para o usuário em uma entidade.
   */
  getAvailableActions(
    entity: string,
    ctx: ActionContext
  ): Array<{ action: UniversalAction; config: PermissionActionConfig }> {
    const results: Array<{ action: UniversalAction; config: PermissionActionConfig }> = [];
    for (const [k, configs] of this.store.entries()) {
      if (k.startsWith(`${entity}::`)) {
        for (const config of configs) {
          if (this.canExecute(config.action, entity, ctx)) {
            results.push({ action: config.action, config });
          }
        }
      }
    }
    return results;
  }

  /**
   * Registra múltiplas configurações de uma vez.
   */
  registerMany(configs: PermissionActionConfig[]): void {
    for (const c of configs) this.register(c);
  }

  /**
   * Remove todas as configurações de uma entidade (útil em testes).
   */
  clearEntity(entity: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(`${entity}::`)) this.store.delete(k);
    }
  }
}

// Instância global (pode ser sobrescrita em testes)
export const globalPermissionRegistry = new PermissionActionRegistry();
