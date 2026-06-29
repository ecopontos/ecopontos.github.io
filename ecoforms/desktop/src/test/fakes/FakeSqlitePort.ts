import type { SqlitePort } from '../../application/ports/SqlitePort';

type Row = Record<string, unknown>;

export class FakeSqlitePort implements SqlitePort {
    public queryCalls: Array<{ sql: string; params: unknown[] }> = [];
    public executeCalls: Array<{ sql: string; params: unknown[] }> = [];
    private readonly queryResults = new Map<string, Row[]>();

    setQueryResult(sql: string, rows: Row[]): void {
        this.queryResults.set(sql, rows);
    }

    async query<T = unknown>(sql: string, params: unknown[] = [], _options?: { bootstrap?: boolean }): Promise<T[]> {
        this.queryCalls.push({ sql, params });
        return (this.queryResults.get(sql) ?? []) as T[];
    }

    async all<T = unknown>(sql: string, params: unknown[] = [], options?: { bootstrap?: boolean }): Promise<T[]> {
        return this.query<T>(sql, params, options);
    }

    async execute(sql: string, params: unknown[] = [], _options?: { bootstrap?: boolean }): Promise<void> {
        this.executeCalls.push({ sql, params });
    }

    async transaction<T>(callback: (tx: SqlitePort) => Promise<T>): Promise<T> {
        return callback(this);
    }
}
