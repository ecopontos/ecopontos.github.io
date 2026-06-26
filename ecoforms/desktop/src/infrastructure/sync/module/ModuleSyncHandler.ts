import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { InboundService } from '../InboundService';
import type { EventEnvelope } from '../EventEnvelope';

export class ModuleSyncHandler {
    constructor(private readonly db: SqlitePort) {}

    register(inbound: InboundService): void {
        inbound.on('module.publicado', this.onPublicado.bind(this));
        inbound.on('module.arquivado', this.onArquivado.bind(this));
        inbound.on('visuais_modulos.created', this.onVisualCriado.bind(this));
        inbound.on('visuais_modulos.updated', this.onVisualAtualizado.bind(this));
        inbound.on('visuais_modulos.deleted', this.onVisualDeletado.bind(this));
    }

    unregister(): void {
        // HandlerRegistry não expõe método para desregistrar handlers individuais.
        // Limiteza documentada - handlers inbound sao lifetime do processo.
    }

    private async onPublicado(env: EventEnvelope): Promise<void> {
        const d = env.data as Record<string, unknown>;
        if (!d?.id) return;
        await this.db.execute(
            `INSERT OR REPLACE INTO registro_modulos
             (id, slug, nome, tipo_entidade, status, versao, config_version, configuracao, publicado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                d.id,
                d.slug ?? '',
                d.name ?? d.nome ?? '',
                d.entity_type ?? '',
                d.status ?? 'published',
                d.version ?? 1,
                d.config_version ?? 1,
                typeof d.config === 'string' ? d.config : JSON.stringify(d.config ?? {}),
                d.publicado_em ?? env.time,
                env.time,
            ],
        );
    }

    private async onArquivado(env: EventEnvelope): Promise<void> {
        const d = env.data as Record<string, unknown>;
        const id = d?.id ?? env.aggregate.id;
        if (!id) return;
        await this.db.execute(
            `UPDATE registro_modulos SET status = 'archived', atualizado_em = ? WHERE id = ?`,
            [env.time, id],
        );
    }

    private async onVisualCriado(env: EventEnvelope): Promise<void> {
        const d = env.data as Record<string, unknown>;
        if (!d?.id) return;
        await this.db.execute(
            `INSERT OR REPLACE INTO visuais_modulos
             (id, module_id, visual_type, name, config, is_default, user_id, sync_status, criado_em, atualizado_em)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`,
            [
                d.id,
                d.module_id,
                d.visual_type,
                d.name,
                d.config,
                d.is_default ?? 0,
                d.user_id ?? null,
                d.sync_status ?? 'synced',
                env.time,
            ],
        );
    }

    private async onVisualAtualizado(env: EventEnvelope): Promise<void> {
        const d = env.data as Record<string, unknown>;
        if (!d?.id) return;
        await this.db.execute(
            `UPDATE visuais_modulos SET name = ?, config = ?, is_default = ?,
             sync_status = ?, atualizado_em = datetime('now') WHERE id = ?`,
            [d.name, d.config, d.is_default ?? 0, d.sync_status ?? 'synced', d.id],
        );
    }

    private async onVisualDeletado(env: EventEnvelope): Promise<void> {
        const d = env.data as Record<string, unknown>;
        const id = d?.id ?? env.aggregate.id;
        if (!id) return;
        await this.db.execute(`DELETE FROM visuais_modulos WHERE id = ?`, [id]);
    }
}