/**
 * fieldValidation.js
 * Funções utilitárias para validação de campos de formulário
 */

/**
 * Verifica se um valor de campo está vazio/não preenchido
 * Suporta diferentes tipos de dados: string, array, object (presence, checklist, etc)
 * 
 * @param {*} value - Valor do campo a ser validado
 * @returns {boolean} - true se o campo está vazio, false se está preenchido
 */
export function isFieldEmpty(value) {
  // null ou undefined sempre são vazios
  if (value === null || value === undefined) {
    return true;
  }

  // String: verificar se está vazia após trim
  if (typeof value === 'string') {
    return value.trim() === '';
  }

  // Array: verificar se tem itens
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  // Object: verificar estruturas específicas
  if (typeof value === 'object') {
    // Campos de presença (presence-compact, presence-selector, etc)
    if (value.statuses && typeof value.statuses === 'object') {
      return Object.keys(value.statuses).length === 0;
    }

    // Campos de checklist
    if (value.items && Array.isArray(value.items)) {
      return value.items.length === 0;
    }

    // Objeto genérico: verificar se tem propriedades
    return Object.keys(value).length === 0;
  }

  // Booleano false é considerado preenchido (campo checkbox)
  if (typeof value === 'boolean') {
    return false;
  }

  // Número 0 é considerado preenchido
  if (typeof value === 'number') {
    return false;
  }

  // Qualquer outro tipo: verificar se é truthy
  return !value;
}

/**
 * Verifica se um valor de campo está preenchido/não vazio
 * 
 * @param {*} value - Valor do campo a ser validado
 * @returns {boolean} - true se o campo está preenchido, false se está vazio
 */
export function isFieldFilled(value) {
  return !isFieldEmpty(value);
}

/**
 * Valida um campo obrigatório
 * 
 * @param {*} value - Valor do campo
 * @param {string} fieldLabel - Label do campo (para mensagem de erro)
 * @returns {Object|null} - { valid: false, message: '...' } ou null se válido
 */
export function validateRequired(value, fieldLabel = 'Este campo') {
  if (isFieldEmpty(value)) {
    return {
      valid: false,
      message: `${fieldLabel} é obrigatório`
    };
  }
  return null;
}

/**
 * Valida múltiplos campos obrigatórios
 * 
 * @param {Array} fields - Array de objetos { id, value, label, required }
 * @returns {Array} - Array de campos inválidos com { id, label, message }
 */
export function validateRequiredFields(fields) {
  const invalidFields = [];

  fields.forEach(field => {
    if (field.required && isFieldEmpty(field.value)) {
      invalidFields.push({
        id: field.id,
        label: field.label || field.id,
        message: `${field.label || field.id} é obrigatório`
      });
    }
  });

  return invalidFields;
}

/**
 * Calcula o progresso de preenchimento do formulário
 * 
 * @param {Array} requiredFields - Array de campos obrigatórios { id, value }
 * @returns {number} - Percentual de 0 a 100
 */
export function calculateFormProgress(requiredFields) {
  if (!requiredFields || requiredFields.length === 0) {
    return 100;
  }

  const completedFields = requiredFields.filter(field => {
    return isFieldFilled(field.value);
  });

  return Math.round((completedFields.length / requiredFields.length) * 100);
}

/**
 * Extrai resumo de um campo de presença
 * 
 * @param {Object} presenceValue - Valor do campo presence
 * @returns {Object} - { total, presente, ausente, desligado }
 */
export function getPresenceSummary(presenceValue) {
  if (!presenceValue || !presenceValue.statuses) {
    return { total: 0, presente: 0, ausente: 0, desligado: 0 };
  }

  const statuses = presenceValue.statuses;
  const summary = {
    total: Object.keys(statuses).length,
    presente: 0,
    ausente: 0,
    desligado: 0
  };

  Object.values(statuses).forEach(status => {
    if (status === 'presente') summary.presente++;
    else if (status === 'ausente') summary.ausente++;
    else if (status === 'desligado') summary.desligado++;
  });

  return summary;
}

export default {
  isFieldEmpty,
  isFieldFilled,
  validateRequired,
  validateRequiredFields,
  calculateFormProgress,
  getPresenceSummary
};
