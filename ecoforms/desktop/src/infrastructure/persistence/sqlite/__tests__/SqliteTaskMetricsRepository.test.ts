import { describe, expect, it } from 'vitest';
import type { SqlitePort } from '../../../../application/ports/SqlitePort';
import { SqliteTaskMetricsRepository } from '../SqliteTaskMetricsRepository';

class RecordingSqlite implements SqlitePort {
    readonly queries: Array<{ sql: string; params: unknown[] }> = [];

    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        this.queries.push({ sql, params });
        if (/daily|date\(/i.test(sql) && /GROUP BY/i.test(sql)) {
            return [] as T[];
        }
        return [{
            total: 0,
            completed: 0,
            in_progress: 0,
            pending: 0,
            overdue: 0,
            completed_today: 0,
            completed_week: 0,
            completed_month: 0,
        }] as T[];
    }

    async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        return this.query(sql, params);
    }

    async execute(): Promise<void> {}

    async transaction<T>(callback: () => Promise<T>): Promise<T> {
        return callback();
    }
}

describe('SqliteTaskMetricsRepository', () => {
    it('usa colunas standalone e exclui tarefas deletadas no resumo', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteTaskMetricsRepository(db);

        await repo.getSummary(30);

        const sql = db.queries[0].sql;
        expect(sql).toContain('atualizado_em');
        expect(sql).not.toContain('updated_at');
        expect(sql).toContain('deletado_em IS NULL');
    });

    it('usa atualizado_em e exclui deletadas na tendencia diaria', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteTaskMetricsRepository(db);

        await repo.getDailyTrends(30);

        const sql = db.queries[0].sql;
        expect(sql).toContain('atualizado_em');
        expect(sql).not.toContain('updated_at');
        expect(sql).toContain('deletado_em IS NULL');
    });
});
