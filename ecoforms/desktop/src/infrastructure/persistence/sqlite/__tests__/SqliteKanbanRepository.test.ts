import { describe, expect, it } from 'vitest';
import type { SqlitePort } from '../../../../application/ports/SqlitePort';
import { SqliteKanbanRepository } from '../SqliteKanbanRepository';

class RecordingSqlite implements SqlitePort {
    readonly queries: Array<{ sql: string; params: unknown[] }> = [];

    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        this.queries.push({ sql, params });
        return [];
    }

    async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        return this.query(sql, params);
    }

    async execute(): Promise<void> {}

    async transaction<T>(callback: () => Promise<T>): Promise<T> {
        return callback();
    }
}

describe('SqliteKanbanRepository', () => {
    it('mantem os parametros do baseSelect antes do filtro por projeto', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteKanbanRepository(db);

        await repo.getKanbanData('user-1', 'admin', null, true, false, [], false, 'project-1');

        const taskQuery = db.queries.find((q) => q.sql.includes('FROM tarefas t'));
        expect(taskQuery?.params.slice(0, 5)).toEqual(['user-1', 'user-1', 'user-1', 'user-1', 'project-1']);
    });
});