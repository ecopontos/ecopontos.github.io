import { uuidv7 } from 'ecoforms-core';
import type { SqlitePort } from '../ports/SqlitePort';
import type { SyncOutbox } from '../ports/SyncOutboxPort';
const SQL_PRAZOS_VENCIDOS = `SELECT p.id, p.manifestacao_id, p.tipo_prazo, p.data_limite
 FROM prazos p
 JOIN manifestacoes m ON p.manifestacao_id = m.id
 WHERE p.status = 'pendente'
   AND datetime(p.data_limite) < datetime('now')
   AND p.cobranca_enviada = 0
   AND m.status NOT IN ({{TERMINAIS_CLAUSE}})`;

const SQL_USUARIOS_POR_SETOR = `SELECT u.id FROM usuarios u JOIN manifestacoes m ON u.setor_id = m.setor_id WHERE m.id = ? AND u.ativo = 1`;
const SQL_NOTIFICACAO_INSERT = `INSERT INTO notificacoes (id, usuario_id, manifestacao_id, mensagem, lida, criado_em, prazo_id) VALUES (?, ?, ?, ?, 0, ?, ?)`;
const SQL_PRAZO_COBRANCA = `UPDATE prazos SET cobranca_enviada = 1, data_cobranca = ? WHERE id = ?`;

interface PrazoVencidoRow {
    id: string;
    manifestacao_id: string;
    tipo_prazo: string;
    data_limite: string;
}

interface UsuarioNotificavel {
    id: string;
}

export async function verificarPrazosVencidos(db: SqlitePort, sync?: SyncOutbox): Promise<void> {
    const TERMINAIS = ['encerrada', 'cancelada', 'encaminhado_sema'];

    const sqlPrazos = SQL_PRAZOS_VENCIDOS.replace(
        '{{TERMINAIS_CLAUSE}}',
        TERMINAIS.map(() => '?').join(','),
    );

    const vencidos = await db.query<PrazoVencidoRow>(sqlPrazos, TERMINAIS);

    for (const p of vencidos) {
        const now = new Date().toISOString();
        const mensagem = `Cobrança: prazo de "${p.tipo_prazo}" vencido em ${new Date(p.data_limite).toLocaleDateString('pt-BR')} — Manifestação ${p.manifestacao_id}`;

        const usuarios = await db.query<UsuarioNotificavel>(
            SQL_USUARIOS_POR_SETOR,
            [p.manifestacao_id],
        );

        for (const u of usuarios) {
            await db.execute(
                SQL_NOTIFICACAO_INSERT,
                [uuidv7(), u.id, p.manifestacao_id, mensagem, now, p.id],
            );
        }

        await db.execute(
            SQL_PRAZO_COBRANCA,
            [now, p.id],
        );

        await sync?.write('prazo.vencido', {
            prazoId: p.id,
            manifestacaoId: p.manifestacao_id,
            dataLimite: p.data_limite,
        }, { aggregateId: p.id, streamId: p.manifestacao_id });

        if (usuarios.length > 0) {
            await sync?.write('prazo.cobranca_enviada', {
                prazoId: p.id,
                manifestacaoId: p.manifestacao_id,
                usuarioIds: usuarios.map(u => u.id),
            }, { aggregateId: p.id, streamId: p.manifestacao_id });
        }
    }
}
