/**
 * Type definitions for data registry
 */

export interface DataRegistryItem {
    id: string;
    tipo: string;
    conteudo: any;
    versao: string;
    criado_em?: string;
    atualizado_em?: string;
}

export interface DataSourceOptions {
    /** Enable caching (default: true) */
    cache?: boolean;
    /** Fallback to expired cache if fetch fails (default: true) */
    fallbackToExpired?: boolean;
    /** Normalize data to standard format (default: true) */
    normalize?: boolean;
}

export interface CachedData {
    content: any;
    timestamp: number;
}
