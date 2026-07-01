/**
 * Catálogo: Utilitários Gerais
 *
 * Hooks utilitários transversais: teclado, armazenamento de arquivos,
 * container DI, parquet e seed de demonstração.
 */

export { useKeyboardShortcuts } from '../utils/useKeyboardShortcuts';   // ativo — atalhos globais de teclado
export { useFileStorage } from '../utils/useFileStorage';               // ativo — FileStoragePort via DI
export { useSupabaseClient } from '../utils/useSupabaseClient';         // ativo — cliente Supabase para UI
export { useTaskPatchStorage } from '../utils/useTaskPatchStorage';     // ativo — patches de tarefa via storage externo
export {
  useContainer,                                                          // ativo — resolve serviços do container DI
  useContainerAsync,                                                     // ativo — getter async memoizado do container DI
  initializeContainer,                                                   // ativo — inicializa container (boot)
  getContainerAsync,                                                     // ativo — acesso async ao container para handlers
} from '../utils/useContainer';
export { useCrmDataSource } from '../utils/useCrmDataSource';       // ativo — data sources CRM para campos dinâmicos
export { useManifestacaoWorkflow } from '../utils/useManifestacaoWorkflow'; // ativo — workflow de manifestações
export { useNetworkParquet } from '../utils/useNetworkParquet';         // ativo — config de pasta de rede Parquet
export { useGalleryStorage, type GalleryItem } from '../queries/useGalleryStorage';       // ativo — leitura/remoção da galeria via hook dedicado

// --- Seed / Demo ---
export { useSeedDemo } from '../mutations/useSeedDemo';                 // ativo — semeia dados de demonstração
