/**
 * Catálogo: Formulários, Solicitações e Submissões
 *
 * Hooks para templates de formulários, avaliação de visibilidade de campos,
 * submissões, solicitações (inbox) e upload de anexos.
 */

// --- Templates e visibilidade ---
export { useFormTemplate } from '../queries/useFormTemplate';           // ativo — definição do form por slug
export {
  useVisibilityEvaluator,                                               // ativo — avalia visibilidade/habilitação de campos
  useVisibleFields,                                                     // ativo — filtra campos visíveis
  evaluateVisibilityRules,                                              // ativo — avalia regras sem estado React
} from '../queries/useVisibilityEvaluator';

// --- Dados de submissão ---
export { useSubmissionData } from '../queries/useSubmissionData';       // ativo — normaliza envelopes de submissão

// --- Acesso a forms e usuários ---
export { useAssignedActiveForms } from '../queries/useAssignedActiveForms'; // ativo — form IDs de tarefas ativas do usuário
export { useUsersByForm } from '../queries/useUsersByForm';               // ativo — usuários com acesso ao form

// --- Solicitações ---
export {
  useSolicitacoesList,                                                   // ativo — pacotes e forms ad-hoc do usuário
  type SolicitacaoPackage,                                               // type — pacote de solicitação
} from '../queries/useSolicitacoesList';
export { useSolicitacaoEditor } from '../queries/useSolicitacaoEditor'; // ativo — edição e re-submissão de pacotes
export { useInboxMutations } from '../mutations/useInboxMutations';     // ativo — atualiza status no inbox

// --- Demandas ---
export { useDemandas } from '../queries/useDemandas';                   // ativo — ciclo de vida de demandas

// --- Anexos ---
export { useAnexoUpload } from '../mutations/useAnexoUpload';           // ativo — upload via Tauri file dialog

// --- Análise de dados ---
export { usePacoteFormTypes, usePacotesAnalise } from '../queries/useAnalysisData'; // ativo — tipos de form e registros para análise

// --- Gerenciamento do registry de formulários ---
export { useFormRegistryData } from '../queries/useFormRegistryData'; // ativo — CRUD de registro_formularios

// --- Histórico e ecopontos ---
export { useHistoryData } from '../queries/useHistoryData';           // ativo — pacotes arquivados/superseded + restore/delete
export { useCaixasData } from '../queries/useCaixasData';             // ativo — ocupação de caixas por ecoponto

// --- Inbox e tarefas atribuídas ---
export { useInboxData, type InboxViewRow } from '../queries/useInboxData'; // ativo — inbox normalizado com FTS e filtro de acesso
export { useAssignedTasks, type AssignedTaskNotification } from '../queries/useAssignedTasks'; // ativo — tarefas atribuídas ao usuário

// --- Use cases (DI) ---
export { useSuiteUseCases } from '../domain/useSuiteUseCases';          // ativo
