import { describe, expect, it } from 'vitest';
import { SqliteTaskMetricsRepository } from '../../SqliteTaskMetricsRepository';
import {
    TAREFAS_RESUMO,
    TAREFAS_TENDENCIA_DIARIA,
} from '../tarefas';

describe('task metrics SQL', () => {
    it('uses the tarefas schema column atualizado_em, not updated_at', () => {
        expect(TAREFAS_RESUMO.sql).toContain('atualizado_em');
        expect(TAREFAS_TENDENCIA_DIARIA.sql).toContain('atualizado_em');
        expect(TAREFAS_RESUMO.sql).not.toContain('updated_at');
        expect(TAREFAS_TENDENCIA_DIARIA.sql).not.toContain('updated_at');
    });

    it('repository metrics queries use atualizado_em for completion dates', async () => {
        const queries: string[] = [];
        const db = {
            query: async <T>(sql: string): Promise<T[]> => {
                queries.push(sql);
                return [{
                    total: 0,
                    completed: 0,
                    in_progress: 0,
                    pending: 0,
                    overdue: 0,
                    completed_today: 0,
                    completed_week: 0,
                    completed_month: 0,
                    date: null,
                }] as T[];
            },
            execute: async () => {},
        };

        const repo = new SqliteTaskMetricsRepository(db as never);
        await repo.getSummary(30);
        await repo.getDailyTrends(30);

        expect(queries.join('\n')).toContain('atualizado_em');
        expect(queries.join('\n')).not.toContain('updated_at');
    });
});
