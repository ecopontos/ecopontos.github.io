import { ServiceSlot } from '../../../domain/service/ServiceSlot';
import type { StatusSlot } from '../../../domain/service/ServiceSlot';
import type { ServiceSlotRepository } from '../../../domain/service/ServiceSlotRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface ServiceSlotRow {
    id: string;
    service_type_id: string;
    titulo: string;
    descricao: string | null;
    data_inicio: string;
    data_fim: string;
    horario_inicio: string | null;
    horario_fim: string | null;
    tipo_prazo: string | null;
    recorrencia: string | null;
    capacidade: number | null;
    bairros: string;
    local: string | null;
    vagas_ocupadas: number;
    status: string;
    abertura_em: string | null;
    criado_por: string;
    criado_em: string;
    atualizado_em: string;
}

function rowToEntity(row: ServiceSlotRow): ServiceSlot {
    return ServiceSlot.fromProps({
        id: row.id,
        serviceTypeId: row.service_type_id,
        titulo: row.titulo,
        descricao: row.descricao,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        horarioInicio: row.horario_inicio,
        horarioFim: row.horario_fim,
        tipoPrazo: (row.tipo_prazo as 'unico' | 'periodo' | 'recorrente' | null) ?? 'periodo',
        recorrencia: row.recorrencia,
        capacidade: row.capacidade,
        bairros: JSON.parse(row.bairros ?? '[]'),
        local: row.local,
        vagasOcupadas: row.vagas_ocupadas ?? 0,
        status: row.status as StatusSlot,
        aberturaEm: row.abertura_em,
        criadoPor: row.criado_por,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
    });
}

export class SqliteServiceSlotRepository implements ServiceSlotRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<ServiceSlot | null> {
        const rows = await this.db.query<ServiceSlotRow>(
            `SELECT * FROM tbl_service_slots WHERE id = ? LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async findAll(filtros?: { status?: string; serviceTypeId?: string; dataInicio?: string; dataFim?: string }): Promise<ServiceSlot[]> {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (filtros?.status) { conditions.push('status = ?'); params.push(filtros.status); }
        if (filtros?.serviceTypeId) { conditions.push('service_type_id = ?'); params.push(filtros.serviceTypeId); }
        if (filtros?.dataInicio) { conditions.push('data_inicio >= ?'); params.push(filtros.dataInicio); }
        if (filtros?.dataFim) { conditions.push('data_fim <= ?'); params.push(filtros.dataFim); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT * FROM tbl_service_slots ${where} ORDER BY data_inicio, titulo`;
        const rows = await this.db.query<ServiceSlotRow>(sql, params);
        return rows.map(rowToEntity);
    }

    async save(slot: ServiceSlot): Promise<void> {
        const json = slot.toSyncJSON();
        await this.db.execute(
            `INSERT INTO tbl_service_slots (
                id, service_type_id, titulo, descricao, data_inicio, data_fim,
                horario_inicio, horario_fim, tipo_prazo, recorrencia, capacidade,
                bairros, local, vagas_ocupadas, status, abertura_em,
                criado_por, criado_em, atualizado_em
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                service_type_id = excluded.service_type_id,
                titulo          = excluded.titulo,
                descricao       = excluded.descricao,
                data_inicio     = excluded.data_inicio,
                data_fim        = excluded.data_fim,
                horario_inicio  = excluded.horario_inicio,
                horario_fim     = excluded.horario_fim,
                tipo_prazo      = excluded.tipo_prazo,
                recorrencia     = excluded.recorrencia,
                capacidade      = excluded.capacidade,
                bairros         = excluded.bairros,
                local           = excluded.local,
                vagas_ocupadas  = excluded.vagas_ocupadas,
                status          = excluded.status,
                abertura_em     = excluded.abertura_em,
                atualizado_em   = excluded.atualizado_em`,
            [
                json.id, json.service_type_id, json.titulo, json.descricao,
                json.data_inicio, json.data_fim, json.horario_inicio, json.horario_fim,
                json.tipo_prazo, json.recorrencia, json.capacidade, json.bairros,
                json.local, json.vagas_ocupadas, json.status, json.abertura_em,
                json.criado_por, json.criado_em, json.atualizado_em,
            ],
        );
    }

    async updateVagasOcupadas(id: string, vagas: number): Promise<void> {
        await this.db.execute(
            `UPDATE tbl_service_slots SET vagas_ocupadas = ?, atualizado_em = ? WHERE id = ?`,
            [vagas, new Date().toISOString(), id],
        );
    }


    async transaction<T>(fn: (tx: ServiceSlotRepository) => Promise<T>): Promise<T> {
        return this.db.transaction(async (tx) => fn(new SqliteServiceSlotRepository(tx)));
    }
}
