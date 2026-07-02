import { describe, it, expect, afterEach } from 'vitest';
import { ensureColumns } from '@/scripts/ensure-columns';
import { createMemoryDb, type MemoryDb } from '../sqliteMemory';

describe('ensureColumns — evidência GPS de campo (Fase 5, parte Desktop)', () => {
    let db: MemoryDb;
    afterEach(async () => { if (db) await db.close(); });

    it('cria imovel_gps_evidencias com as colunas esperadas e é idempotente ao rodar duas vezes seguidas', async () => {
        db = await createMemoryDb();

        await expect(ensureColumns(db.query, db.execute)).resolves.not.toThrow();
        await expect(ensureColumns(db.query, db.execute)).resolves.not.toThrow();

        const columns = await db.query<{ name: string }>("SELECT name FROM pragma_table_info('imovel_gps_evidencias')");
        const names = columns.map(c => c.name);

        expect(names).toEqual(
            expect.arrayContaining([
                'id',
                'imovel_id',
                'cliente_id',
                'latitude',
                'longitude',
                'accuracy',
                'provider',
                'altitude',
                'heading',
                'capturado_em',
                'origem',
                'criado_em',
            ]),
        );
    });

    it('rejeita origem fora do enum (CHECK constraint)', async () => {
        db = await createMemoryDb();
        await ensureColumns(db.query, db.execute);

        await expect(db.execute(
            `INSERT INTO imovel_gps_evidencias (id, cliente_id, latitude, longitude, origem, criado_em)
             VALUES ('gps-1', 'cli-1', -23.5, -46.6, 'invalida', datetime('now'))`
        )).rejects.toThrow();
    });

    it('aceita origem manual e mobile_campo', async () => {
        db = await createMemoryDb();
        await ensureColumns(db.query, db.execute);

        await expect(db.execute(
            `INSERT INTO imovel_gps_evidencias (id, cliente_id, latitude, longitude, origem, criado_em)
             VALUES ('gps-1', 'cli-1', -23.5, -46.6, 'manual', datetime('now'))`
        )).resolves.not.toThrow();
        await expect(db.execute(
            `INSERT INTO imovel_gps_evidencias (id, cliente_id, latitude, longitude, origem, criado_em)
             VALUES ('gps-2', 'cli-1', -23.5, -46.6, 'mobile_campo', datetime('now'))`
        )).resolves.not.toThrow();
    });
});
