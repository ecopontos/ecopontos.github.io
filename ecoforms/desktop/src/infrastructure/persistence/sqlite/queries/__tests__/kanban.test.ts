import { describe, it, expect, afterEach } from 'vitest';
import { createMemoryDb, type MemoryDb } from '../../../../../test/sqliteMemory';
import { KANBAN_LOOKUP_FORMS, KANBAN_LOOKUP_USUARIOS, KANBAN_LOOKUP_PROJETOS } from '../kanban';

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

const DDL_USUARIOS = `CREATE TABLE usuarios (id TEXT PRIMARY KEY, nome TEXT, ativo INTEGER DEFAULT 1)`;

describe('KANBAN_LOOKUP_USUARIOS', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('lista apenas usuários ativos', async () => {
        db = await createMemoryDb([DDL_USUARIOS]);
        await db.execute("INSERT INTO usuarios (id, nome, ativo) VALUES ('u1', 'Ana', 1)");
        await db.execute("INSERT INTO usuarios (id, nome, ativo) VALUES ('u2', 'Bo', 0)");

        const rows = await db.query<{ value: string; label: string }>(KANBAN_LOOKUP_USUARIOS.sql);

        expect(rows).toEqual([{ value: 'u1', label: 'Ana' }]);
    });
});

const DDL_PROJETOS = `CREATE TABLE projetos (id TEXT PRIMARY KEY, nome TEXT, arquivado_em TEXT)`;

describe('KANBAN_LOOKUP_PROJETOS', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('lista apenas projetos não-arquivados (arquivado_em IS NULL)', async () => {
        db = await createMemoryDb([DDL_PROJETOS]);
        await db.execute("INSERT INTO projetos (id, nome, arquivado_em) VALUES ('p1', 'Alpha', NULL)");
        await db.execute("INSERT INTO projetos (id, nome, arquivado_em) VALUES ('p2', 'Beta', '2026-01-01T00:00:00Z')");

        const rows = await db.query<{ value: string; label: string }>(KANBAN_LOOKUP_PROJETOS.sql);

        expect(rows).toEqual([{ value: 'p1', label: 'Alpha' }]);
    });
});
