import { ExecucaoCliente } from '../../../domain/execucao-cliente/ExecucaoCliente';
import type { ExecucaoClienteRepository } from '../../../domain/execucao-cliente/ExecucaoClienteRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface ExecucaoClienteRow {
    id: string;
    execucao_id: string;
    cliente_id: string;
    coleta_realizada: number;
    ocorrencia: string | null;
    observacao: string | null;
    horario_visita: string | null;
    latitude: number | null;
    longitude: number | null;
    registrado_por: string | null;
    registrado_em: string;
}

function rowToEntity(row: ExecucaoClienteRow): ExecucaoCliente {
    return ExecucaoCliente.fromRow(row);
}

export class SqliteExecucaoClienteRepository implements ExecucaoClienteRepository {
    constructor(private readonly db: SqlitePort) {}

    async findAll(): Promise<ExecucaoCliente[]> {
        const rows = await this.db.query<ExecucaoClienteRow>(
            `SELECT id, execucao_id, cliente_id, coleta_realizada, ocorrencia, observacao,
                    horario_visita, latitude, longitude, registrado_por, registrado_em
             FROM execucao_clientes ORDER BY registrado_em DESC`
        );
        return rows.map(rowToEntity);
    }

    async findByExecucao(execucaoId: string): Promise<ExecucaoCliente[]> {
        const rows = await this.db.query<ExecucaoClienteRow>(
            `SELECT id, execucao_id, cliente_id, coleta_realizada, ocorrencia, observacao,
                    horario_visita, latitude, longitude, registrado_por, registrado_em
             FROM execucao_clientes WHERE execucao_id = ? ORDER BY registrado_em DESC`,
            [execucaoId]
        );
        return rows.map(rowToEntity);
    }

    async findByCliente(clienteId: string): Promise<ExecucaoCliente[]> {
        const rows = await this.db.query<ExecucaoClienteRow>(
            `SELECT id, execucao_id, cliente_id, coleta_realizada, ocorrencia, observacao,
                    horario_visita, latitude, longitude, registrado_por, registrado_em
             FROM execucao_clientes WHERE cliente_id = ? ORDER BY registrado_em DESC`,
            [clienteId]
        );
        return rows.map(rowToEntity);
    }

    async findById(id: string): Promise<ExecucaoCliente | null> {
        const rows = await this.db.query<ExecucaoClienteRow>(
            `SELECT id, execucao_id, cliente_id, coleta_realizada, ocorrencia, observacao,
                    horario_visita, latitude, longitude, registrado_por, registrado_em
             FROM execucao_clientes WHERE id = ? LIMIT 1`,
            [id]
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async save(execucao: ExecucaoCliente): Promise<void> {
        const row = execucao.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM execucao_clientes WHERE id = ? LIMIT 1`,
            [row.id]
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO execucao_clientes (id, execucao_id, cliente_id, coleta_realizada, ocorrencia, observacao,
                 horario_visita, latitude, longitude, registrado_por, registrado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
                [row.id, row.execucao_id, row.cliente_id, row.coleta_realizada, row.ocorrencia, row.observacao,
                 row.horario_visita, row.latitude, row.longitude, row.registrado_por, row.registrado_em]
            );
        } else {
            await this.db.execute(
                `UPDATE execucao_clientes SET coleta_realizada = ?, ocorrencia = ?, observacao = ?,
                 horario_visita = ?, latitude = ?, longitude = ? WHERE id = ?`,
                [row.coleta_realizada, row.ocorrencia, row.observacao,
                 row.horario_visita, row.latitude, row.longitude, row.id]
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM execucao_clientes WHERE id = ?`, [id]);
    }
}
