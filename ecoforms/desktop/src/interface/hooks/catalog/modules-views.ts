/**
 * Catálogo: Módulos, Views e Dashboards
 *
 * Hooks para o registro de módulos dinâmicos, definições de views
 * e widgets de dashboard.
 */

// --- Módulos ---
export { useModules } from '../queries/useModules';                     // ativo — lista, cria e publica módulos
export { useModuleRuntime } from '../queries/useModuleRuntime';          // ativo — runtime de módulo por slug/perfil
export { useModuleVisuals } from '../queries/useModuleVisuals';          // ativo — visuais configurados por usuário/perfil

// --- Views ---
export {
  useViewById,                                                           // ativo — view por ID
  useActiveViews,                                                        // ativo — views ativas filtradas por tipo
} from '../queries/useViews';

// --- Widgets e dashboard ---
export { useDashboardWidgets } from '../useDashboardWidgets';            // ativo — widgets disponíveis por perfil
export { useWidgetMutations } from '../mutations/useWidgetMutations';     // ativo — adiciona/remove widgets do dashboard
