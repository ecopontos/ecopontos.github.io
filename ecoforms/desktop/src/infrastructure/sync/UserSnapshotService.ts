/**
 * UserSnapshotService
 * Automatiza o upload de shared/users.json para Supabase Storage
 * sempre que usuários são criados, editados ou removidos.
 */

import type { SqlitePort } from '../../application/ports/SqlitePort';
import { getSupabaseClient } from '../persistence/supabase/supabaseClient';
import type { LanDomainSyncService } from './LanDomainSyncService';
import type { LanFileStorage } from '../storage/LanFileStorage';

const BUCKET = 'sync-bucket';
const SNAPSHOT_PATH = 'shared/users.json';

interface UserRow {
    id: string;
    nome: string;
    nome_usuario: string;
    hash_senha: string;
    email: string | null;
    perfil: string;
    ativo: number;
    sal_sync: string;
    criado_em: string;
    atualizado_em: string;
    setores_ids: string | null;
    formularios_permitidos: string | null;
}

function calculateChecksum(data: unknown): string {
    const json = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
        hash = ((hash << 5) - hash) + json.charCodeAt(i);
        hash |= 0;
    }
    return `djb2:${Math.abs(hash).toString(16)}`;
}

export class UserSnapshotService {
    constructor(
        private readonly db: SqlitePort,
        private readonly lanDomainSync?: LanDomainSyncService,
        private readonly lan?: LanFileStorage,
    ) {}

    /**
     * Lê todos os usuários do SQLite e faz upload para Supabase Storage.
     * Não bloqueia o fluxo principal — falhas são logadas como warn.
     */
    async publishUserSnapshot(): Promise<void> {
        try {
            const supabase = getSupabaseClient();
            const rows = await this.db.query<UserRow>(
                `SELECT u.*, GROUP_CONCAT(us.setor_id) as setores_ids
                 FROM usuarios u
                 LEFT JOIN usuarios_setores us ON u.id = us.usuario_id
                 GROUP BY u.id`,
            );

            const processed = rows.map((u) => {
                let forms: string[] = [];
                try {
                    forms = typeof u.formularios_permitidos === 'string'
                        ? JSON.parse(u.formularios_permitidos)
                        : [];
                } catch { forms = []; }

                // strip credentials before any upload (Supabase + LAN)
                const { hash_senha: _, sal_sync: __, ...safe } = u;
                return {
                    ...safe,
                    formularios_permitidos: forms,
                    setores: u.setores_ids ? u.setores_ids.split(',') : [],
                };
            });

            const snapshot = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                device_id: 'desktop',
                origin_device: 'desktop',
                sync_type: 'full',
                data: { usuarios: processed },
                metadata: {
                    checksum: calculateChecksum(processed),
                    record_count: processed.length,
                    compressed: false,
                },
            };

            const body = JSON.stringify(snapshot);
            const { error } = await supabase.storage
                .from(BUCKET)
                .upload(SNAPSHOT_PATH, body, {
                    contentType: 'application/json',
                    upsert: true,
                });

            if (error) {
                console.warn('[UserSnapshot] Falha ao publicar users.json:', error.message);
            } else {
                console.log(`[UserSnapshot] ${processed.length} usuários publicados no Storage`);
            }

            if (this.lan) {
                this.lan.writeJson(SNAPSHOT_PATH, snapshot).catch(e =>
                    console.warn('[UserSnapshot] LAN write falhou para shared/users.json:', e),
                );
            }

            // ADR-020: sync granular por usuário na LAN (hash_senha/sal_sync já removidos em processed)
            if (this.lanDomainSync) {
                const syncs = processed.map(u =>
                    this.lanDomainSync!.syncEntity('usuarios', u.id, u).catch(e =>
                        console.warn('[UserSnapshot] LAN sync falhou para', u.id, e),
                    ),
                );
                await Promise.allSettled(syncs);
            }
        } catch (e) {
            console.warn('[UserSnapshot] Falha ao publicar (não-fatal):', e);
        }
    }
}
