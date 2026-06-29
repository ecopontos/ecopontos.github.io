/**
 * Catálogo: Manifestações (Ouvidoria)
 *
 * Hooks para o fluxo completo de manifestações: criação, tramitação,
 * respostas, despachos, anexos, prazos, envios e cobranças.
 */

// --- Queries principais ---
export {
  useManifestacoes,                 // ativo — lista com filtros
  useManifestacaoById,              // ativo — detalhe por ID
  useManifestacaoByProtocolo,       // ativo — busca por protocolo
  useManifestacaoTramitacoes,       // ativo — histórico de tramitações
  useManifestacaoRespostas,         // ativo — respostas registradas
  useManifestacaoDespachos,         // ativo — despachos internos
  useManifestacaoAnexos,            // ativo — arquivos anexados
  useManifestacaoPrazos,            // ativo — prazos e SLAs
  useManifestacaoEnvios,            // ativo — registros de envio (e-mail/WhatsApp)
  useManifestacaoCobranças,         // ativo — cobranças vinculadas
} from '../queries/useManifestacoes';
export { useNotificacoesSolicitante } from '../queries/useNotificacoesSolicitante'; // ativo — notificações enviadas ao solicitante

// --- Catálogos e classificação ---
export { useManifestacaoCatalogos } from '../queries/useManifestacaoCatalogos'; // ativo
export {
  useSubassuntos,                   // ativo — hierarquia de assuntos
  useSubunidades,                   // ativo — hierarquia de unidades
  useProgramasOrcamentarios,        // ativo — programas orçamentários
  useModelosResposta,               // ativo — templates de resposta
} from '../queries/useClassificacaoAdmin';

// --- Mutations ---
export { useManifestacaoMutations } from '../mutations/useManifestacaoMutations'; // ativo
