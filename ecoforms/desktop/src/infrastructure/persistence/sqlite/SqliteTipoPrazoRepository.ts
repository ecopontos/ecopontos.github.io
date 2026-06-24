import { TipoPrazo } from '../../../domain/tipo-prazo/TipoPrazo';
import type { TipoPrazoRepository } from '../../../domain/tipo-prazo/TipoPrazoRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface TipoPrazoRow {
    id: string;
    nome: string;
    dias_padrao: number | null;
    ativo: number;
    criado_em: string;
}

function rowToEntity(row: TipoPrazoRow): TipoPrazo {
    return TipoPrazo.fromRow(row);
}

export class SqliteTipoPrazoRepository implements TipoPrazoRepository {
    constructor(private readonly db: SqlitePort) {}

    async findAll(): Promise<TipoPrazo[]> {
        const rows = await this.db.query<TipoPrazoRow>(
            `SELECT id, nome, dias_padrao, ativo, criado_em FROM tipos_prazo ORDER BY nome`
        );
        return rows.map(rowToEntity);
    }

    async findAtivos(): Promise<TipoPrazo[]> {
        const rows = await this.db.query<TipoPrazoRow>(
            `SELECT id, nome, dias_padrao, ativo, criado_em FROM tipos_prazo WHERE ativo = 1 ORDER BY nome`
        );
        return rows.map(rowToEntity);
    }

    async findById(id: string): Promise<TipoPrazo | null> {
        const rows = await this.db.query<TipoPrazoRow>(
            `SELECT id, nome, dias_padrao, ativo, criado_em FROM tipos_prazo WHERE id = ? LIMIT 1`,
            [id]
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async save(tipo: TipoPrazo): Promise<void> {
        const row = tipo.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM tipos_prazo WHERE id = ? LIMIT 1`,
            [row.id]
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO tipos_prazo (id, nome, dias_padrao, ativo, criado_em) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`,
                [row.id, row.nome, row.dias_padrao, row.ativo, row.criado_em]
            );
        } else {
            await this.db.execute(
                `UPDATE tipos_prazo SET nome = ?, dias_padrao = ?, ativo = ? WHERE id = ?`,
                [row.nome, row.dias_padrao, row.ativo, row.id]
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM tipos_prazo WHERE id = ?`, [id]);
    }
}
