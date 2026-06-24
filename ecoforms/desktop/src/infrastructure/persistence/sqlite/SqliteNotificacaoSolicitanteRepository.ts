import { NotificacaoSolicitante, type NotificacaoSolicitanteStatus } from '../../../domain/notificacao-solicitante/NotificacaoSolicitante';
import type { NotificacaoSolicitanteRepository } from '../../../domain/notificacao-solicitante/NotificacaoSolicitanteRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface NotificacaoRow {
    id: string;
    manifestacao_id: string;
    canal: string;
    conteudo: string;
    enviado_em: string | null;
    status: string;
    usuario_id: string;
    criado_em: string;
}

function rowToEntity(row: NotificacaoRow): NotificacaoSolicitante {
    return NotificacaoSolicitante.fromRow(row);
}

export class SqliteNotificacaoSolicitanteRepository implements NotificacaoSolicitanteRepository {
    constructor(private readonly db: SqlitePort) {}

    async findAll(): Promise<NotificacaoSolicitante[]> {
        const rows = await this.db.query<NotificacaoRow>(
            `SELECT id, manifestacao_id, canal, conteudo, enviado_em, status, usuario_id, criado_em
             FROM notificacoes_solicitante ORDER BY criado_em DESC`
        );
        return rows.map(rowToEntity);
    }

    async findByManifestacao(manifestacaoId: string): Promise<NotificacaoSolicitante[]> {
        const rows = await this.db.query<NotificacaoRow>(
            `SELECT id, manifestacao_id, canal, conteudo, enviado_em, status, usuario_id, criado_em
             FROM notificacoes_solicitante WHERE manifestacao_id = ? ORDER BY criado_em DESC`,
            [manifestacaoId]
        );
        return rows.map(rowToEntity);
    }

    async findByUsuario(usuarioId: string): Promise<NotificacaoSolicitante[]> {
        const rows = await this.db.query<NotificacaoRow>(
            `SELECT id, manifestacao_id, canal, conteudo, enviado_em, status, usuario_id, criado_em
             FROM notificacoes_solicitante WHERE usuario_id = ? ORDER BY criado_em DESC`,
            [usuarioId]
        );
        return rows.map(rowToEntity);
    }

    async findByStatus(status: NotificacaoSolicitanteStatus): Promise<NotificacaoSolicitante[]> {
        const rows = await this.db.query<NotificacaoRow>(
            `SELECT id, manifestacao_id, canal, conteudo, enviado_em, status, usuario_id, criado_em
             FROM notificacoes_solicitante WHERE status = ? ORDER BY criado_em DESC`,
            [status]
        );
        return rows.map(rowToEntity);
    }

    async findById(id: string): Promise<NotificacaoSolicitante | null> {
        const rows = await this.db.query<NotificacaoRow>(
            `SELECT id, manifestacao_id, canal, conteudo, enviado_em, status, usuario_id, criado_em
             FROM notificacoes_solicitante WHERE id = ? LIMIT 1`,
            [id]
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async save(notificacao: NotificacaoSolicitante): Promise<void> {
        const row = notificacao.toRow();
        const exists = await this.db.query<{ id: string }>(
            `SELECT id FROM notificacoes_solicitante WHERE id = ? LIMIT 1`,
            [row.id]
        );
        if (exists.length === 0) {
            await this.db.execute(
                `INSERT INTO notificacoes_solicitante (id, manifestacao_id, canal, conteudo, enviado_em, status, usuario_id, criado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
                [row.id, row.manifestacao_id, row.canal, row.conteudo, row.enviado_em, row.status, row.usuario_id, row.criado_em]
            );
        } else {
            await this.db.execute(
                `UPDATE notificacoes_solicitante SET canal = ?, conteudo = ?, enviado_em = ?, status = ? WHERE id = ?`,
                [row.canal, row.conteudo, row.enviado_em, row.status, row.id]
            );
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.execute(`DELETE FROM notificacoes_solicitante WHERE id = ?`, [id]);
    }
}
