import { promisify } from 'util';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sqlite3 = require('sqlite3') as {
    Database: new (filename: string) => InstanceType<typeof import('sqlite3').Database>;
    RunResult: unknown;
};

export interface MemoryDb {
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<void>;
    close(): Promise<void>;
}

export async function createMemoryDb(ddlStatements: string[] = []): Promise<MemoryDb> {
    const db = new sqlite3.Database(':memory:');
    const all = promisify(db.all.bind(db)) as unknown as
        (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
    const run = promisify(db.run.bind(db)) as unknown as
        (sql: string, params?: unknown[]) => Promise<{ lastID: number; changes: number }>;
    const close = promisify(db.close.bind(db)) as unknown as () => Promise<void>;

    for (const ddl of ddlStatements) {
        await run(ddl);
    }

    return {
        query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
            return (await all(sql, params)) as T[];
        },
        execute: async (sql: string, params: unknown[] = []) => {
            await run(sql, params);
        },
        close: async () => {
            await close();
        },
    };
}
