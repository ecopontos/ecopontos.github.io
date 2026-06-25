import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { EcopontoRepository } from '../../../domain/ecoponto/EcopontoRepository';
import type { Ecoponto } from '../../../domain/ecoponto/Ecoponto';

interface EcopontoRow {
    id: string;
    nome: string;
    endereco: string | null;
    setor_id: string | null;
    ativo: number;
    criado_em: string | null;
    atualizado_em: string | null;
}

function rowToEcoponto(row: EcopontoRow): Ecoponto {
    return {
        id: row.id,
        nome: row.nome,
        endereco: row.endereco,
        setorId: row.setor_id,
        ativo: row.ativo,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
    };
}

export class SqliteEcopontoRepository implements EcopontoRepository {
    constructor(private readonly db: SqlitePort) {}

    async findAll(apenasAtivos = true): Promise<Ecoponto[]> {
        const sql = apenasAtivos
            ? 'SELECT * FROM ecopontos WHERE ativo = 1 ORDER BY nome'
            : 'SELECT * FROM ecopontos ORDER BY nome';
        const rows = await this.db.query<EcopontoRow>(sql, []);
        return rows.map(rowToEcoponto);
    }

    async findById(id: string): Promise<Ecoponto | null> {
        const rows = await this.db.query<EcopontoRow>(
            'SELECT * FROM ecopontos WHERE id = ? LIMIT 1',
            [id],
        );
        return rows[0] ? rowToEcoponto(rows[0]) : null;
    }

    async save(ecoponto: Ecoponto): Promise<void> {
        const now = new Date().toISOString();
        const exists = await this.db.query<{ count: number }>(
            'SELECT COUNT(*) as count FROM ecopontos WHERE id = ?',
            [ecoponto.id],
        );
        if (exists[0]?.count > 0) {
            await this.db.execute(
                `UPDATE ecopontos SET nome = ?, endereco = ?, setor_id = ?, ativo = ?, atualizado_em = ? WHERE id = ?`,
                [ecoponto.nome, ecoponto.endereco ?? null, ecoponto.setorId ?? null, ecoponto.ativo, now, ecoponto.id],
            );
        } else {
            await this.db.execute(
                `INSERT INTO ecopontos (id, nome, endereco, setor_id, ativo, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [ecoponto.id, ecoponto.nome, ecoponto.endereco ?? null, ecoponto.setorId ?? null, ecoponto.ativo, now, now],
            );
        }
    }
}
