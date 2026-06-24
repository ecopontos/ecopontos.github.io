/**
 * Catálogo: Logística
 *
 * Hooks para roteiros de coleta, execuções de campo,
 * checklists, histórico e intercorrências.
 */

// --- Queries de roteiros e execuções ---
export {
  useRoteiros,              // ativo — lista de roteiros com filtros
  useRoteiroById,           // ativo — detalhe do roteiro
  useExecucoes,             // ativo — execuções de roteiro
  useClientesByRoteiro,     // ativo — clientes associados ao roteiro
} from '../queries/useLogistics';

// --- Checklist de execução ---
export { useChecklistByExecucao } from '../queries/useChecklist';           // ativo

// --- Histórico de execução ---
export { useHistoricoByExecucao } from '../queries/useHistorico';           // ativo

// --- Intercorrências de execução ---
export { useIntercorrenciasByExecucao } from '../queries/useIntercorrencias'; // ativo

// --- Pesagens de execução (despacho/balança externos) ---
export { usePesagensByExecucao } from '../queries/useExecucaoPesagens'; // ativo

// --- Sync Externo ---
export { useExternalRoteiroSync } from '../queries/useExternalRoteiroSync'; // ativo — sincronização com PG externo
export { useExternalPesagensSync } from '../queries/useExternalPesagensSync'; // ativo — sincronização de pesagens com PG externo

// --- Mapa geo ---
export { useClientesGeo, useGeoLayers, saveGeoLayer, toggleGeoLayerVisivel, deleteGeoLayer } from '../queries/useMapData'; // ativo

// --- Mutations ---
export { useLogisticsMutations } from '../mutations/useLogisticsMutations'; // ativo
