/**
 * TaskCriadaPayload — cópia JS de ecoforms-core/sync/events/TaskCriadaPayload.ts
 * Mesmo padrão de CryptoLayer.js: standalone, sem import do pacote compilado.
 *
 * @typedef {Object} TaskCriadaFormulario
 * @property {string} formRegistryId
 * @property {number} ordem
 * @property {boolean} obrigatorio
 *
 * @typedef {Object} TaskCriadaPayload
 * @property {string} id
 * @property {string} titulo
 * @property {string|null} descricao
 * @property {'a_fazer'} status
 * @property {'baixa'|'media'|'alta'} prioridade
 * @property {string|null} setor_id
 * @property {string|null} atribuido_para
 * @property {string|null} prazo
 * @property {string} criado_por
 * @property {string} criado_em
 * @property {'demanda'|'agendamento'|'manifestacao'|'suite'|'manual'} origem_tipo
 * @property {string|null} origem_id
 * @property {TaskCriadaFormulario[]} formularios
 */

/**
 * Valida que um objeto tem os campos obrigatórios de TaskCriadaPayload.
 * @param {unknown} data
 * @returns {data is TaskCriadaPayload}
 */
export function isTaskCriadaPayload(data) {
    if (!data || typeof data !== 'object') return false;
    const d = /** @type {Record<string,unknown>} */ (data);
    return (
        typeof d.id === 'string' &&
        typeof d.titulo === 'string' &&
        d.status === 'a_fazer' &&
        typeof d.criado_por === 'string' &&
        typeof d.criado_em === 'string' &&
        typeof d.origem_tipo === 'string' &&
        Array.isArray(d.formularios)
    );
}
