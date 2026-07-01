import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryDb, type MemoryDb } from '../sqliteMemory';

describe('createMemoryDb', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('cria tabelas via DDL e retorna linhas em query()', async () => {
        db = await createMemoryDb([
            'CREATE TABLE t (id TEXT PRIMARY KEY, nome TEXT, ativo INTEGER)',
        ]);
        await db.execute("INSERT INTO t (id, nome, ativo) VALUES ('1', 'a', 1)");
        await db.execute("INSERT INTO t (id, nome, ativo) VALUES ('2', 'b', 0)");

        const rows = await db.query<{ id: string }>('SELECT id FROM t WHERE ativo = 1');

        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe('1');
    });

    it('aceita zero statements (db vazio)', async () => {
        db = await createMemoryDb();
        const rows = await db.query<{ x: number }>('SELECT 1 AS x');
        expect(rows[0].x).toBe(1);
    });
});
