/**
 * Tipos base do catálogo de queries SQL.
 */

/** Uso primário da query no sistema */
export type QueryUse =
  | 'operacional'  // CRUD / listagem transacional, sem agregação
  | 'dashboard'    // painel — retorna série ou resumo para visualização
  | 'medida';      // medida implícita — agregação escalar para widgets

/**
 * Definição autocontida de uma query SQL.
 * O campo `sql` é sempre parametrizado (usa `?` — nunca interpola valores diretamente).
 * `params` documenta os nomes dos parâmetros na ordem em que aparecem.
 */
export interface QueryDef {
  /** SQL parametrizado (SQLite) */
  sql: string;
  /** O que a query retorna — descrição em linguagem natural */
  description: string;
  /** Nomes dos parâmetros em ordem (mesma ordem dos `?` no SQL) */
  params: string[];
  /** Uso primário */
  use: QueryUse;
  /**
   * Tipo do resultado esperado por linha.
   * Tipagem em runtime é string; o genérico TRow serve para inferência.
   */
  returns?: string;
}

/**
 * Índice tipado do catálogo.
 * Chaves em SCREAMING_SNAKE_CASE identificam a query no sistema.
 */
export type QueryCatalog = Record<string, QueryDef>;
