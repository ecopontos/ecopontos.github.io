/**
 * Catálogo: Clientes
 *
 * Hooks para gestão de clientes (PF e PJ), contatos,
 * pesquisa por telefone e vinculação PF↔PJ.
 */

// --- Queries ---
export {
  useClientes,
  useClienteById,
  useClienteContatos,
  usePfContactsByPj,
  useClientePhoneSearch,
  usePfUnassigned,
  usePjByPfId,
  usePjUnassignedToPf,
} from '../queries/useClientes';

// --- Mutations ---
export { useClienteMutations } from '../mutations/useClienteMutations';    // ativo
