import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryDb, type MemoryDb } from '../../../../../test/sqliteMemory';
import { KANBAN_LOOKUP_FORMS } from '../kanban';

const DDL_REGISTRO_FORMULARIOS = `
    CREATE TABLE registro_formularios (
        form_id TEXT PRIMARY KEY,
        titulo  TEXT,
        ativo   INTEGER DEFAULT 1
    )`;

describe('KANBAN_LOOKUP_FORMS', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('retorna apenas formulários ativos como {value, label}', async () => {
        db = await createMemoryDb([DDL_REGISTRO_FORMULARIOS]);
        await db.execute("INSERT INTO registro_formularios (form_id, titulo, ativo) VALUES ('f1', 'Form Um', 1)");
        await db.execute("INSERT INTO registro_formularios (form_id, titulo, ativo) VALUES ('f2', 'Form Dois', 0)");

        const rows = await db.query<{ value: string; label: string }>(KANBAN_LOOKUP_FORMS.sql);

        expect(rows).toEqual([{ value: 'f1', label: 'Form Um' }]);
    });
});
