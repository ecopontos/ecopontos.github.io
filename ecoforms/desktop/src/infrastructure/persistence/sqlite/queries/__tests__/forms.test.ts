import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryDb, type MemoryDb } from '../../../../../test/sqliteMemory';
import { FORMS_ATIVOS } from '../forms';

const DDL_REGISTRO_FORMULARIOS = `
    CREATE TABLE registro_formularios (
        form_id TEXT PRIMARY KEY,
        titulo  TEXT,
        conteudo TEXT,
        ativo   INTEGER DEFAULT 1
    )`;

describe('FORMS_ATIVOS', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('lista formulários ativos com form_id e titulo', async () => {
        db = await createMemoryDb([DDL_REGISTRO_FORMULARIOS]);
        await db.execute("INSERT INTO registro_formularios (form_id, titulo, conteudo, ativo) VALUES ('f1', 'Um', '{}', 1)");
        await db.execute("INSERT INTO registro_formularios (form_id, titulo, conteudo, ativo) VALUES ('f2', 'Dois', '{}', 0)");

        const rows = await db.query<{ form_id: string; titulo: string }>(FORMS_ATIVOS.sql);

        expect(rows.map((r) => r.form_id)).toEqual(['f1']);
    });
});
