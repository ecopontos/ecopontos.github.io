import { uuidv7 } from 'ecoforms-core';
import type { SqlitePort } from '../ports/SqlitePort';
import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';
import {
  PRAZOS_VENCIDOS_PENDENTES,
  USUARIOS_POR_MANIFESTACAO_SETOR,
  NOTIFICACAO_INSERT,
  PRAZO_MARCAR_COBRANCA_ENVIADA,
} from '../../infrastructure/persistence/sqlite/queries/ouvidoria';

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

    const sqlPrazos = PRAZOS_VENCIDOS_PENDENTES.sql.replace(
        '{{TERMINAIS_CLAUSE}}',
        TERMINAIS.map(() => '?').join(','),
    );

    const vencidos = await db.query<PrazoVencidoRow>(sqlPrazos, TERMINAIS);

    for (const p of vencidos) {
        const now = new Date().toISOString();
        const mensagem = `Cobrança: prazo de "${p.tipo_prazo}" vencido em ${new Date(p.data_limite).toLocaleDateString('pt-BR')} — Manifestação ${p.manifestacao_id}`;

        const usuarios = await db.query<UsuarioNotificavel>(
            USUARIOS_POR_MANIFESTACAO_SETOR.sql,
            [p.manifestacao_id],
        );

        for (const u of usuarios) {
            await db.execute(
                NOTIFICACAO_INSERT.sql,
                [uuidv7(), u.id, p.manifestacao_id, mensagem, now, p.id],
            );
        }

        await db.execute(
            PRAZO_MARCAR_COBRANCA_ENVIADA.sql,
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
