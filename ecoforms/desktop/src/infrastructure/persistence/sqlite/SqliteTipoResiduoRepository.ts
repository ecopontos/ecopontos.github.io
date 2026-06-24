import { TipoResiduo } from '../../../domain/tipo-residuo/TipoResiduo';
import type { TipoResiduoRepository } from '../../../domain/tipo-residuo/TipoResiduoRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface TipoResiduoRow {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    cor: string;
    ativo: number;
    criado_em: string;
}

function rowToEntity(row: TipoResiduoRow): TipoResiduo {
    return TipoResiduo.fromRow(row);
}

export class SqliteTipoResiduoRepository implements TipoResiduoRepository {
    constructor(private readonly db: SqlitePort) {}

    async findAll(): Promise<TipoResiduo[]> {
        const rows = await this.db.query<TipoResiduoRow>(
            `SELECT id, codigo, nome, descricao, cor, ativo, criado_em FROM tipos_residuo ORDER BY nome`
        );
        return rows.map(rowToEntity);
    }

    async findAtivos(): Promise<TipoResiduo[]> {
        const rows = await this.db.query<TipoResiduoRow>(
            `SELECT id, codigo, nome, descricao, cor, ativo, criado_em FROM tipos_residuo WHERE ativo = 1 ORDER BY nome`
        );
        return rows.map(rowToEntity);
    }

    async findById(id: string): Promise<TipoResiduo | null> {
        const rows = await this.db.query<TipoResiduoRow>(
            `SELECT id, codigo, nome, descricao, cor, ativo, criado_em FROM tipos_residuo WHERE id = ? LIMIT 1`,
            [id]
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async findByCodigo(codigo: string): Promise<TipoResiduo | null> {
        const rows = await this.db.query<TipoResiduoRow>(
            `SELECT id, codigo, nome, descricao, cor, ativo, criado_em FROM tipos_residuo WHERE codigo = ? LIMIT 1`,
            [codigo]
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async save(tipo: TipoResiduo): Promise<void> {
        const row = tipo.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM tipos_residuo WHERE id = ? LIMIT 1`,
            [row.id]
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO tipos_residuo (id, codigo, nome, descricao, cor, ativo, criado_em)
                 VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
                [row.id, row.codigo, row.nome, row.descricao, row.cor, row.ativo, row.criado_em]
            );
        } else {
            await this.db.execute(
                `UPDATE tipos_residuo SET codigo = ?, nome = ?, descricao = ?, cor = ?, ativo = ? WHERE id = ?`,
                [row.codigo, row.nome, row.descricao, row.cor, row.ativo, row.id]
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM tipos_residuo WHERE id = ?`, [id]);
    }
}
