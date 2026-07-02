import { describe, it, expect, afterEach } from 'vitest';
import { ensureColumns } from '@/scripts/ensure-columns';
import { createMemoryDb, type MemoryDb } from '../sqliteMemory';

describe('ensureColumns — proveniência de geocodificação em clientes (Fase 1)', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('adiciona as colunas geocode_* em clientes e é idempotente ao rodar duas vezes seguidas', async () => {
        db = await createMemoryDb();

        // Primeira execução: cria a tabela do zero e adiciona as colunas via guard.
        await expect(ensureColumns(db.query, db.execute)).resolves.not.toThrow();

        // Segunda execução: ADD COLUMN deve falhar internamente (coluna já existe) e ser
        // engolido pelo .catch(() => {}) do próprio ensure-columns.ts — não deve propagar erro.
        await expect(ensureColumns(db.query, db.execute)).resolves.not.toThrow();

        const columns = await db.query<{ name: string }>("SELECT name FROM pragma_table_info('clientes')");
        const names = columns.map(c => c.name);

        expect(names).toEqual(
            expect.arrayContaining([
                'geocode_provider',
                'geocode_source_query',
                'geocode_display_name',
                'geocode_precision',
                'geocode_at',
                'geocode_confidence',
                'geocode_validated_at',
                'geocode_validated_by',
            ]),
        );
    });
});
