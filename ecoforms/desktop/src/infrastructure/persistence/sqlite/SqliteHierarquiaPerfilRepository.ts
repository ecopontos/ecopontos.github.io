import { HierarquiaPerfil } from '../../../domain/hierarquia-perfil/HierarquiaPerfil';
import type { HierarquiaPerfilRepository } from '../../../domain/hierarquia-perfil/HierarquiaPerfilRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface HierarquiaRow {
    perfil: string;
    nivel: number;
    descricao: string | null;
}

function rowToEntity(row: HierarquiaRow): HierarquiaPerfil {
    return HierarquiaPerfil.fromRow(row);
}

export class SqliteHierarquiaPerfilRepository implements HierarquiaPerfilRepository {
    constructor(private readonly db: SqlitePort) {}

    async findAll(): Promise<HierarquiaPerfil[]> {
        const rows = await this.db.query<HierarquiaRow>(
            `SELECT perfil, nivel, descricao FROM hierarquia_perfis ORDER BY nivel, perfil`
        );
        return rows.map(rowToEntity);
    }

    async findByPerfil(perfil: string): Promise<HierarquiaPerfil | null> {
        const rows = await this.db.query<HierarquiaRow>(
            `SELECT perfil, nivel, descricao FROM hierarquia_perfis WHERE perfil = ? LIMIT 1`,
            [perfil]
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async findByNivel(nivel: number): Promise<HierarquiaPerfil[]> {
        const rows = await this.db.query<HierarquiaRow>(
            `SELECT perfil, nivel, descricao FROM hierarquia_perfis WHERE nivel = ? ORDER BY perfil`,
            [nivel]
        );
        return rows.map(rowToEntity);
    }

    async save(hierarquia: HierarquiaPerfil): Promise<void> {
        const row = hierarquia.toRow();
        await this.db.execute(
            `INSERT OR REPLACE INTO hierarquia_perfis (perfil, nivel, descricao) VALUES (?, ?, ?)`,
            [row.perfil, row.nivel, row.descricao]
        );
    }

    async delete(perfil: string): Promise<void> {
        await this.db.execute(`DELETE FROM hierarquia_perfis WHERE perfil = ?`, [perfil]);
    }
}
