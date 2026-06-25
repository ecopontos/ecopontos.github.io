/**
 * Catálogo: Tauri e Infraestrutura SQLite
 *
 * Hooks de infraestrutura Tauri (runtime detection, invoke, filesystem,
 * dialog) e acesso ao SQLite local. Confinamento de imports Tauri à camada UI.
 */

// --- Runtime Tauri ---
export { useIsTauri } from '../tauri/useIsTauri';                        // ativo — detecta contexto Tauri
export { useTauriInvoke } from '../tauri/useTauriInvoke';                // ativo — invoke() seguro com fallback
export { useTauriDialog } from '../tauri/useTauriDialog';                // ativo — dialogs de open/save
export { useTauriFs } from '../tauri/useTauriFs';                        // ativo — operações de filesystem

// --- React Query sobre Tauri ---
export { useTauriQuery } from '../tauri/useTauriQuery';                  // ativo — SELECT via invoke + React Query
export {
  useTauriMutation,                                                       // ativo — INSERT/UPDATE/DELETE via invoke
  useLastInsertId,                                                        // ativo — ID da última inserção
  useTauriBatch,                                                          // ativo — batch de mutations
} from '../tauri/useTauriMutation';

// --- Adaptador SQLite ---
export { useSqlite } from '../queries/useSqlite';                        // ativo — proxy do SQLiteAdapter com init guard

// --- Schema e debug ---
export { useSQLiteColumnExists } from '../queries/useSQLiteSchema';      // ativo — verifica coluna via PRAGMA
export { useDebugHealth } from '../queries/useDebugHealth';              // ativo — health check de tabelas (debug)

// --- DEPRECATED: não usar diretamente em hooks de negócio ---
/** @deprecated Use repositórios via use cases do container DI */
export { useSQLiteQuery } from '../queries/useSQLiteQuery';
