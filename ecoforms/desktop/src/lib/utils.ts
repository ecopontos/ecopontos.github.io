import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Verifica se um valor de campo está vazio/não preenchido
 * Suporta diferentes tipos de dados: string, array, object (presence, checklist, etc)
 *
 * @param value - Valor do campo a ser validado
 * @returns true se o campo está vazio, false se está preenchido
 */
export function isFieldEmpty(value: unknown): boolean {
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
    const obj = value as Record<string, unknown>;
    // Campos de presença (presence-compact, presence-selector, etc)
    if (obj.statuses && typeof obj.statuses === 'object') {
      return Object.keys(obj.statuses as object).length === 0;
    }

    // Campos de checklist (vistoria_checklist): o renderer salva `items` como um
    // Record<itemId, ItemState> (objeto), nao como array. Aceitamos ambas as formas
    // aqui para robustez: array => length 0; record => nenhuma key vistoriada.
    if (obj.items !== undefined && obj.items !== null) {
      if (Array.isArray(obj.items)) {
        return (obj.items as unknown[]).length === 0;
      }
      if (typeof obj.items === 'object') {
        const items = obj.items as Record<string, unknown>;
        // Vazio se nao houver itens OU se nenhum tiver status preenchido (conforme/
        // nao_conforme/na). Um checklist com todos os itens em branco nao conta como
        // preenchido para validacao required.
        const entries = Object.values(items);
        if (entries.length === 0) return true;
        const anyVistoriado = entries.some(v => {
          if (v && typeof v === 'object') {
            const s = (v as Record<string, unknown>).status;
            return s === 'conforme' || s === 'nao_conforme' || s === 'na';
          }
          return false;
        });
        return !anyVistoriado;
      }
    }

    // Objeto genérico: verificar se tem propriedades
    return Object.keys(obj).length === 0;
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
