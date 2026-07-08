/**
 * Catalogo: Modulos, Views e Dashboards
 *
 * Hooks para o registro de modulos dinamicos, definicoes de views
 * e widgets de dashboard.
 */

// --- Modulos ---
export { useModules } from '../queries/useModules';
export { useModuleRuntime } from '../queries/useModuleRuntime';
export { useModuleVisuals } from '../queries/useModuleVisuals';

// --- Views ---
export {
  useViewById,
  useActiveViews,
  useModuleDashboardMutations,
  useModuleDashboardData,
} from '../queries/useViews';

// --- Widgets e dashboard ---
export { useDashboardWidgets } from '../useDashboardWidgets';
export { useWidgetMutations } from '../mutations/useWidgetMutations';
