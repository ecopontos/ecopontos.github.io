/**
 * Catálogo: Utilitários Gerais
 *
 * Hooks utilitários transversais: teclado, armazenamento de arquivos,
 * container DI, CEP, parquet e seed de demonstração.
 */

export { useKeyboardShortcuts } from '../utils/useKeyboardShortcuts';   // ativo — atalhos globais de teclado
export { useFileStorage } from '../utils/useFileStorage';               // ativo — FileStoragePort via DI
export { useSupabaseClient } from '../utils/useSupabaseClient';         // ativo — cliente Supabase para UI
export {
  useContainer,                                                          // ativo — resolve serviços do container DI
  initializeContainer,                                                   // ativo — inicializa container (boot)
} from '../utils/useContainer';
export { useCEP } from '../utils/useCEP';                               // ativo — busca CEP no SQLite local
export { useNetworkParquet } from '../utils/useNetworkParquet';         // ativo — config de pasta de rede Parquet

// --- Seed / Demo ---
export { useSeedDemo } from '../mutations/useSeedDemo';                 // ativo — semeia dados de demonstração
