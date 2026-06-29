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
export { useRemocaoAnalytics } from '../queries/useRemocaoAnalytics'; // ativo — analytics de remoção por ecoponto

// --- Sync Externo ---
export { useExternalRoteiroSync } from '../queries/useExternalRoteiroSync'; // ativo — sincronização com PG externo
export { useExternalPesagensSync } from '../queries/useExternalPesagensSync'; // ativo — sincronização de pesagens com PG externo

// --- Mapa geo ---
export {
  useClientesGeo,
  useTerrenos,
  useTerrenosInViewport,
  useTerrenosExtent,
  useGeoLayers,
  useItinerario,
  useExecucaoGeo,
  useIntercorrenciasGeo,
  useChecklistGeo,
  saveGeoLayer,
  toggleGeoLayerVisivel,
  deleteGeoLayer,
  computeCentroid,
  computeAreaM2,
  saveTerrenosBatch,
  deleteTerrenoById,
  type ClienteGeo,
  type TerrenoGeo,
  type GeoLayer,
  type ItinerarioStop,
  type ExecucaoClienteGeo,
  type IntercorrenciaGeo,
  type ChecklistGeo,
} from '../queries/useMapData'; // ativo

// --- Clientes de execução ---
export { useExecucoesClientes } from '../queries/useExecucoesClientes'; // ativo
export { useExecucaoClientes } from '../queries/useExecucaoClientes';   // ativo
export { useExecucaoClientesMutations } from '../mutations/useExecucaoClientesMutations'; // ativo

// --- Sync legado ---
export {
  usePgLegacyConfig,
  useLegacySyncData,
  useLegacySyncActions,
  DEFAULT_FILTERS,
  type PgLegacyConfig,
  type PgLegacyConfigInput,
  type LegacySyncFilters,
  type RoteiroRow,
  type PesagemRow,
} from '../queries/useLegacySyncData'; // ativo
export { useExternalResiduos } from '../queries/useExternalResiduos'; // ativo

// --- Mutations ---
export { useLogisticsMutations } from '../mutations/useLogisticsMutations'; // ativo
