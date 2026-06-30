import { Agendamento, type StatusAgendamento } from '../../../domain/service/Agendamento';
import type { AgendamentoRepository, AgendamentoFiltros, AgendamentoWithDetails, AgendamentoMapPoint } from '../../../domain/service/AgendamentoRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface AgendamentoRow {
    id: string;
    slot_id: string;
    service_type_id: string;
    cliente_id: string;
    cliente_nome: string;
    vagas_solicitadas: number;
    bairro: string | null;
    dados_formulario: string;
    status: string;
    task_id: string | null;
    cliente_email: string | null;
    cliente_telefone: string | null;
    responsavel_id: string | null;
    setor_id: string | null;
    criado_por: string;
    criado_em: string;
    atualizado_em: string;
}

function rowToEntity(row: AgendamentoRow): Agendamento {
    return Agendamento.fromProps({
        id:               row.id,
        slotId:           row.slot_id,
        serviceTypeId:    row.service_type_id,
        clienteId:        row.cliente_id,
        clienteNome:      row.cliente_nome,
        vagasSolicitadas: row.vagas_solicitadas ?? 1,
        bairro:           row.bairro,
        dadosFormulario:  (() => {
            try { return JSON.parse(row.dados_formulario || '{}'); } catch (err) { console.error('[SqliteAgendamentoRepository] dados_formulario inválido para id', row.id, err); return {}; }
        })(),
        status:           row.status as StatusAgendamento,
        taskId:           row.task_id,
        clienteEmail:     row.cliente_email,
        clienteTelefone:  row.cliente_telefone,
        responsavelId:    row.responsavel_id,
        setorId:          row.setor_id,
        criadoPor:        row.criado_por,
        criadoEm:         row.criado_em,
        atualizadoEm:     row.atualizado_em,
    });
}

