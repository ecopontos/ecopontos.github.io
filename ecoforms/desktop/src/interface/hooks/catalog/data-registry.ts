/**
 * Catálogo: Data Registry
 *
 * Hooks para tipos, contagens, itens e operações em lote
 * no registro de dados dinâmicos.
 */

// --- Queries ---
export {
  useDataRegistryTypesNew,         // ativo — tipos disponíveis no registry
  useDataRegistryTypeCountsNew,    // ativo — contagem por tipo
} from '../queries/useDataRegistryTypes';

export { useDataRegistryAggregated } from '../queries/useDataRegistryAggregated'; // ativo — itens agregados por tipo
export {
  useDataRegistryItemsNew,                                               // ativo — itens por tipo com refetch
  type DataRegistryItemView,                                             // type — view de item do registry
} from '../queries/useDataRegistryItems';

// --- Mutations ---
export { useDataRegistryBulkInsert } from '../mutations/useDataRegistryBulkInsert'; // ativo — insert em lote

// --- Use cases (DI) ---
export { useDataRegistryUseCases } from '../domain/useDataRegistryUseCases';        // ativo
