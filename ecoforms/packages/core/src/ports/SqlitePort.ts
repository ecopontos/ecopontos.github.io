export interface SqliteBatchStatement {
    sql: string;
    params?: unknown[];
}

export interface SqliteQueryOptions {
    bootstrap?: boolean;
}

export interface SqlitePort {
    query<T = unknown>(sql: string, params?: unknown[], options?: SqliteQueryOptions): Promise<T[]>;
    all<T = unknown>(sql: string, params?: unknown[], options?: SqliteQueryOptions): Promise<T[]>;
    execute(sql: string, params?: unknown[], options?: { bootstrap?: boolean }): Promise<void>;
    transaction<T>(callback: (tx: SqlitePort) => Promise<T>): Promise<T>;
    transactionBatch?(statements: SqliteBatchStatement[], options?: { bootstrap?: boolean }): Promise<void>;
}
