/**
 * Catálogo: Kanban, Projetos e Tarefas
 *
 * Hooks relacionados ao quadro Kanban, gerenciamento de projetos,
 * tarefas, métricas e histórico de atividades.
 */

// --- Estado e dados principais ---
export { useKanbanViewState } from '../queries/useKanbanViewState';       // ativo
export type { ViewMode } from '../queries/useKanbanViewState';            // type — modo de visualização
export { useKanban, useTaskOptions } from '../queries/useKanban';          // ativo
export { useKanbanData } from '../queries/useKanbanData';                  // ativo
export {
  useProjects,
  useProjectMutations,
  type ProjectWithMetrics,                                                  // type — projeto com métricas calculadas
  type ProjectPatch,                                                        // type — patch parcial de projeto
} from '../queries/useProjects';
export { useProjectDetail } from '../queries/useProjectDetail';            // ativo

// --- Métricas, histórico e comentários ---
export { useTaskMetrics } from '../queries/useTaskMetrics';                // ativo
export { useTaskHistory } from '../queries/useTaskHistory';                // ativo
export { useTaskComments } from '../queries/useTaskComments';              // ativo
export { useTaskAttachments } from '../queries/useTaskAttachments';        // ativo

// --- Mutations ---
export { useKanbanMutations } from '../mutations/useKanbanMutations';      // ativo

// --- Use cases (DI) ---
export { useTaskUseCases } from '../domain/useTaskUseCases';               // ativo

// --- Ações e widgets de workflow ---
export { useWorkflowActions } from '../useWorkflowActions';                // ativo
