/**
 * Catálogo: Autenticação, Permissões e Usuários
 *
 * Hooks para RBAC, verificação de permissões, gerenciamento de usuários
 * e integração com Supabase Admin.
 */
// --- Contexto de autenticação ---
export { useAuth } from '@/contexts/AuthContext';


// --- RBAC e permissões ---
export {
  usePermissions,                                                        // ativo — permissões por perfil/ação
  type UserRole,                                                         // type — papel do usuário
  type Permission,                                                       // type — ação de permissão
  type UsePermissionsReturn,                                             // type — retorno do hook
} from '../utils/usePermissions';
export { useFormPermissions } from '../utils/useFormPermissions';       // ativo — acesso a forms via tarefas ativas
export {
  getInboxAccessFilter,                                                  // ativo — filtro de acesso ao inbox
  canManageByRole,                                                       // ativo — verifica papel gerencial
} from '../utils/useAccessFilters';

// --- Usuários ---
export {
  useAdminUsers,                                                         // ativo — CRUD de usuários (admin)
  useAllUsers,                                                           // ativo — lista todos os usuários
} from '../queries/useAdminUsers';
export { useSetores } from '../queries/useSetores';                      // ativo — setores ativos
export type { Setor } from '../queries/useSetores';

// --- Bootstrap e first-run ---
export { useFirstRunSetup } from '../mutations/useFirstRunSetup';

// --- Supabase Admin ---
export { useSupabaseAdmin } from '../queries/useSupabaseAdmin';          // ativo — sync Supabase → SQLite (admin)
export type { ProfileSyncResult } from '../queries/useSupabaseAdmin';

// --- Use cases (DI) ---
export { useUserUseCases } from '../domain/useUserUseCases';             // ativo
