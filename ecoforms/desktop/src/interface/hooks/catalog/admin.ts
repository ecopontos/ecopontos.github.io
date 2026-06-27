/**
 * Catalogo: Administracao
 *
 * Hooks para cadastros administrativos transversais.
 */

// --- Escalas ---
export { useEscalas, type Escala } from '../queries/useEscalas';

// --- Prazos ---
export { useTiposPrazo } from '../queries/useTiposPrazo';
export { useSaveTipoPrazo, useDeleteTipoPrazo } from '../mutations/useSaveTipoPrazo';

// --- Perfis ---
export { useHierarquiaPerfis } from '../queries/useHierarquiaPerfis';
export { useSaveHierarquiaPerfil, useDeleteHierarquiaPerfil } from '../mutations/useSaveHierarquiaPerfil';

// --- E-mail ---
export { useEmailConfig } from '../queries/useEmailConfig';
export { useSaveEmailConfig } from '../mutations/useSaveEmailConfig';
