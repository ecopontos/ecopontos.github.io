export interface SqlitePort {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[], options?: { bootstrap?: boolean }): Promise<void>;
    transaction<T>(callback: () => Promise<T>): Promise<T>;
}