export class SqliteAgendamentoRepository implements AgendamentoRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<Agendamento | null> {
        const rows = await this.db.query<AgendamentoRow>(
            `SELECT * FROM agendamentos WHERE id = ? LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async findByIdWithDetails(id: string): Promise<AgendamentoWithDetails | null> {
        const rows = await this.db.query<AgendamentoWithDetails>(
            `SELECT ag.cliente_nome AS clienteNome, ag.cliente_email AS clienteEmail,
                    ag.cliente_telefone AS clienteTelefone,
                    ag.bairro, ag.vagas_solicitadas AS vagasSolicitadas,
                    ag.status, ag.dados_formulario AS dadosFormulario,
                    sl.titulo AS slotTitulo, sl.local,
                    sl.data_inicio AS dataInicio, sl.data_fim AS dataFim,
                    st.nome AS serviceTypeNome
             FROM agendamentos ag
             JOIN janelas_agendamento sl ON sl.id = ag.slot_id
             JOIN tipos_servico st ON st.id = ag.service_type_id
             WHERE ag.id = ? LIMIT 1`,
            [id],
        );
        return rows[0] ?? null;
    }

    async findBySlotId(slotId: string): Promise<Agendamento[]> {
        const rows = await this.db.query<AgendamentoRow>(
            `SELECT * FROM agendamentos WHERE slot_id = ? ORDER BY criado_em ASC`,
            [slotId],
        );
        return rows.map(rowToEntity);
    }

    async findByClienteId(clienteId: string): Promise<Agendamento[]> {
        const rows = await this.db.query<AgendamentoRow>(
            `SELECT * FROM agendamentos WHERE cliente_id = ? ORDER BY criado_em DESC`,
            [clienteId],
        );
        return rows.map(rowToEntity);
    }

    async findAll(filtros?: AgendamentoFiltros): Promise<Agendamento[]> {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (filtros?.slotId)        { conditions.push('slot_id = ?');          params.push(filtros.slotId); }
        if (filtros?.clienteId)     { conditions.push('cliente_id = ?');       params.push(filtros.clienteId); }
        if (filtros?.status)        { conditions.push('status = ?');           params.push(filtros.status); }
        if (filtros?.serviceTypeId) { conditions.push('service_type_id = ?'); params.push(filtros.serviceTypeId); }
        if (filtros?.setorId)       { conditions.push('setor_id = ?');        params.push(filtros.setorId); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        let sql = `SELECT * FROM agendamentos ${where} ORDER BY criado_em DESC`;
        if (filtros?.limit != null) {
            sql += ` LIMIT ?`;
            params.push(filtros.limit);
            if (filtros.offset != null) {
                sql += ` OFFSET ?`;
                params.push(filtros.offset);
            }
        }
        const rows = await this.db.query<AgendamentoRow>(sql, params);
        return rows.map(rowToEntity);
    }

    async findMapDataBySlotId(slotId: string): Promise<AgendamentoMapPoint[]> {
        return this.db.query<AgendamentoMapPoint>(
            `SELECT a.id, a.cliente_id AS clienteId, a.cliente_nome AS clienteNome,
                    a.bairro, a.status, a.vagas_solicitadas AS vagasSolicitadas,
                    c.endereco, c.numero, c.cidade,
                    COALESCE(t.centroid_lat, c.latitude)  AS latitude,
                    COALESCE(t.centroid_lng, c.longitude) AS longitude
             FROM agendamentos a
             JOIN clientes c ON c.id = a.cliente_id
             LEFT JOIN terrenos t ON t.id = c.terreno_id
             WHERE a.slot_id = ?
               AND a.status != 'cancelado'
               AND (t.centroid_lat IS NOT NULL OR c.latitude IS NOT NULL)
             ORDER BY a.criado_em`,
            [slotId],
        );
    }

    async existeParaClienteESlot(clienteId: string, slotId: string): Promise<boolean> {
        const rows = await this.db.query<{ n: number }>(
            `SELECT COUNT(*) AS n FROM agendamentos
             WHERE cliente_id = ? AND slot_id = ? AND status != 'cancelado'`,
            [clienteId, slotId],
        );
        return (rows[0]?.n ?? 0) > 0;
    }

    async confirmIfPendente(id: string, atualizadoEm: string): Promise<boolean> {
        let claimed = false;
        await this.db.transaction(async (tx) => {
            const rows = await tx.query<{ status: string }>(
                'SELECT status FROM agendamentos WHERE id = ? LIMIT 1',
                [id],
            );
            if (rows[0]?.status === 'pendente') {
                await tx.execute(
                    "UPDATE agendamentos SET status = 'confirmado', atualizado_em = ? WHERE id = ?",
                    [atualizadoEm, id],
                );
                claimed = true;
            }
        });
        return claimed;
    }
    async save(agendamento: Agendamento): Promise<void> {
        const r = agendamento.toRow();
        await this.db.execute(
            `INSERT INTO agendamentos (
                id, slot_id, service_type_id, cliente_id, cliente_nome,
                vagas_solicitadas, bairro, dados_formulario, status, task_id,
                cliente_email, cliente_telefone, responsavel_id, setor_id,
                criado_por, criado_em, atualizado_em
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                status          = excluded.status,
                task_id         = excluded.task_id,
                dados_formulario= excluded.dados_formulario,
                responsavel_id  = excluded.responsavel_id,
                setor_id        = excluded.setor_id,
                atualizado_em   = excluded.atualizado_em`,
            [
                r.id, r.slot_id, r.service_type_id, r.cliente_id, r.cliente_nome,
                r.vagas_solicitadas, r.bairro, r.dados_formulario, r.status, r.task_id,
                r.cliente_email, r.cliente_telefone, r.responsavel_id, r.setor_id,
                r.criado_por, r.criado_em, r.atualizado_em,
            ],
        );
    }

    async transaction<T>(fn: (tx: AgendamentoRepository) => Promise<T>): Promise<T> {
        return this.db.transaction(async (tx) => fn(new SqliteAgendamentoRepository(tx)));
    }
}
