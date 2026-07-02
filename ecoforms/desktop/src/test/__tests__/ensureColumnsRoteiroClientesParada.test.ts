import { describe, it, expect, afterEach } from 'vitest';
import { ensureColumns } from '@/scripts/ensure-columns';
import { createMemoryDb, type MemoryDb } from '../sqliteMemory';

describe('ensureColumns — override de localização por parada (Fase 3 logística)', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('adiciona imovel_id e ponto_operacional_id em roteiro_clientes e é idempotente ao rodar duas vezes seguidas', async () => {
        db = await createMemoryDb();

        await expect(ensureColumns(db.query, db.execute)).resolves.not.toThrow();
        await expect(ensureColumns(db.query, db.execute)).resolves.not.toThrow();

        const columns = await db.query<{ name: string }>("SELECT name FROM pragma_table_info('roteiro_clientes')");
        const names = columns.map(c => c.name);

        expect(names).toEqual(
            expect.arrayContaining(['imovel_id', 'ponto_operacional_id']),
        );
    });
});
