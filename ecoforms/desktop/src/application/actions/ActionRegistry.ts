import type { UserRole } from "@/src/interface/hooks/catalog/auth";
import type { VisibilityRule } from "@/types";
import type { TaskProjectionInput } from '../task/TaskProjectionService';

export interface ActionCommands {
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
}

export interface ActionSyncOutbox {
  write(type: string, data: Record<string, unknown>, options?: { aggregateId?: string; streamId?: string }): Promise<void>;
}

export interface ActionSuiteUseCases {
  review: { execute(input: { packageId: string; approve: boolean; reviewerId: string; motivo?: string }): Promise<unknown> };
}

export interface ActionDemandaClose {
  execute(input: { demandaId: string; encerradoPor: string; motivo?: string }): Promise<void>;
}

export interface ActionContainer {
  sqlite: {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<unknown>;
  };
  /** Typed for review — cast to specific use case for other operations */
  suites: ActionSuiteUseCases;
  /** Use (ctx.container.demandas as { close: ActionDemandaClose }).close for CloseDemandaUseCase */
  demandas: unknown;
  taskProjection: { project(input: TaskProjectionInput): Promise<string> };
}

export interface ActionButtonConfig {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
  enabledWhen?: VisibilityRule[];
  requiredRoles?: UserRole[];
  requiresInput?: { fields: FormFieldConfig[] };
  expandPanel?: {
    panel: string;
    queryParam?: string;
  };
  fieldMapping?: Record<string, {
    from?: string;
    value?: unknown;
    transform?: (value: unknown, ctx: ActionContext) => unknown;
  }>;
  handler: ActionHandler;
}

export interface FormFieldConfig {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  dataSource?: string;
  options?: Array<{ label: string; value: string }>;
}

export type ActionHandler = (ctx: ActionContext) => Promise<ActionResult>;

export interface ActionContext {
  targetType: "task" | "suite_package" | "demand" | "ecoponto";
  targetId: string;
  task?: unknown;
  suitePackage?: unknown;
  demand?: unknown;
  ecoponto?: unknown;
  formData: Record<string, unknown>;
  userId: string;
  input?: Record<string, unknown>;
  container: ActionContainer;
  commands: ActionCommands;
  syncOutbox: ActionSyncOutbox;
  syncNow: () => Promise<void>;
}

export interface ActionResult {
  success: boolean;
  message: string;
  redirect?: string;
}

const actionRegistry = new Map<string, ActionButtonConfig>();

export function registerAction(config: ActionButtonConfig) {
  if (actionRegistry.has(config.id)) {
    console.warn(`Action "${config.id}" já registrada — sobrescrevendo.`);
  }
  actionRegistry.set(config.id, config);
}

export function getAvailableActions(
  targetType: string,
  formData: Record<string, unknown>,
  userRole: UserRole
): ActionButtonConfig[] {
  return Array.from(actionRegistry.values()).filter((action) => {
    if (action.requiredRoles && !action.requiredRoles.includes(userRole)) return false;
    if (action.enabledWhen) {
      const visible = evaluateVisibilityRules(action.enabledWhen, formData);
      if (!visible) return false;
    }
    return true;
  });
}

function evaluateVisibilityRules(
  rules: VisibilityRule[] | undefined,
  formData: Record<string, unknown>
): boolean {
  if (!rules || rules.length === 0) return true;

  return rules.reduce((result, rule, index) => {
    const fieldValue = formData[rule.fieldId];
    let conditionMet = evaluateCondition(fieldValue, rule);
    if (rule.negate) conditionMet = !conditionMet;
    if (index === 0) return conditionMet;
    const logic = rule.logic || "AND";
    return logic === "AND" ? result && conditionMet : result || conditionMet;
  }, true);
}

function evaluateCondition(fieldValue: unknown, rule: VisibilityRule): boolean {
  const { operator, value, values } = rule;
  const normalized = fieldValue === undefined || fieldValue === null ? "" : fieldValue;

  switch (operator) {
    case "eq":
      return String(normalized) === String(value);
    case "neq":
      return String(normalized) !== String(value);
    case "gt":
      return Number(normalized) > Number(value);
    case "gte":
      return Number(normalized) >= Number(value);
    case "lt":
      return Number(normalized) < Number(value);
    case "lte":
      return Number(normalized) <= Number(value);
    case "contains":
      return String(normalized).toLowerCase().includes(String(value).toLowerCase());
    case "startsWith":
      return String(normalized).toLowerCase().startsWith(String(value).toLowerCase());
    case "endsWith":
      return String(normalized).toLowerCase().endsWith(String(value).toLowerCase());
    case "in":
      if (!values || values.length === 0) return false;
      return values.some((v) => String(normalized) === String(v));
    case "notIn":
      if (!values || values.length === 0) return true;
      return !values.some((v) => String(normalized) === String(v));
    case "empty":
      return (
        normalized === "" ||
        normalized === null ||
        normalized === undefined ||
        (Array.isArray(normalized) && normalized.length === 0)
      );
    case "notEmpty":
      return (
        normalized !== "" &&
        normalized !== null &&
        normalized !== undefined &&
        (!Array.isArray(normalized) || normalized.length > 0)
      );
    default:
      return true;
  }
}

export function aplicarMapeamento(
  mapping: ActionButtonConfig["fieldMapping"],
  ctx: ActionContext
): Record<string, unknown> {
  const resultado: Record<string, unknown> = {};
  if (!mapping) return resultado;

  for (const [destino, rule] of Object.entries(mapping)) {
    if (rule.value !== undefined) {
      resultado[destino] = rule.value;
    } else if (rule.from) {
      const valorBruto = getByPath(ctx, rule.from);
      resultado[destino] = rule.transform ? rule.transform(valorBruto, ctx) : valorBruto;
    }
  }
  return resultado;
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object" && acc !== null) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * AD-016: Sete ações universais de decisão.
 * IDs canônicos — usados pelo decision_registry e ActionBar.
 *
 * Terminal (encerram o ciclo):
 *   ACEITAR    → status locked, propriedade permanece
 *   REJEITAR   → status closed, encerrada
 *   DEVOLVER   → status refuted, volta à origem
 *
 * Gerador (usam o registro como base para criar algo novo):
 *   REENCAMINHAR → dispatched + transfer, origem perde propriedade
 *   ENCAMINHAR   → dispatched + share, origem mantém
 *   SOLICITAR    → novo suite com ref_package_id
 *   CRIAR_TAREFA → nova tarefas com suite_id
 */
export const UNIVERSAL_ACTIONS = {
  ACEITAR:       { id: "aceitar",        pattern: "terminal",  effect: "locked",       property: "permanece" },
  REJEITAR:      { id: "rejeitar",       pattern: "terminal",  effect: "closed",       property: "encerrada" },
  DEVOLVER:      { id: "devolver",       pattern: "terminal",  effect: "refuted",      property: "volta à origem" },
  REENCAMINHAR:  { id: "reencaminhar",   pattern: "generator", effect: "dispatched",   property: "transferência total" },
  ENCAMINHAR:    { id: "encaminhar",     pattern: "generator", effect: "dispatched",   property: "origem mantém" },
  SOLICITAR:     { id: "solicitar",      pattern: "generator", effect: "current",      property: "gera derivado" },
  CRIAR_TAREFA:  { id: "criar_tarefa",   pattern: "generator", effect: "current",      property: "gera tarefa" },
} as const;

export type UniversalActionId = keyof typeof UNIVERSAL_ACTIONS;
