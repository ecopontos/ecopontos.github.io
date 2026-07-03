import { describe, it, expect, afterEach } from 'vitest';
import { ensureColumns } from '@/scripts/ensure-columns';
import { createMemoryDb, type MemoryDb } from '../../../../test/sqliteMemory';
import { SqliteClienteRepository } from '../SqliteClienteRepository';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';

/**
 * Teste de integração (SQLite real em memória) — cobre o gap apontado na revisão
 * final de branch: os testes existentes de SqliteClienteRepository mockam
 * SqlitePort e só verificam o formato do SQL, nunca executam a SQL de
 * resolução de "vínculo principal" contra um schema real. Esse gap escondeu
 * o bug de `linkClienteToImovel` não desmarcar outros vínculos principais do
 * mesmo cliente, permitindo 2 linhas `principal = 1` simultâneas — o que faz
 * os JOINs de geo-resolução (CLIENTES_GEO, ROTEIRO_CLIENTES_ITINERARIO etc.)
 * duplicarem linhas por cliente.
 */
describe('SqliteClienteRepository.linkClienteToImovel — unicidade de principal (integração SQLite real)', () => {
    let db: MemoryDb;
    let repo: SqliteClienteRepository;

    afterEach(async () => {
        if (db) await db.close();
    });

    async function setup() {
        db = await createMemoryDb();
        await ensureColumns(db.query, db.execute);
        repo = new SqliteClienteRepository(db as unknown as SqlitePort);

        await db.execute(
            `INSERT INTO clientes (id, tipo, nome) VALUES (?, ?, ?)`,
            ['cli-1', 'PF', 'Cliente Teste']
        );
        await db.execute(
            `INSERT INTO terrenos (id, nome, geojson) VALUES (?, ?, ?)`,
            ['ter-1', 'Terreno 1', '{}']
        );
        await db.execute(
            `INSERT INTO terrenos (id, nome, geojson) VALUES (?, ?, ?)`,
            ['ter-2', 'Terreno 2', '{}']
        );
    }

    it('desmarca o vínculo principal anterior ao vincular um novo imóvel como principal', async () => {
        await setup();

        await repo.linkClienteToImovel('cli-1', 'ter-1', 'proprietario', true, 'alta', 'manual');
        await repo.linkClienteToImovel('cli-1', 'ter-2', 'proprietario', true, 'alta', 'manual');

        const principais = await db.query<{ id: string; imovel_id: string; principal: number }>(
            'SELECT id, imovel_id, principal FROM cliente_imovel_vinculos WHERE cliente_id = ? AND principal = 1',
            ['cli-1']
        );

        expect(principais).toHaveLength(1);
        expect(principais[0].imovel_id).toBe('ter-2');

        const cliente = await db.query<{ terreno_id: string | null }>(
            'SELECT terreno_id FROM clientes WHERE id = ?',
            ['cli-1']
        );
        expect(cliente[0].terreno_id).toBe('ter-2');
    });
});
