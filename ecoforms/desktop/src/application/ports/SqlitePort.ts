import type {
    SqliteBatchStatement as CoreSqliteBatchStatement,
    SqlitePort as CoreSqlitePort,
} from 'ecoforms-core';

export type SqliteBatchStatement = CoreSqliteBatchStatement;

export interface SqliteQueryOptions {
    bootstrap?: boolean;
}

export interface SqlitePort extends CoreSqlitePort {
    query<T = unknown>(sql: string, params?: unknown[], options?: SqliteQueryOptions): Promise<T[]>;
    all<T = unknown>(sql: string, params?: unknown[], options?: SqliteQueryOptions): Promise<T[]>;
}
