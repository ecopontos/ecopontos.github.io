import { describe, expect, it } from 'vitest';
import type { SqlitePort } from '../../../../application/ports/SqlitePort';
import { SqliteSuiteRepository } from '../SqliteSuiteRepository';

class RecordingSqlite implements SqlitePort {
    readonly executes: Array<{ sql: string; params: unknown[] }> = [];

    async query<T = unknown>(): Promise<T[]> {
        return [];
    }

    async all<T = unknown>(): Promise<T[]> {
        return [];
    }

    async execute(sql: string, params: unknown[] = []): Promise<void> {
        this.executes.push({ sql, params });
    }

    async transaction<T>(callback: (tx: SqlitePort) => Promise<T>): Promise<T> {
        return callback(this);
    }
}

describe('SqliteSuiteRepository', () => {
    it('appendHistory() usa as colunas canonicas de historico_pacotes', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteSuiteRepository(db);

        await repo.appendHistory({
            packageId: 'pkg-1',
            versionFrom: 2,
            versionTo: 3,
            statusAnterior: 'pending_review',
            statusNovo: 'current',
            alteradoPor: 'user-1',
            motivo: 'aprovado',
            transferType: 'share',
        });

        expect(db.executes).toHaveLength(1);
        const { sql, params } = db.executes[0];
        const normalizedSql = sql.replace(/\s+/g, ' ');
        expect(normalizedSql).toContain('INSERT INTO historico_pacotes');
        expect(normalizedSql).toContain('id, registro_id, status_anterior, status_novo, alterado_por, motivo, metadados, id_pacote, versao_de, versao_para, tipo_transferencia');
        expect(normalizedSql).not.toContain('package_id');
        expect(normalizedSql).not.toContain('version_from');
        expect(normalizedSql).not.toContain('transfer_type');
        expect(typeof params[0]).toBe('string');
        expect((params[0] as string).length).toBeGreaterThan(0);
        expect(params.slice(1)).toEqual([
            'pkg-1',
            'pending_review',
            'current',
            'user-1',
            'aprovado',
            null,
            'pkg-1',
            2,
            3,
            'share',
        ]);
    });
});

