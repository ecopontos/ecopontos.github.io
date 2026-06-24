import { DataRegistryItem } from '../../../domain/data-registry/DataRegistryItem';
import type { DataRegistryRepository } from '../../../domain/data-registry/DataRegistryRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface RegistryRow {
    id: string;
    tipo: string;
    conteudo: string;
    criado_em: string | null;
    atualizado_em: string | null;
}

function rowToItem(row: RegistryRow): DataRegistryItem {
    let conteudo: unknown;
    try { conteudo = JSON.parse(row.conteudo); } catch { conteudo = row.conteudo; }
    return DataRegistryItem.fromProps({
        id: row.id,
        tipo: row.tipo,
        conteudo,
        criadoEm: row.criado_em ?? undefined,
        atualizadoEm: row.atualizado_em ?? undefined,
    });
}

export class SqliteDataRegistryRepository implements DataRegistryRepository {
    constructor(private readonly db: SqlitePort) {}

    async findByTipo(tipo: string): Promise<DataRegistryItem[]> {
        const rows = await this.db.query<RegistryRow>(
            `SELECT id, tipo, conteudo, criado_em, atualizado_em FROM registro_dados WHERE tipo = ? ORDER BY criado_em DESC`,
            [tipo],
        );
        return rows.map(rowToItem);
    }

    async findByTipoAndConteudo(tipo: string, conteudo: string): Promise<DataRegistryItem[]> {
        const rows = await this.db.query<RegistryRow>(
            `SELECT id, tipo, conteudo, criado_em, atualizado_em FROM registro_dados WHERE tipo = ? AND conteudo = ? ORDER BY criado_em DESC`,
            [tipo, conteudo],
        );
        return rows.map(rowToItem);
    }

    async findAllTypes(): Promise<string[]> {
        const rows = await this.db.query<{ tipo: string }>(
            `SELECT DISTINCT tipo FROM registro_dados ORDER BY tipo`,
        );
        return rows.map((r) => r.tipo);
    }

    async findAll(): Promise<DataRegistryItem[]> {
        const rows = await this.db.query<RegistryRow>(
            `SELECT id, tipo, conteudo, criado_em, atualizado_em FROM registro_dados ORDER BY tipo, criado_em DESC`,
        );
        return rows.map(rowToItem);
    }

    async findById(id: string): Promise<DataRegistryItem | null> {
        const rows = await this.db.query<RegistryRow>(
            `SELECT id, tipo, conteudo, criado_em, atualizado_em FROM registro_dados WHERE id = ? LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToItem(rows[0]) : null;
    }

    async save(item: DataRegistryItem): Promise<void> {
        const p = item.toProps();
        const conteudo = typeof p.conteudo === 'string' ? p.conteudo : JSON.stringify(p.conteudo ?? {});
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM registro_dados WHERE id = ? LIMIT 1`,
            [p.id],
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO registro_dados (id, tipo, conteudo, criado_em, atualizado_em)
                 VALUES (?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
                [p.id, p.tipo, conteudo, p.criadoEm ?? null],
            );
        } else {
            await this.db.execute(
                `UPDATE registro_dados SET tipo = ?, conteudo = ?, atualizado_em = datetime('now') WHERE id = ?`,
                [p.tipo, conteudo, p.id],
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM registro_dados WHERE id = ?`, [id]);
    }
}
