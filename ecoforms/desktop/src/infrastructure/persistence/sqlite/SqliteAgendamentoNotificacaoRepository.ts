import { uuidv7 } from 'ecoforms-core';
import type {
    AgendamentoNotificacaoRepository,
    AgendamentoNotificacao,
    CanalNotificacao,
    StatusNotificacao,
} from '../../../domain/service/AgendamentoNotificacaoRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface NotificacaoRow {
    id: string;
    agendamento_id: string;
    canal: string;
    status: string;
    detalhe: string | null;
    criado_em: string;
}

export class SqliteAgendamentoNotificacaoRepository implements AgendamentoNotificacaoRepository {
    constructor(private readonly db: SqlitePort) {}

    async registrar(
        agendamentoId: string,
        canal: CanalNotificacao,
        status: StatusNotificacao,
        detalhe?: string,
    ): Promise<void> {
        await this.db.execute(
            `INSERT INTO tbl_agendamento_notificacoes (id, agendamento_id, canal, status, detalhe, criado_em)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv7(), agendamentoId, canal, status, detalhe ?? null, new Date().toISOString()],
        );
    }

    async findByAgendamentoId(agendamentoId: string): Promise<AgendamentoNotificacao[]> {
        const rows = await this.db.query<NotificacaoRow>(
            `SELECT * FROM tbl_agendamento_notificacoes WHERE agendamento_id = ? ORDER BY criado_em ASC`,
            [agendamentoId],
        );
        return rows.map(r => ({
            id:            r.id,
            agendamentoId: r.agendamento_id,
            canal:         r.canal as CanalNotificacao,
            status:        r.status as StatusNotificacao,
            detalhe:       r.detalhe,
            criadoEm:      r.criado_em,
        }));
    }

    async findLinkWhatsApp(agendamentoId: string): Promise<string | null> {
        const rows = await this.db.query<{ detalhe: string | null }>(
            `SELECT detalhe FROM tbl_agendamento_notificacoes
             WHERE agendamento_id = ? AND canal = 'whatsapp' AND status = 'pendente_envio'
             ORDER BY criado_em DESC LIMIT 1`,
            [agendamentoId],
        );
        return rows[0]?.detalhe ?? null;
    }
}
