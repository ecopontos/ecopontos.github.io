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

    // Campos de checklist
    if (obj.items && Array.isArray(obj.items)) {
      return (obj.items as unknown[]).length === 0;
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
